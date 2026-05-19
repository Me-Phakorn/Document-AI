import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

@Module({
  imports: [AuditModule],
  controllers: [PromptsController],
  providers: [PromptsService],
})
export class PromptsModule {}