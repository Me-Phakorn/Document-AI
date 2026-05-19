import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class CreatePromptVersionDto {
  @ApiProperty({ type: String })
  @IsString()
  templateText!: string;

  @ApiPropertyOptional({ type: [String], example: ['documentTitle', 'ocrText'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  variables?: string[];
}