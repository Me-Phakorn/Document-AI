import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus, SourceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class DocumentsListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DocumentStatus, description: 'Filter by document version status' })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({ enum: SourceType, description: 'Filter by document source type (UPLOAD vs WEBSITE_SCAN vs API)' })
  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;

  @ApiPropertyOptional({ type: String, maxLength: 200, description: 'Case-insensitive title search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    description: 'Comma-separated document statuses to exclude from results',
    example: 'UPLOADED,AI_PROCESSING',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^[A-Z_]+(,[A-Z_]+)*$/, { message: 'ignore must be a comma-separated list of uppercase status names' })
  ignore?: string;
}
