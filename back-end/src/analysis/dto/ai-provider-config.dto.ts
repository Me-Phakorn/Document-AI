import { ApiProperty } from '@nestjs/swagger';

export class AiProviderConfigDto {
  @ApiProperty({ type: String, example: 'openrouter' })
  provider!: string;

  @ApiProperty({ type: String, example: 'claude-code', required: false })
  fallbackProvider?: string;

  @ApiProperty({ type: String, example: 'openai/gpt-4o-mini' })
  model!: string;

  @ApiProperty({ type: String, example: 'https://openrouter.ai/api/v1' })
  baseUrl!: string;

  @ApiProperty({ type: Boolean, example: false })
  apiKeyConfigured!: boolean;

  @ApiProperty({ type: Number, example: 60000 })
  requestTimeoutMs!: number;

  @ApiProperty({ type: String, example: 'DocAI' })
  appTitle!: string;

  @ApiProperty({ type: Boolean, example: true })
  httpRefererConfigured!: boolean;

  @ApiProperty({ type: Boolean, example: true })
  claudeCodeConfigured!: boolean;

  @ApiProperty({ type: String, example: 'claude' })
  claudeCodeCommand!: string;

  @ApiProperty({ type: String, example: 'sonnet' })
  claudeCodeModel!: string;

  @ApiProperty({ type: Number, example: 120000 })
  claudeCodeTimeoutMs!: number;
}