import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ type: String, example: 'admin' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  username!: string;

  @ApiProperty({ type: String, example: 'admin' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}