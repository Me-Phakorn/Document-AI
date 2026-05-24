import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { authTokenCookieName } from '@/lib/auth';

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const versionId = request.nextUrl.searchParams.get('versionId');
  if (!versionId || !/^[0-9a-f-]{36}$/i.test(versionId)) {
    return NextResponse.json({ error: 'Invalid versionId' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(authTokenCookieName)?.value;
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Step 1 — generate the report on the backend
  const generateRes = await fetch(
    `${apiBase}/reports/rulebook-versions/${encodeURIComponent(versionId)}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: '{}',
      cache: 'no-store',
    },
  );

  if (!generateRes.ok) {
    const text = await generateRes.text().catch(() => '');
    return NextResponse.json({ error: 'Backend report generation failed', detail: text }, { status: generateRes.status });
  }

  const report = (await generateRes.json()) as {
    exports?: Array<{ id: string; status: string }>;
  };

  const completedExport = report.exports?.find((e) => e.status === 'COMPLETED');
  if (!completedExport) {
    return NextResponse.json({ error: 'Export not yet completed' }, { status: 503 });
  }

  // Step 2 — retrieve the export content
  const exportRes = await fetch(
    `${apiBase}/reports/exports/${encodeURIComponent(completedExport.id)}`,
    { headers: { ...authHeader }, cache: 'no-store' },
  );

  if (!exportRes.ok) {
    return NextResponse.json({ error: 'Failed to retrieve export content' }, { status: exportRes.status });
  }

  const exportData = (await exportRes.json()) as { content: unknown };
  const body = JSON.stringify(exportData.content, null, 2);
  const slug = versionId.slice(0, 8);

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="rulebook-export-${slug}.json"`,
    },
  });
}
