'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authTokenCookieName, normalizeNextPath } from '@/lib/auth';
import { buildApiUrl } from '@/lib/api-client';

export interface LoginFormState {
  errorMessage: string | null;
}

export async function loginAction(_previousState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const username = formData.get('username')?.toString().trim() ?? '';
  const password = formData.get('password')?.toString() ?? '';
  const nextPath = normalizeNextPath(formData.get('nextPath')?.toString(), '/dashboard');

  if (!username || !password) {
    return { errorMessage: 'Enter both username and password.' };
  }

  const response = await fetch(buildApiUrl('/auth/login'), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !isLoginPayload(payload)) {
    return {
      errorMessage:
        payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
          ? payload.message
          : 'Login failed. Check your credentials and try again.',
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(authTokenCookieName, payload.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: payload.expiresInSeconds,
  });

  redirect(nextPath);
}

function isLoginPayload(value: unknown): value is { accessToken: string; expiresInSeconds: number } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'accessToken' in value &&
      typeof value.accessToken === 'string' &&
      'expiresInSeconds' in value &&
      typeof value.expiresInSeconds === 'number',
  );
}