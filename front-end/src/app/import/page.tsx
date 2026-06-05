import { Globe2, Loader2, Play, Radar, UploadCloud } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { uploadDocument } from '@/lib/api/documents';
import { createWebsiteSource, listWebsiteSources, triggerWebsiteSourceScan } from '@/lib/api/sources';
import type { ScanDuplicateInfo } from '@/lib/api/source-types';
import { formatDateTime } from '@/lib/format';
import { importSelectedAction, previewSourceAction } from './actions';
import { ImportAutoRefresh } from './import-auto-refresh';
import { CrawlerPreviewPanel } from './crawler-preview-panel';
import { SubmitBtn } from './submit-btn';

export const dynamic = 'force-dynamic';

const defaultBotFipcsUrl = 'https://app.bot.or.th/FIPCS/Thai/PFIPCS_list.aspx';

async function uploadPdfAction(formData: FormData) {
  'use server';

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return;

  const title = formData.get('title')?.toString().trim() || file.name;
  const contentBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');

  await uploadDocument({ title, fileName: file.name, mimeType: file.type || 'application/pdf', contentBase64 });
  revalidatePath('/import');
  revalidatePath('/documents');
  revalidatePath('/dashboard');
  revalidatePath('/review');
}

async function createSourceAction(formData: FormData) {
  'use server';

  const name = formData.get('name')?.toString().trim();
  const baseUrl = formData.get('baseUrl')?.toString().trim();
  if (!name || !baseUrl) return;

  const startPage = parsePositiveInteger(formData.get('startPage')) ?? 1;
  const endPage = parsePositiveInteger(formData.get('endPage'));
  const maxDocuments = parsePositiveInteger(formData.get('maxDocuments'));

  await createWebsiteSource({
    name,
    baseUrl,
    startPage,
    endPage,
    maxDocuments,
    isActive: true,
  });
  revalidatePath('/import');
}

async function triggerScanAction(formData: FormData) {
  'use server';

  const sourceId = formData.get('sourceId')?.toString();
  if (!sourceId) return;

  await triggerWebsiteSourceScan(sourceId);
  revalidatePath('/import');
  revalidatePath('/documents');
}

function parsePositiveInteger(value: FormDataEntryValue | null) {
  const rawValue = value?.toString().trim();
  if (!rawValue) return undefined;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function scanRangeLabel(scanConfig: unknown) {
  const config = (scanConfig ?? {}) as { startPage?: unknown; endPage?: unknown; maxPages?: unknown };
  const startPage = typeof config.startPage === 'number' && config.startPage > 0 ? config.startPage : 1;
  const endPage = typeof config.endPage === 'number' && config.endPage >= startPage ? config.endPage : null;
  const legacyMaxPages = typeof config.maxPages === 'number' && config.maxPages > 0 ? config.maxPages : null;
  const legacyEndPage = legacyMaxPages ? startPage + legacyMaxPages - 1 : null;
  const lastPage = endPage ?? legacyEndPage;

  return lastPage ? `pages ${startPage}-${lastPage}` : `pages ${startPage}+`;
}

export default async function ImportPage() {
  const sources = await listWebsiteSources({ limit: 25 });

  return (
    <div>
      <ImportAutoRefresh enabled={sources.items.length > 0} />
      <PageHeader
        eyebrow="Import"
        title="Import PDFs"
        description="Upload a local PDF directly or register a URL source that DocAI can crawl and store into the document library."
      />

      <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
          <div className="flex items-center gap-2 text-accent">
            <UploadCloud size={17} aria-hidden="true" />
            <h2 className="font-semibold text-t1">Manual upload</h2>
          </div>
          <form action={uploadPdfAction} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">PDF file</span>
              <input required name="file" type="file" accept="application/pdf,.pdf" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
            </label>
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">Title</span>
              <input name="title" placeholder="Use file name if blank" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
            </label>
            <SubmitBtn icon={<UploadCloud size={15} />} label="Upload PDF" />
          </form>
        </section>

        <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
          <div className="flex items-center gap-2 text-accent">
            <Globe2 size={17} aria-hidden="true" />
            <h2 className="font-semibold text-t1">URL crawler</h2>
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
                <span className="text-xs font-medium uppercase tracking-wide text-t3">First page</span>
                <input name="startPage" type="number" min="1" max="500" defaultValue="1" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
              </label>
              <label className="grid gap-1 text-sm text-t2">
                <span className="text-xs font-medium uppercase tracking-wide text-t3">Last page</span>
                <input name="endPage" type="number" min="1" max="500" placeholder="All" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
              </label>
              <label className="grid gap-1 text-sm text-t2">
                <span className="text-xs font-medium uppercase tracking-wide text-t3">Document limit</span>
                <input name="maxDocuments" type="number" min="1" max="500" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
              </label>
            </div>
            <SubmitBtn icon={<Radar size={15} />} label="Save URL source" />
          </form>
        </section>
      </div>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-t1">Saved URL sources</h2>
        </div>
        <div className="divide-y divide-border">
          {sources.items.map((source) => (
            <article key={source.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-t1">{source.name}</span>
                  <span className="rounded bg-raised px-2 py-1 text-xs text-t2">{source.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                  <span className="rounded bg-raised px-2 py-1 text-xs text-t2">{scanRangeLabel(source.scanConfig)}</span>
                </div>
                <p className="mt-1 break-all text-sm text-t2">{source.baseUrl}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {source.scans.map((scan) => (
                    <div key={scan.id} className="rounded-md border border-border bg-raised p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-t1">{scan.status}</span>
                        <span className="text-xs text-t3">{formatDateTime(scan.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-t2">found {scan.discoveredCount} · new documents {scan.importedCount} · duplicate/skipped {scan.duplicateCount}</p>
                      {scan.failureReason ? <p className="mt-2 text-red">{scan.failureReason}</p> : null}
                      {(scan.metadata?.duplicates?.length ?? 0) > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer select-none text-xs text-t3 hover:text-t2">
                            {scan.metadata!.duplicates!.length} รายการซ้ำ – คลิกเพื่อดู
                          </summary>
                          <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pl-1 pr-1">
                            {(scan.metadata!.duplicates as ScanDuplicateInfo[]).map((d) => (
                              <li key={d.pdfUrl} className="space-y-0.5 text-xs">
                                <div className="flex items-start gap-1.5">
                                  <span className="mt-0.5 shrink-0 rounded px-1 py-px text-[10px] font-semibold uppercase leading-4
                                    bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                    {d.reason === 'url_match' ? 'URL ซ้ำ' : d.reason === 'file_hash' ? 'ไฟล์ซ้ำ' : 'เนื้อหาซ้ำ'}
                                  </span>
                                  <a
                                    href={d.pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-t2 underline-offset-2 hover:text-accent hover:underline"
                                  >
                                    {d.title || d.pdfUrl}
                                  </a>
                                </div>
                                <p className="pl-2 text-[11px] text-t3">
                                  ↳ ซ้ำกับ:{' '}
                                  <a
                                    href={`/documents/${d.existingDocumentVersionId}`}
                                    className="underline-offset-2 hover:text-accent hover:underline"
                                  >
                                    {d.existingDocumentTitle || `ID ${d.existingDocumentId.slice(0, 8)}…`}
                                  </a>
                                </p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))}
                  {!source.scans.length ? <div className="rounded-md border border-dashed border-border bg-raised p-3 text-sm text-t2">No scans yet.</div> : null}
                </div>
              </div>
              <form action={triggerScanAction}>
                <input type="hidden" name="sourceId" value={source.id} />
                <div className="flex flex-wrap gap-2">
                  <CrawlerPreviewPanel
                    sourceId={source.id}
                    sourceName={source.name}
                    onPreview={previewSourceAction.bind(null, source.id)}
                    onImport={importSelectedAction.bind(null, source.id)}
                  />
                  <button className="inline-flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-sm font-medium text-t2 hover:bg-white hover:text-t1"><Play size={14} />Run Scan</button>
                </div>
              </form>
            </article>
          ))}
          {!sources.items.length ? <div className="px-4 py-12 text-center text-sm text-t2">No URL sources have been configured yet.</div> : null}
        </div>
      </section>
    </div>
  );
}