import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SourceType } from '@prisma/client';
import { IsBase64, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ type: String, example: 'BOT FIPCS notice' })
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiProperty({ enum: SourceType, default: SourceType.UPLOAD })
  @IsEnum(SourceType)
  sourceType: SourceType = SourceType.UPLOAD;

  @ApiPropertyOptional({ type: String, example: 'banking-regulation' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  domain?: string;

  @ApiPropertyOptional({ type: String, example: 'https://example.com/source.pdf' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  sourceUrl?: string;

  @ApiProperty({ type: String, example: 'notice.pdf' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiPropertyOptional({ type: String, default: 'application/pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiProperty({ type: String, description: 'Base64 encoded PDF bytes, without data URI prefix.' })
  @IsString()
  @IsBase64()
  contentBase64!: string;
}