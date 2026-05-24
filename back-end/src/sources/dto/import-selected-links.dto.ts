import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUrl, Min, ValidateNested } from 'class-validator';

export class SelectedLinkDto {
  @ApiProperty({ description: 'Full PDF download URL' })
  @IsString()
  @IsUrl({ require_protocol: true })
  pdfUrl!: string;

  @ApiProperty({ description: 'Document title extracted from the source page' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Page number in the source list where this link was found' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  listPage?: number;

  @ApiPropertyOptional({ description: 'Unique ID (packId) from the source page' })
  @IsOptional()
  @IsString()
  packId?: string;

  @ApiPropertyOptional({ description: 'Document type (Circular, Notification, etc.)' })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({ description: 'Original date text from the source (Thai format)' })
  @IsOptional()
  @IsString()
  sourceDocumentDateText?: string;

  @ApiPropertyOptional({ description: 'ISO date string parsed from the source date text' })
  @IsOptional()
  @IsString()
  sourceDocumentDate?: string;

  @ApiPropertyOptional({ description: 'Status / approval text from source' })
  @IsOptional()
  @IsString()
  statusText?: string;

  @ApiPropertyOptional({ description: 'Language tag (th, en, …)' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Related document URL if present' })
  @IsOptional()
  @IsString()
  relatedDocumentUrl?: string;
}

export class ImportSelectedLinksDto {
  @ApiProperty({ type: [SelectedLinkDto], description: 'List of pre-crawled PDF links to import' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SelectedLinkDto)
  links!: SelectedLinkDto[];
}
