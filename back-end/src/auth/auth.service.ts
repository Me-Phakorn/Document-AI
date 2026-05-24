import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtTokenService) private readonly tokens: JwtTokenService,
  ) {}

  async login(dto: LoginDto) {
    const username = typeof dto.username === 'string' ? dto.username.trim() : '';
    const password = typeof dto.password === 'string' ? dto.password : '';

    if (!username || !password) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid username or password.' });
    }

    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid username or password.' });
    }

    const issued = this.tokens.issueAccessToken({ subject: user.id, username: user.username!, role: user.role });

    return {
      tokenType: 'Bearer',
      accessToken: issued.token,
      expiresInSeconds: issued.expiresInSeconds,
      expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }
}

function verifyPassword(plain: string, stored: string): boolean {
  const colonIndex = stored.lastIndexOf(':');
  if (colonIndex === -1) return false;
  const hash = stored.slice(0, colonIndex);
  const salt = stored.slice(colonIndex + 1);
  try {
    const input = scryptSync(plain, salt, 64);
    return timingSafeEqual(input, Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}