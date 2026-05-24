import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtTokenService } from './jwt-token.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, JwtTokenService],
  exports: [JwtAuthGuard, JwtTokenService],
})
export class AuthModule {}