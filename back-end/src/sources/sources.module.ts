import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CrawlerModule } from '../crawler/crawler.module';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  imports: [AuditModule, CrawlerModule],
  controllers: [SourcesController],
  providers: [SourcesService],
})
export class SourcesModule {}