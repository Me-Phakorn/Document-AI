import { existsSync } from 'node:fs';
import type { NextRequest } from 'next/server';
import puppeteer from 'puppeteer-core';
import { authTokenCookieName } from '@/lib/auth';

const CHROME_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean) as string[];

function findChrome(): string {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error('Chrome or Chromium not found. Install Google Chrome or set the CHROME_EXECUTABLE_PATH environment variable.');
  }
  return found;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');
  const titleParam = searchParams.get('title');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  let executablePath: string;
  try {
    executablePath = findChrome();
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const printUrl = `${appUrl}/compliance/print/${encodeURIComponent(id)}`;

  const token = req.cookies.get(authTokenCookieName)?.value;

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    if (token) {
      const cookieDomain = new URL(appUrl).hostname;
      await page.setCookie({
        name: authTokenCookieName,
        value: token,
        domain: cookieDomain,
        httpOnly: false,
        path: '/',
      });
    }

    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Allow React effects and lazy rendering to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 600));

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    const rawTitle = titleParam ? decodeURIComponent(titleParam) : '';
    const safeTitle = rawTitle.replace(/[<>:"/\\|?*]/g, '').slice(0, 80).trim();
    const filename = safeTitle ? `${safeTitle}.pdf` : `compliance-${id.slice(0, 8)}.pdf`;

    return new Response(new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' }), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    await browser.close();
  }
}
