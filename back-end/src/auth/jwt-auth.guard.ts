import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IncomingHttpHeaders } from 'node:http';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtTokenService } from './jwt-token.service';

interface AuthRequest {
  headers: IncomingHttpHeaders & { authorization?: string };
  method: string;
  user?: { id: string; username: string; role: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtTokenService) private readonly tokens: JwtTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_REQUIRED', message: 'JWT authentication is required.' });
    }

    try {
      const payload = this.tokens.verifyAccessToken(token);
      request.user = { id: payload.sub, username: payload.username, role: payload.role };
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid or expired token.';
      throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message });
    }
  }

  private extractBearerToken(authorization: string | string[] | undefined): string | null {
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
