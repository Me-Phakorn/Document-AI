import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplianceInputType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateComplianceCheckDto {
  @ApiProperty({ enum: ComplianceInputType, default: ComplianceInputType.TEXT })
  @IsEnum(ComplianceInputType)
  inputType: ComplianceInputType = ComplianceInputType.TEXT;

  @ApiProperty({ type: String, description: 'Text content or extracted content to check.' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  selectedRulebookVersionId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  selectedReportId?: string;

  @ApiPropertyOptional({ type: String, example: 'Campaign Q2 landing page copy' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;
}