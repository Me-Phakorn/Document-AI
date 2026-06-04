import { AlertTriangle, FileCheck2, FileText, Link as LinkIcon, Search, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { apiBaseUrl } from '@/lib/api-client';
import { getDocumentSummary, listDocuments } from '@/lib/api/documents';
import { DocumentsFilter } from './documents-filter';
import { DocumentsTable } from './documents-table';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; ignore?: string; source?: string }>;
}) {
  try {
    const params = await searchParams;
    const search = params.search ?? '';
    const status = params.status ?? '';
    const ignore = params.ignore ?? '';
    const source = params.source === 'upload' || params.source === 'website' ? params.source : '';
    const sourceType = source === 'upload' ? 'UPLOAD' : source === 'website' ? 'WEBSITE_SCAN' : undefined;

    const [summary, documents] = await Promise.all([
      getDocumentSummary(),
      listDocuments({ limit: 100, offset: 0, search: search || undefined, status: status || undefined, ignore: ignore || undefined, sourceType }),
    ]);

    return (
      <div>
        <PageHeader
          eyebrow="Documents"
          title="Document library"
          description="Browse imported PDF versions, OCR state, hashes, and review status after they enter DocAI."
          action={<Link className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-t2" href="/import"><UploadCloud size={15} />Import</Link>}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-t3">Documents</p>
              <FileText size={17} className="text-accent" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-t1">{summary.documents.totalDocuments}</p>
            <p className="mt-2 text-sm text-t2">{summary.documents.totalVersions} stored versions</p>
          </section>
          <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-t3">OCR completed</p>
              <FileCheck2 size={17} className="text-blue" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-t1">{summary.ocr.completed}</p>
            <p className="mt-2 text-sm text-t2">{summary.ocr.partial} partial · {summary.ocr.failed} failed</p>
          </section>
          <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-t3">Latest scan</p>
              <Search size={17} className="text-green" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-t1">{summary.latestScan?.importedCount ?? 0}</p>
            <p className="mt-2 text-sm text-t2">{summary.latestScan?.discoveredCount ?? 0} discovered · {summary.latestScan?.duplicateCount ?? 0} duplicates</p>
          </section>
          <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-t3">Review gate</p>
              <AlertTriangle size={17} className="text-amber" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-t1">{summary.documents.pendingReview}</p>
            <p className="mt-2 text-sm text-t2">{summary.documents.notRelevant} marked not relevant</p>
          </section>
        </div>

        <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-t1">Document versions</h2>
              <span className="text-xs text-t3">{documents.total} records</span>
            </div>
            <DocumentsFilter currentSearch={search} currentStatus={status} currentIgnore={ignore} />
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-raised/40 px-3 py-2">
            <SourceTab label="All" count={summary.documents.totalDocuments} value="" current={source} search={search} status={status} ignore={ignore} />
            <SourceTab label="Uploaded" icon="upload" count={summary.documents.bySource?.upload ?? 0} value="upload" current={source} search={search} status={status} ignore={ignore} />
            <SourceTab label="From link" icon="link" count={summary.documents.bySource?.website ?? 0} value="website" current={source} search={search} status={status} ignore={ignore} />
          </div>
          <DocumentsTable items={documents.items} />
        </section>
      </div>
    );
  } catch (error) {
    return <DocumentsError />;
  }
}

function SourceTab({
  label,
  count,
  value,
  current,
  search,
  status,
  ignore,
  icon,
}: {
  label: string;
  count: number;
  value: '' | 'upload' | 'website';
  current: string;
  search: string;
  status: string;
  ignore: string;
  icon?: 'upload' | 'link';
}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (ignore) params.set('ignore', ignore);
  if (value) params.set('source', value);
  const href = params.toString() ? `/documents?${params}` : '/documents';
  const active = current === value;
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-panel text-t1 shadow-sm border border-border' : 'text-t2 hover:bg-panel/60'
      }`}
    >
      {icon === 'upload' ? <UploadCloud size={12} aria-hidden="true" /> : null}
      {icon === 'link' ? <LinkIcon size={12} aria-hidden="true" /> : null}
      <span>{label}</span>
      <span className={`rounded px-1.5 py-0.5 text-[10px] ${active ? 'bg-accent/10 text-accent' : 'bg-raised text-t3'}`}>{count}</span>
    </Link>
  );
}

function DocumentsError() {
  return (
    <div>
      <PageHeader eyebrow="Documents" title="Document library" description="The frontend could not reach the DocAI API." />
      <section className="rounded-lg border border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.06)] p-4 text-sm text-red">
        Backend API is unavailable at {apiBaseUrl}. Start the backend and reload this page.
      </section>
    </div>
  );
}
