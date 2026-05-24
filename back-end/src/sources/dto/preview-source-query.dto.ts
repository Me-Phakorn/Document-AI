import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PreviewSourceQueryDto {
  @ApiPropertyOptional({ description: 'First page to preview (default 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  startPage?: number;

  @ApiPropertyOptional({ description: 'Last page to preview (default: first page only)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  endPage?: number;

  @ApiPropertyOptional({ description: 'Maximum number of links to return (default 50)', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxDocuments?: number;
}
