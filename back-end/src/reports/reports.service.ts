import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExportFormat, ExportStatus, ReportStatus, ReportType, StoredObjectLifecycleStatus } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MinioStorageService } from '../storage/minio-storage.service';
import { ObjectKeyService } from '../storage/object-key.service';

interface ReportContext {
  actorId?: string;
  correlationId: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MinioStorageService) private readonly storage: MinioStorageService,
    @Inject(ObjectKeyService) private readonly objectKeys: ObjectKeyService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { exports: { orderBy: { createdAt: 'desc' } } },
      }),
      this.prisma.report.count(),
    ]);

    return { items, total, limit, offset };
  }

  async generateRulebookReport(masterRulebookVersionId: string, context: ReportContext) {
    const rulebookVersion = await this.prisma.masterRulebookVersion.findUnique({
      where: { id: masterRulebookVersionId },
      include: { masterRulebook: true, rules: { orderBy: { ruleCode: 'asc' } } },
    });
    if (!rulebookVersion) {
      throw new NotFoundException({ code: 'RULEBOOK_VERSION_NOT_FOUND', message: 'Rulebook version was not found.' });
    }

    const payload = {
      reportType: ReportType.RULE_EXTRACTION,
      generatedAt: new Date().toISOString(),
      rulebook: rulebookVersion.masterRulebook,
      version: { id: rulebookVersion.id, versionNumber: rulebookVersion.versionNumber, status: rulebookVersion.status },
      rules: rulebookVersion.rules,
    };

    return this.createReportWithJsonExport({
      reportType: ReportType.RULE_EXTRACTION,
      title: `${rulebookVersion.masterRulebook.title} v${rulebookVersion.versionNumber}`,
      masterRulebookVersionId,
      parameters: { source: 'rulebook-version', masterRulebookVersionId },
      payload,
      context,
    });
  }

  async generateComplianceReport(complianceCheckId: string, context: ReportContext) {
    const complianceCheck = await this.prisma.complianceCheck.findUnique({
      where: { id: complianceCheckId },
      include: { selectedRulebook: true, results: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!complianceCheck) {
      throw new NotFoundException({ code: 'COMPLIANCE_CHECK_NOT_FOUND', message: 'Compliance check was not found.' });
    }

    const payload = {
      reportType: ReportType.COMPLIANCE_USAGE,
      generatedAt: new Date().toISOString(),
      complianceCheck,
      latestResult: complianceCheck.results[0] ?? null,
    };

    return this.createReportWithJsonExport({
      reportType: ReportType.COMPLIANCE_USAGE,
      title: `Compliance check ${complianceCheck.id}`,
      complianceCheckId,
      parameters: { source: 'compliance-check', complianceCheckId },
      payload,
      context,
    });
  }

  async getExport(reportExportId: string) {
    const exportArtifact = await this.prisma.reportExport.findUnique({ where: { id: reportExportId }, include: { report: true } });
    if (!exportArtifact?.storedObjectId) {
      throw new NotFoundException({ code: 'REPORT_EXPORT_NOT_FOUND', message: 'Report export was not found.' });
    }
    const storedObject = await this.prisma.storedObject.findUnique({ where: { id: exportArtifact.storedObjectId } });
    if (!storedObject) {
      throw new NotFoundException({ code: 'REPORT_EXPORT_OBJECT_NOT_FOUND', message: 'Report export object metadata was not found.' });
    }

    const content = await this.storage.readTextObject(storedObject.bucket, storedObject.objectKey);
    return { export: exportArtifact, storedObject: { ...storedObject, byteSize: storedObject.byteSize.toString() }, content: JSON.parse(content) };
  }

  private async createReportWithJsonExport(input: {
    reportType: ReportType;
    title: string;
    masterRulebookVersionId?: string;
    complianceCheckId?: string;
    parameters: object;
    payload: object;
    context: ReportContext;
  }) {
    const exportId = randomUUID();
    const bucket = this.config.get<string>('MINIO_BUCKET_EXPORTS', 'exports');
    const objectKey = this.objectKeys.reportExport(exportId, 'json');
    const content = Buffer.from(JSON.stringify(input.payload, null, 2), 'utf8');
    const sha256 = this.sha256Buffer(content);
    const parametersHash = this.sha256(JSON.stringify(input.parameters));

    await this.storage.putObject({ bucket, objectKey, content, contentType: 'application/json; charset=utf-8', metadata: { 'x-amz-meta-sha256': sha256 } });

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          reportType: input.reportType,
          status: ReportStatus.COMPLETED,
          title: input.title,
          masterRulebookVersionId: input.masterRulebookVersionId,
          complianceCheckId: input.complianceCheckId,
          parameters: input.parameters,
          generatedById: input.context.actorId,
          generatedAt: new Date(),
        },
      });
      const exportArtifact = await tx.reportExport.create({
        data: { id: exportId, reportId: report.id, format: ExportFormat.JSON, status: ExportStatus.COMPLETED, parametersHash, completedAt: new Date() },
      });
      const storedObject = await tx.storedObject.create({
        data: {
          bucket,
          objectKey,
          fileName: `${report.id}.json`,
          contentType: 'application/json; charset=utf-8',
          byteSize: BigInt(content.byteLength),
          sha256,
          ownerType: 'ReportExport',
          ownerId: exportArtifact.id,
          lifecycleStatus: StoredObjectLifecycleStatus.CURRENT,
          metadata: { reportId: report.id, reportType: input.reportType },
        },
      });
      const completedExport = await tx.reportExport.update({ where: { id: exportArtifact.id }, data: { storedObjectId: storedObject.id } });
      await this.audit.record(
        {
          actorId: input.context.actorId,
          action: 'REPORT_GENERATED',
          entityType: 'Report',
          entityId: report.id,
          nextState: { reportType: input.reportType, status: report.status, exportId: completedExport.id, storedObjectId: storedObject.id },
          correlationId: input.context.correlationId,
        },
        tx,
      );

      return { ...report, exports: [completedExport] };
    });
  }

  private sha256(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }

  private sha256Buffer(input: Buffer) {
    return createHash('sha256').update(input).digest('hex');
  }
}