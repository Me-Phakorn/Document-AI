import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ type: String, example: 'reviewer2@docai.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: String, example: 'Reviewer Two' })
  @IsString()
  @MaxLength(160)
  displayName!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  @IsEnum(UserRole)
  role!: UserRole;
}