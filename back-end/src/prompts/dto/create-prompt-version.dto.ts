import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePromptVersionDto {
  @ApiProperty({ type: String })
  @IsString()
  templateText!: string;

  @ApiPropertyOptional({ type: String, example: 'anthropic/claude-3.5-sonnet' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  aiModel?: string;

  @ApiPropertyOptional({ type: [String], example: ['documentTitle', 'ocrText'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  variables?: string[];
}