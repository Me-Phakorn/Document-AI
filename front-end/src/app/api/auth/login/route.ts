import { type NextRequest, NextResponse } from 'next/server';
import { authTokenCookieName, normalizeNextPath } from '@/lib/auth';
import { buildApiUrl } from '@/lib/api-client';

interface LoginPayload {
  accessToken: string;
  expiresInSeconds: number;
}

function isLoginPayload(value: unknown): value is LoginPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'accessToken' in value &&
      typeof (value as Record<string, unknown>).accessToken === 'string' &&
      'expiresInSeconds' in value &&
      typeof (value as Record<string, unknown>).expiresInSeconds === 'number',
  );
}

export async function POST(request: NextRequest) {
  let username = '';
  let password = '';
  let nextPath = '/dashboard';

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json()) as Record<string, unknown>;
    username = typeof body.username === 'string' ? body.username.trim() : '';
    password = typeof body.password === 'string' ? body.password : '';
    nextPath = normalizeNextPath(typeof body.nextPath === 'string' ? body.nextPath : null);
  } else {
    const formData = await request.formData();
    username = formData.get('username')?.toString().trim() ?? '';
    password = formData.get('password')?.toString() ?? '';
    nextPath = normalizeNextPath(formData.get('nextPath')?.toString());
  }

  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
  const origin = `${proto}://${host}`;

  if (!username || !password) {
    const params = new URLSearchParams({ error: 'Enter both username and password.', next: nextPath });
    return NextResponse.redirect(new URL(`/login?${params}`, origin));
  }

  let payload: unknown;
  try {
    const res = await fetch(buildApiUrl('/auth/login'), {
      method: 'POST',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    payload = await res.json();
    if (!res.ok) {
      const error =
        payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
          ? (payload.message as string)
          : 'Login failed. Check your credentials and try again.';
      const params = new URLSearchParams({ error, next: nextPath });
      return NextResponse.redirect(new URL(`/login?${params}`, origin));
    }
  } catch {
    const params = new URLSearchParams({ error: 'Backend unavailable. Try again later.', next: nextPath });
    return NextResponse.redirect(new URL(`/login?${params}`, origin));
  }

  if (!isLoginPayload(payload)) {
    const params = new URLSearchParams({ error: 'Unexpected response from server.', next: nextPath });
    return NextResponse.redirect(new URL(`/login?${params}`, origin));
  }

  const redirectResponse = NextResponse.redirect(new URL(nextPath, origin));
  redirectResponse.cookies.set(authTokenCookieName, payload.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: payload.expiresInSeconds,
  });

  return redirectResponse;
}
