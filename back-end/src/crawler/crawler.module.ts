import { Module } from '@nestjs/common';
import { BotFipcsCrawlerService } from './bot-fipcs-crawler.service';

@Module({
  providers: [BotFipcsCrawlerService],
  exports: [BotFipcsCrawlerService],
})
export class CrawlerModule {}
