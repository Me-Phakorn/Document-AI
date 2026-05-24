import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { AuditModule } from '../audit/audit.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [AuditModule, AnalysisModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}