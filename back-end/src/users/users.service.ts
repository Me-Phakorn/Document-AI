import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

interface UserContext {
  actorId?: string;
  correlationId: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
      this.prisma.user.count(),
    ]);
    return { items, total, limit, offset };
  }

  async create(dto: CreateUserDto, context: UserContext) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({ code: 'USER_EMAIL_EXISTS', message: 'A user with this email already exists.' });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: dto });
      await this.audit.record({
        actorId: context.actorId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        nextState: user as unknown as Prisma.InputJsonValue,
        correlationId: context.correlationId,
      }, tx);
      return user;
    });
  }
}