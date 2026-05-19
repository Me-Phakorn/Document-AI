import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface BasicAuthCredentials {
  username: string;
  password: string;
}

export function middleware(request: NextRequest) {
  if (!isBasicAuthEnabled()) {
    return NextResponse.next();
  }

  const expectedCredentials = getExpectedCredentials();
  const actualCredentials = parseBasicAuthorization(request.headers.get('authorization'));

  if (actualCredentials && credentialsMatch(actualCredentials, expectedCredentials)) {
    return NextResponse.next();
  }

  return new NextResponse('Basic authentication is required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${escapeRealm(process.env.BASIC_AUTH_REALM ?? 'DocAI')}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};

function isBasicAuthEnabled(): boolean {
  return readBoolean(process.env.BASIC_AUTH_ENABLED, true);
}

function getExpectedCredentials(): BasicAuthCredentials {
  return {
    username: process.env.BASIC_AUTH_USERNAME ?? fallbackCredential(),
    password: process.env.BASIC_AUTH_PASSWORD ?? fallbackCredential(),
  };
}

function parseBasicAuthorization(header: string | null): BasicAuthCredentials | null {
  if (!header) {
    return null;
  }

  const [scheme, encodedCredentials] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encodedCredentials) {
    return null;
  }

  let decoded: string;
  try {
    decoded = atob(encodedCredentials);
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

function credentialsMatch(actual: BasicAuthCredentials, expected: BasicAuthCredentials): boolean {
  return constantTimeEqual(actual.username, expected.username) && constantTimeEqual(actual.password, expected.password);
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  const maxLength = Math.max(actualBytes.length, expectedBytes.length);
  let difference = actualBytes.length ^ expectedBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }

  return difference === 0;
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function fallbackCredential(): string {
  return process.env.NODE_ENV === 'production' ? '' : 'admin';
}

function escapeRealm(realm: string): string {
  return realm.replace(/["\\]/g, '');
}