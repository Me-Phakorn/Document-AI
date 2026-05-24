import { ApiProperty } from '@nestjs/swagger';

class AuthenticatedUserDto {
  @ApiProperty({ type: String, example: 'local-admin' })
  id!: string;

  @ApiProperty({ type: String, example: 'admin' })
  username!: string;

  @ApiProperty({ type: String, example: 'Administrator' })
  displayName!: string;

  @ApiProperty({ type: String, example: 'ADMIN' })
  role!: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: String, example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ type: String, example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ type: Number, example: 28800 })
  expiresInSeconds!: number;

  @ApiProperty({ type: String, example: '2026-05-20T08:30:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;
}