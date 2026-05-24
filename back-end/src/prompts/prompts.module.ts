import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { AuditModule } from '../audit/audit.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

@Module({
  imports: [AnalysisModule, AuditModule],
  controllers: [PromptsController],
  providers: [PromptsService],
})
export class PromptsModule {}