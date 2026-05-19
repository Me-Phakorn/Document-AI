import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class CreateWebsiteSourceDto {
  @ApiProperty({ type: String, example: 'BOT FIPCS Thai Notices' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ type: String, example: 'https://app.bot.or.th/FIPCS/Thai/PFIPCS_list.aspx' })
  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @ApiPropertyOptional({ type: String, example: 'banking-regulation' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  domain?: string;

  @ApiPropertyOptional({ type: Number, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxPages?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxDocuments?: number;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}