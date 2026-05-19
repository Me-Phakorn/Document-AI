import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RulebookController } from './rulebook.controller';
import { RulebookService } from './rulebook.service';

@Module({
  imports: [AuditModule],
  controllers: [RulebookController],
  providers: [RulebookService],
  exports: [RulebookService],
})
export class RulebookModule {}