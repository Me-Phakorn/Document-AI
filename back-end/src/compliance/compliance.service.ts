import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ComplianceCheckStatus, ComplianceInputType, Prisma, ReviewStatus, ReviewType, RulebookStatus } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AiCompletionService } from '../analysis/ai-completion.service';
import { AiMessageContentPart } from '../analysis/providers/ai-provider.types';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MinioStorageService } from '../storage/minio-storage.service';
import { ObjectKeyService } from '../storage/object-key.service';
import { CreateComplianceCheckDto } from './dto/create-compliance-check.dto';

interface ComplianceContext {
  actorId?: string;
  correlationId: string;
}

interface AiFinding {
  ruleCode: string;
  ruleTitle: string;
  riskLevel: string;
  status: 'VIOLATED' | 'POTENTIAL' | 'COMPLIANT';
  explanation: string;
  evidence?: string;
}

interface AiComplianceResponse {
  overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'POTENTIAL_VIOLATION' | 'AMBIGUOUS';
  summary: string;
  findings: AiFinding[];
  totalRulesChecked: number;
  violationsCount: number;
  potentialCount: number;
  compliantCount: number;
  recommendedAction?: string;
}

const VALID_STATUSES: ComplianceCheckStatus[] = [
  ComplianceCheckStatus.COMPLIANT,
  ComplianceCheckStatus.NON_COMPLIANT,
  ComplianceCheckStatus.POTENTIAL_VIOLATION,
  ComplianceCheckStatus.AMBIGUOUS,
];

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AiCompletionService) private readonly aiCompletion: AiCompletionService,
    @Inject(MinioStorageService) private readonly storage: MinioStorageService,
    @Inject(ObjectKeyService) private readonly objectKey: ObjectKeyService,
  ) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.complianceCheck.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { selectedRulebook: true, results: { orderBy: { versionNumber: 'desc' }, take: 1 }, reviews: { orderBy: { createdAt: 'desc' }, take: 3 } },
      }),
      this.prisma.complianceCheck.count(),
    ]);

    return { items, total, limit, offset };
  }

  async findOne(id: string) {
    const check = await this.prisma.complianceCheck.findUnique({
      where: { id },
      include: { selectedRulebook: true, results: { orderBy: { versionNumber: 'desc' } }, reviews: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!check) throw new NotFoundException({ code: 'COMPLIANCE_CHECK_NOT_FOUND', message: 'Compliance check not found.' });
    return check;
  }

  async findOneDetail(id: string) {
    const check = await this.findOne(id);
    let rulesChecked: Array<{
      id: string;
      ruleCode: string;
      title: string;
      description: string;
      riskLevel: string;
      condition: string | null;
      prohibition: string | null;
      fromVersionNumber: number;
    }> = [];

    if (check.selectedRulebook?.id) {
      const rows = await this.resolveAllRulebookRules(check.selectedRulebook.id);
      rulesChecked = rows.map((r) => ({
        id: r.id,
        ruleCode: r.ruleCode,
        title: r.title,
        description: r.description,
        riskLevel: r.riskLevel,
        condition: r.condition ?? null,
        prohibition: r.prohibition ?? null,
        fromVersionNumber: r.masterRulebookVersion.versionNumber,
      }));
    }

    return { ...check, rulesChecked };
  }

  async create(dto: CreateComplianceCheckDto, context: ComplianceContext) {
    if (!dto.imageBase64 && (!dto.content || dto.content.trim().length === 0)) {
      throw new BadRequestException({ code: 'NO_INPUT_PROVIDED', message: 'Provide either imageBase64 or content for compliance checking.' });
    }

    const selectedRulebook = await this.resolveRulebook(dto.selectedRulebookId);

    // Aggregate ALL rules from ALL approved/published versions of this rulebook.
    // Each document approval creates a MasterRulebookVersion; the MasterRulebook is the
    // accumulated repository of all of them.
    const allRules = await this.resolveAllRulebookRules(selectedRulebook.id);
    if (!allRules.length) {
      throw new BadRequestException({ code: 'NO_RULES_AVAILABLE', message: 'No rules are available in this rulebook yet. Approve at least one AI result first.' });
    }

    const inputType = dto.inputType ?? (dto.imageBase64 ? ComplianceInputType.IMAGE : ComplianceInputType.TEXT);
    const inputHash = this.sha256(dto.imageBase64 ?? dto.content ?? '');

    // Pre-generate the check ID so we can derive the image object key before the transaction.
    const checkId = randomUUID();

    // Upload source image to MinIO before the DB transaction so the key is stable.
    let inputImageKey: string | undefined;
    const inputImageMimeType = dto.imageMimeType ?? 'image/jpeg';
    if (dto.imageBase64) {
      inputImageKey = this.objectKey.complianceInputImage(checkId, inputImageMimeType);
      const imageBuffer = Buffer.from(dto.imageBase64, 'base64');
      await this.storage.putObject({
        bucket: 'compliance-inputs',
        objectKey: inputImageKey,
        content: imageBuffer,
        contentType: inputImageMimeType,
      });
    }

    const aiResponse = await this.runAiComplianceCheck(dto, selectedRulebook, allRules, context.correlationId, dto.model);

    const dbStatus = VALID_STATUSES.includes(aiResponse.overallStatus as ComplianceCheckStatus)
      ? (aiResponse.overallStatus as ComplianceCheckStatus)
      : ComplianceCheckStatus.NEED_HUMAN_REVIEW;

    const violations = aiResponse.findings.filter((f) => f.status === 'VIOLATED');
    const potentials = aiResponse.findings.filter((f) => f.status === 'POTENTIAL');

    return this.prisma.$transaction(async (tx) => {
      const check = await tx.complianceCheck.create({
        data: {
          id: checkId,
          inputType,
          status: dbStatus,
          selectedRulebookId: selectedRulebook.id,
          selectedReportId: dto.selectedReportId,
          createdById: context.actorId,
          inputHash,
          extractedContentHash: inputHash,
          metadata: {
            title: dto.title ?? null,
            focusPrompt: dto.focusPrompt ?? null,
            hasImage: !!dto.imageBase64,
            rulebookTitle: selectedRulebook.title,
            model: dto.model ?? null,
            violationsCount: aiResponse.violationsCount,
            potentialCount: aiResponse.potentialCount,
            compliantCount: aiResponse.compliantCount,
            totalRulesChecked: aiResponse.totalRulesChecked,
            ...(inputImageKey ? { inputImageKey, inputImageMimeType } : {}),
          },
          results: {
            create: {
              versionNumber: 1,
              status: dbStatus,
              summary: aiResponse.summary,
              matchedRules: aiResponse.findings as unknown as Prisma.InputJsonValue,
              ambiguousPoints: potentials as unknown as Prisma.InputJsonValue,
              recommendedAction: aiResponse.recommendedAction ?? null,
            },
          },
        },
        include: { results: true, selectedRulebook: true },
      });

      if (dbStatus !== ComplianceCheckStatus.COMPLIANT) {
        await tx.reviewItem.create({
          data: {
            reviewType: ReviewType.COMPLIANCE_CHECK,
            status: ReviewStatus.PENDING,
            complianceCheckId: check.id,
            comment: `${violations.length} violation(s), ${potentials.length} potential issue(s). ${aiResponse.recommendedAction ?? ''}`.trim(),
          },
        });
      }

      await this.audit.record(
        {
          actorId: context.actorId,
          action: 'COMPLIANCE_CHECK_CREATED',
          entityType: 'ComplianceCheck',
          entityId: check.id,
          nextState: { status: dbStatus, selectedRulebookId: selectedRulebook.id, violationsCount: aiResponse.violationsCount, totalRulesChecked: aiResponse.totalRulesChecked },
          correlationId: context.correlationId,
          requestMetadata: { inputType, title: dto.title ?? null, hasImage: !!dto.imageBase64, focusPrompt: dto.focusPrompt ?? null },
        },
        tx,
      );

      return check;
    });
  }

  async getInputImage(id: string): Promise<{ buffer: Buffer; contentType: string }> {
    const check = await this.prisma.complianceCheck.findUnique({ where: { id }, select: { metadata: true } });
    if (!check) throw new NotFoundException({ code: 'COMPLIANCE_CHECK_NOT_FOUND', message: 'Compliance check not found.' });
    const meta = check.metadata as Record<string, string> | null;
    const imageKey = meta?.inputImageKey;
    if (!imageKey) throw new NotFoundException({ code: 'NO_INPUT_IMAGE', message: 'No source image stored for this compliance check.' });
    const buffer = await this.storage.getObjectBuffer('compliance-inputs', imageKey);
    return { buffer, contentType: meta?.inputImageMimeType ?? 'image/jpeg' };
  }

  private async resolveAllRulebookRules(masterRulebookId: string) {
    // Fetch ALL rules from every APPROVED or PUBLISHED version of this master rulebook.
    // Each document approval creates a separate MasterRulebookVersion so rules from different
    // documents intentionally live in different versions. We must NOT deduplicate by ruleCode
    // across versions — the AI generates similar codes (RULE_001, RULE_002 …) for each
    // document, so deduplication would silently discard most rules.
    return this.prisma.ruleVersion.findMany({
      where: {
        masterRulebookVersion: {
          masterRulebookId,
          status: { in: [RulebookStatus.APPROVED, RulebookStatus.PUBLISHED] },
        },
      },
      include: { masterRulebookVersion: { select: { versionNumber: true } } },
      orderBy: [{ masterRulebookVersion: { versionNumber: 'asc' } }, { ruleCode: 'asc' }],
    });
  }

  private async runAiComplianceCheck(
    dto: CreateComplianceCheckDto,
    rulebook: Awaited<ReturnType<typeof this.resolveRulebook>>,
    allRules: Awaited<ReturnType<typeof this.resolveAllRulebookRules>>,
    correlationId: string,
    model?: string,
  ): Promise<AiComplianceResponse> {
    const rules = allRules;
    const rulebookTitle = `${rulebook.title} (${rulebook.domain})`;

    const rulesText = rules
      .map(
        (r) =>
          `[${r.ruleCode}] ${r.title} — ระดับความเสี่ยง: ${r.riskLevel}\n  คำอธิบาย: ${r.description}${r.prohibition ? `\n  ข้อห้าม: ${r.prohibition}` : ''}${r.condition ? `\n  เงื่อนไข: ${r.condition}` : ''}`,
      )
      .join('\n\n');

    const focusSection = dto.focusPrompt ? `\n\nจุดที่ต้องการโฟกัสเป็นพิเศษ: ${dto.focusPrompt}` : '';

    const instructionText =
      `ตรวจสอบเนื้อหา${dto.imageBase64 ? '/ภาพ' : ''}นี้กับกฎ${rules.length} ข้อจากทุกเอกสารที่ผ่านการ review แล้วในกฎระเบียบ "${rulebookTitle}"${focusSection}\n\n` +
      `กฎระเบียบทั้งหมด:\n${rulesText}\n\n` +
      (dto.content && !dto.imageBase64 ? `เนื้อหาที่ต้องการตรวจสอบ:\n${dto.content}\n\n` : '') +
      `ตรวจสอบทุกกฎแล้วรายงานผลในรูปแบบ JSON เท่านั้น:\n` +
      `{"overallStatus":"COMPLIANT"|"NON_COMPLIANT"|"POTENTIAL_VIOLATION"|"AMBIGUOUS","summary":"สรุปผลโดยรวม","findings":[{"ruleCode":"รหัสกฎ","ruleTitle":"ชื่อกฎ","riskLevel":"HIGH"|"MEDIUM"|"LOW"|"INFO","status":"VIOLATED"|"POTENTIAL"|"COMPLIANT","explanation":"เหตุผล","evidence":"หลักฐานหรือข้อความที่เกี่ยวข้อง"}],"totalRulesChecked":${rules.length},"violationsCount":0,"potentialCount":0,"compliantCount":0,"recommendedAction":"คำแนะนำ"}`;

    const userContent: string | AiMessageContentPart[] = dto.imageBase64
      ? [
          { type: 'text', text: instructionText },
          { type: 'image_url', image_url: { url: `data:${dto.imageMimeType ?? 'image/jpeg'};base64,${dto.imageBase64}` } },
        ]
      : instructionText;

    try {
      const result = await this.aiCompletion.createChatCompletion({
        correlationId,
        responseFormatJson: true,
        temperature: 0.1,
        ...(model ? { model } : {}),
        messages: [
          {
            role: 'system',
            content: 'คุณเป็นผู้เชี่ยวชาญด้านการตรวจสอบการปฏิบัติตามกฎระเบียบ ตรวจสอบเนื้อหาหรือภาพที่ให้มากับกฎระเบียบทุกข้ออย่างละเอียดถี่ถ้วน ตอบกลับเป็น JSON เท่านั้น ห้ามเพิ่มข้อความอื่นนอกจาก JSON',
          },
          { role: 'user', content: userContent },
        ],
      });

      const parsed = JSON.parse(result.content) as AiComplianceResponse;
      if (!parsed.overallStatus || !Array.isArray(parsed.findings)) {
        throw new Error('Invalid AI response structure');
      }

      // Recalculate counts from findings to ensure consistency
      const violationsCount = parsed.findings.filter((f) => f.status === 'VIOLATED').length;
      const potentialCount = parsed.findings.filter((f) => f.status === 'POTENTIAL').length;
      const compliantCount = parsed.findings.filter((f) => f.status === 'COMPLIANT').length;

      return { ...parsed, violationsCount, potentialCount, compliantCount, totalRulesChecked: rules.length };
    } catch (error) {
      this.logger.error({ msg: 'AI compliance check failed, falling back to human review', correlationId, error });
      return {
        overallStatus: 'AMBIGUOUS',
        summary: 'การวิเคราะห์ด้วย AI ไม่สำเร็จ กรุณาส่งให้ผู้ตรวจสอบพิจารณา',
        findings: [],
        totalRulesChecked: rules.length,
        violationsCount: 0,
        potentialCount: 0,
        compliantCount: 0,
        recommendedAction: 'ส่งให้ผู้ตรวจสอบพิจารณาโดยตรง',
      };
    }
  }

  private async resolveRulebook(rulebookId?: string) {
    const rulebook = rulebookId
      ? await this.prisma.masterRulebook.findUnique({ where: { id: rulebookId } })
      : await this.prisma.masterRulebook.findFirst({
          where: { versions: { some: { status: { in: [RulebookStatus.APPROVED, RulebookStatus.PUBLISHED] } } } },
          orderBy: { createdAt: 'desc' },
        });
    if (!rulebook) {
      throw new NotFoundException({ code: 'RULEBOOK_NOT_FOUND', message: 'Select a rulebook before checking compliance. Approve at least one AI result first.' });
    }
    return rulebook;
  }

  private sha256(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }
}