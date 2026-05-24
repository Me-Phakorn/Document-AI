import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePromptTemplateDto {
  @ApiProperty({ type: String, example: 'Thai regulatory rule extraction' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ type: String, example: 'banking-regulation' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  domain?: string;

  @ApiPropertyOptional({ type: [String], example: ['thai', 'rule-extraction'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

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