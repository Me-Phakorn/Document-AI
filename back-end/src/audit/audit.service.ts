import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditRecordInput {
  actorId?: string;
  actorType?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: Prisma.InputJsonValue;
  nextState?: Prisma.InputJsonValue;
  correlationId: string;
  requestMetadata?: Prisma.InputJsonValue;
  reason?: string;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, limit, offset };
  }

  async record(input: AuditRecordInput, tx: Prisma.TransactionClient = this.prisma) {
    return tx.auditLog.create({
      data: {
        actorId: input.actorId,
        actorType: input.actorType ?? 'USER',
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        previousState: input.previousState,
        nextState: input.nextState,
        correlationId: input.correlationId,
        requestMetadata: input.requestMetadata,
        reason: input.reason,
      },
    });
  }
}