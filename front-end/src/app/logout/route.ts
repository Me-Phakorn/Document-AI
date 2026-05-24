import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authTokenCookieName } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete(authTokenCookieName);
  return response;
}