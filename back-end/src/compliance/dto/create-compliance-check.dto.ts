import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplianceInputType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateComplianceCheckDto {
  @ApiPropertyOptional({ enum: ComplianceInputType, default: ComplianceInputType.TEXT })
  @IsOptional()
  @IsEnum(ComplianceInputType)
  inputType?: ComplianceInputType;

  @ApiPropertyOptional({ type: String, description: 'Text content to check (required if imageBase64 is not provided).' })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  content?: string;

  @ApiPropertyOptional({ type: String, description: 'Base64-encoded image for AI vision analysis.' })
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @ApiPropertyOptional({ type: String, description: 'MIME type of the uploaded image.', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] })
  @IsOptional()
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  imageMimeType?: string;

  @ApiPropertyOptional({ type: String, description: 'Optional focus prompt to guide AI analysis.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  focusPrompt?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  selectedRulebookId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  selectedReportId?: string;

  @ApiPropertyOptional({ type: String, example: 'Campaign Q2 landing page copy' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional({ type: String, example: 'google/gemini-2.0-flash', description: 'Override the default AI model for this check.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;
}