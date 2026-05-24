import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export interface JwtAccessTokenPayload {
  sub: string;
  username: string;
  role: string;
  type: 'access';
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

interface AccessTokenInput {
  subject: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtTokenService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  issueAccessToken(input: AccessTokenInput) {
    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = this.getExpiresInSeconds();
    const payload: JwtAccessTokenPayload = {
      sub: input.subject,
      username: input.username,
      role: input.role,
      type: 'access',
      jti: randomUUID(),
      iss: this.getIssuer(),
      aud: this.getAudience(),
      iat: now,
      exp: now + expiresInSeconds,
    };

    return {
      token: this.sign(payload),
      payload,
      expiresInSeconds,
    };
  }

  verifyAccessToken(token: string) {
    const payload = this.verify(token);
    if (payload.type !== 'access') {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message: 'JWT token type is invalid.' });
    }

    return payload;
  }

  private sign(payload: JwtAccessTokenPayload) {
    const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncodeJson(header);
    const encodedPayload = base64UrlEncodeJson(payload);
    const signature = this.signValue(`${encodedHeader}.${encodedPayload}`);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verify(token: string) {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message: 'JWT token format is invalid.' });
    }

    const header = parseJsonSegment<JwtHeader>(encodedHeader, 'AUTH_INVALID_TOKEN', 'JWT header is invalid.');
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message: 'JWT algorithm is not supported.' });
    }

    const expectedSignature = this.signValue(`${encodedHeader}.${encodedPayload}`);
    if (!safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message: 'JWT signature is invalid.' });
    }

    const payload = parseJsonSegment<JwtAccessTokenPayload>(encodedPayload, 'AUTH_INVALID_TOKEN', 'JWT payload is invalid.');
    const now = Math.floor(Date.now() / 1000);

    if (payload.iss !== this.getIssuer() || payload.aud !== this.getAudience()) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message: 'JWT token audience is invalid.' });
    }
    if (payload.exp <= now) {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_EXPIRED', message: 'JWT token has expired.' });
    }
    if (!payload.sub || !payload.username || !payload.role || !payload.jti) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message: 'JWT token payload is incomplete.' });
    }

    return payload;
  }

  private signValue(value: string) {
    return toBase64Url(createHmac('sha256', this.getSecret()).update(value).digest());
  }

  private getSecret() {
    return this.config.get<string>('JWT_SECRET') || fallbackSecret();
  }

  private getIssuer() {
    return this.config.get<string>('JWT_ISSUER', 'docai.local');
  }

  private getAudience() {
    return this.config.get<string>('JWT_AUDIENCE', 'docai-admin');
  }

  private getExpiresInSeconds() {
    const value = Number.parseInt(this.config.get<string>('JWT_EXPIRES_IN_SECONDS', '28800'), 10);
    return Number.isFinite(value) && value > 0 ? value : 28_800;
  }
}

function parseJsonSegment<T>(segment: string, code: string, message: string): T {
  try {
    return JSON.parse(base64UrlDecode(segment)) as T;
  } catch {
    throw new UnauthorizedException({ code, message });
  }
}

function base64UrlEncodeJson(value: object) {
  return toBase64Url(Buffer.from(JSON.stringify(value), 'utf8'));
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function toBase64Url(value: Buffer) {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function fallbackSecret() {
  return process.env.NODE_ENV === 'production' ? 'change-me-in-production' : 'docai-local-jwt-secret';
}