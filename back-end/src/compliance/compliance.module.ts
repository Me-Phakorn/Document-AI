import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

@Module({
  imports: [AuditModule, AnalysisModule, StorageModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
})
export class ComplianceModule {}