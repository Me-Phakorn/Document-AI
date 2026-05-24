import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SourceType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min } from 'class-validator';

export class RegisterDocumentDto {
  @ApiProperty({ type: String, example: 'ประกาศ ธปท.นว.(ว) 8/2567' })
  @IsString()
  title!: string;

  @ApiProperty({ enum: SourceType, enumName: 'SourceType' })
  @IsEnum(SourceType)
  sourceType!: SourceType;

  @ApiPropertyOptional({ type: String, example: 'credit' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ type: String, example: 'https://app.bot.or.th/example.pdf' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  sourceUrl?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', example: '2026-05-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  sourceDocumentDate?: string;

  @ApiPropertyOptional({ type: String, example: '20 พ.ค. 2569' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceDocumentDateText?: string;

  @ApiPropertyOptional({ type: String, example: 'bot-notice-8-2567.pdf' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ type: String, example: 'application/pdf' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ type: Number, example: 2450000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(250_000_000)
  byteSize?: number;

  @ApiProperty({ type: String, example: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' })
  @Matches(/^[a-fA-F0-9]{64}$/)
  fileSha256!: string;

  @ApiPropertyOptional({ type: String, example: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd' })
  @IsOptional()
  @Matches(/^[a-fA-F0-9]{64}$/)
  contentSha256?: string;
}