import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateOcrTextDto {
  @ApiProperty({ type: String, description: 'New OCR text content (may be empty string to clear)' })
  @IsString()
  text!: string;
}
