import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Check API health' })
  @ApiOkResponse({ description: 'The API is ready to receive requests.' })
  getHealth() {
    return {
      status: 'ok',
      service: 'docai-api',
      timestamp: new Date().toISOString(),
    };
  }
}