import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalysisModule } from './analysis/analysis.module';
import { AuditModule } from './audit/audit.module';
import { ComplianceModule } from './compliance/compliance.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { PromptsModule } from './prompts/prompts.module';
import { ReportsModule } from './reports/reports.module';
import { ReviewModule } from './review/review.module';
import { RulebookModule } from './rulebook/rulebook.module';
import { SourcesModule } from './sources/sources.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    PrismaModule,
    AuditModule,
    StorageModule,
    AnalysisModule,
    DocumentsModule,
    ComplianceModule,
    ReviewModule,
    RulebookModule,
    ReportsModule,
    SourcesModule,
    PromptsModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}