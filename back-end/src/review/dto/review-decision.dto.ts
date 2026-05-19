import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDecisionDto {
  @ApiPropertyOptional({ type: String, example: 'Reviewed against source text and citations.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}