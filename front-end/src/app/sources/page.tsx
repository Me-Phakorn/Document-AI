import { Globe2, Play, Radar } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { createWebsiteSource, listWebsiteSources, triggerWebsiteSourceScan } from '@/lib/api/sources';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const defaultBotFipcsUrl = 'https://app.bot.or.th/FIPCS/Thai/PFIPCS_list.aspx';

async function createSourceAction(formData: FormData) {
  'use server';
  const name = formData.get('name')?.toString().trim();
  const baseUrl = formData.get('baseUrl')?.toString().trim();
  if (!name || !baseUrl) return;

  const maxPages = Number.parseInt(formData.get('maxPages')?.toString() ?? '2', 10);
  const maxDocumentsValue = formData.get('maxDocuments')?.toString().trim();

  await createWebsiteSource({
    name,
    baseUrl,
    domain: formData.get('domain')?.toString().trim() || undefined,
    maxPages: Number.isFinite(maxPages) ? maxPages : 2,
    maxDocuments: maxDocumentsValue ? Number.parseInt(maxDocumentsValue, 10) : undefined,
    isActive: true,
  });
  revalidatePath('/sources');
}

async function triggerScanAction(formData: FormData) {
  'use server';
  const sourceId = formData.get('sourceId')?.toString();
  if (!sourceId) return;
  await triggerWebsiteSourceScan(sourceId);
  revalidatePath('/sources');
  revalidatePath('/documents');
}

export default async function SourcesPage() {
  const sources = await listWebsiteSources({ limit: 25 });

  return (
    <div>
      <PageHeader
        eyebrow="Sources"
        title="URL and PDF source ingestion"
        description="Create website sources and trigger the real BOT FIPCS crawler to download PDFs, store originals, extract OCR text, and update scan history."
      />

      <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
        <div className="flex items-center gap-2 text-accent">
          <Globe2 size={17} aria-hidden="true" />
          <h2 className="font-semibold text-t1">Website source</h2>
        </div>
        <form action={createSourceAction} className="mt-4 grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">Name</span>
              <input required name="name" defaultValue="BOT FIPCS Thai Notices" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
            </label>
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">Source URL</span>
              <input required type="url" name="baseUrl" defaultValue={defaultBotFipcsUrl} className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">Domain</span>
              <input name="domain" defaultValue="banking-regulation" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
            </label>
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">Pages</span>
              <input name="maxPages" type="number" min="1" max="20" defaultValue="2" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
            </label>
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">Document limit</span>
              <input name="maxDocuments" type="number" min="1" max="200" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
            </label>
          </div>
          <button className="inline-flex w-fit items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><Radar size={15} />Save Source</button>
        </form>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-t1">Configured sources</h2>
        </div>
        <div className="divide-y divide-border">
          {sources.items.map((source) => (
            <article key={source.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-t1">{source.name}</span>
                  <span className="rounded bg-raised px-2 py-1 text-xs text-t2">{source.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                  {source.domain ? <span className="text-xs text-t3">{source.domain}</span> : null}
                </div>
                <p className="mt-1 break-all text-sm text-t2">{source.baseUrl}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {source.scans.map((scan) => (
                    <div key={scan.id} className="rounded-md border border-border bg-raised p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-t1">{scan.status}</span>
                        <span className="text-xs text-t3">{formatDateTime(scan.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-t2">discovered {scan.discoveredCount} · imported {scan.importedCount} · duplicate {scan.duplicateCount}</p>
                      {scan.failureReason ? <p className="mt-2 text-red">{scan.failureReason}</p> : null}
                    </div>
                  ))}
                  {!source.scans.length ? <div className="rounded-md border border-dashed border-border bg-raised p-3 text-sm text-t2">No scans yet.</div> : null}
                </div>
              </div>
              <form action={triggerScanAction}>
                <input type="hidden" name="sourceId" value={source.id} />
                <button className="inline-flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-sm font-medium text-t2"><Play size={14} />Run Scan</button>
              </form>
            </article>
          ))}
          {!sources.items.length ? <div className="px-4 py-12 text-center text-sm text-t2">No website sources have been configured yet.</div> : null}
        </div>
      </section>
    </div>
  );
}