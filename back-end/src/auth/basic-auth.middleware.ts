import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type { ConfigService } from '@nestjs/config';

interface BasicAuthCredentials {
  username: string;
  password: string;
}

type BasicAuthRequest = IncomingMessage & { headers: IncomingHttpHeaders };
type BasicAuthResponse = ServerResponse & {
  status(statusCode: number): BasicAuthResponse;
  json(body: unknown): void;
};
type BasicAuthNext = () => void;
type BasicAuthMiddleware = (request: BasicAuthRequest, response: BasicAuthResponse, next: BasicAuthNext) => void;

export function createBasicAuthMiddleware(config: ConfigService): BasicAuthMiddleware {
  const enabled = readBoolean(config.get<string>('BASIC_AUTH_ENABLED'), true);
  const username = config.get<string>('BASIC_AUTH_USERNAME') ?? fallbackCredential();
  const password = config.get<string>('BASIC_AUTH_PASSWORD') ?? fallbackCredential();
  const realm = config.get<string>('BASIC_AUTH_REALM', 'DocAI');

  return (request, response, next) => {
    if (!enabled) {
      next();
      return;
    }

    const credentials = parseBasicAuthorization(normalizeHeader(request.headers.authorization));
    if (credentials && username && password && credentialsMatch(credentials, { username, password })) {
      next();
      return;
    }

    response.setHeader('WWW-Authenticate', `Basic realm="${escapeRealm(realm)}"`);
    response.status(401).json({
      statusCode: 401,
      code: 'AUTH_BASIC_REQUIRED',
      message: 'Basic authentication is required.',
    });
  };
}

function parseBasicAuthorization(header: string | undefined): BasicAuthCredentials | null {
  if (!header) {
    return null;
  }

  const [scheme, encodedCredentials] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encodedCredentials) {
    return null;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function normalizeHeader(header: string | string[] | undefined): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

function credentialsMatch(actual: BasicAuthCredentials, expected: BasicAuthCredentials): boolean {
  return constantTimeEqual(actual.username, expected.username) && constantTimeEqual(actual.password, expected.password);
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const maxLength = Math.max(actualBuffer.length, expectedBuffer.length);
  const actualPadded = Buffer.alloc(maxLength);
  const expectedPadded = Buffer.alloc(maxLength);

  actualBuffer.copy(actualPadded);
  expectedBuffer.copy(expectedPadded);

  return timingSafeEqual(actualPadded, expectedPadded) && actualBuffer.length === expectedBuffer.length;
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function fallbackCredential(): string | undefined {
  return process.env.NODE_ENV === 'production' ? undefined : 'admin';
}

function escapeRealm(realm: string): string {
  return realm.replace(/["\\]/g, '');
}