import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authTokenCookieName, normalizeNextPath, verifySessionToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login';
  const isLogoutRoute = pathname === '/logout';
  const token = request.cookies.get(authTokenCookieName)?.value ?? null;
  const session = await verifySessionToken(token);

  if (isLogoutRoute) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    if (session) {
      const destination = new URL(normalizeNextPath(request.nextUrl.searchParams.get('next')), request.url);
      return NextResponse.redirect(destination);
    }

    const response = NextResponse.next();
    if (token) {
      response.cookies.delete(authTokenCookieName);
    }
    return response;
  }

  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname === '/' ? '/dashboard' : `${pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  if (token) {
    response.cookies.delete(authTokenCookieName);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};