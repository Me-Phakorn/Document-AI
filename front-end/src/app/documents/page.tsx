import { AlertTriangle, Database, ExternalLink, FileCheck2, FileText, Search, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { apiBaseUrl } from '@/lib/api-client';
import { getDocumentSummary, listDocuments, uploadDocument } from '@/lib/api/documents';
import { formatBytes, formatDateTime, shortHash } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function uploadPdfAction(formData: FormData) {
  'use server';

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return;

  const title = formData.get('title')?.toString().trim() || file.name;
  const domain = formData.get('domain')?.toString().trim() || undefined;
  const sourceUrl = formData.get('sourceUrl')?.toString().trim() || undefined;
  const contentBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');

  await uploadDocument({ title, domain, sourceUrl, fileName: file.name, mimeType: file.type || 'application/pdf', contentBase64 });
  revalidatePath('/documents');
  revalidatePath('/dashboard');
  revalidatePath('/review');
}

export default async function DocumentsPage() {
  try {
    const [summary, documents] = await Promise.all([getDocumentSummary(), listDocuments({ limit: 50 })]);

    return (
      <div>
        <PageHeader
          eyebrow="Documents"
          title="Imported source documents"
          description="Live PDF imports, OCR state, content hashes, and source traceability from the DocAI backend."
          action={<a className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-t2" href={`${apiBaseUrl}/documents`} target="_blank" rel="noreferrer"><Database size={15} />API</a>}
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
          <div className="border-b border-border px-4 py-4">
            <form action={uploadPdfAction} className="grid gap-3 lg:grid-cols-[1fr_160px_1fr_auto] lg:items-end">
              <label className="grid gap-1 text-sm text-t2">
                <span className="text-xs font-medium uppercase tracking-wide text-t3">PDF file</span>
                <input required name="file" type="file" accept="application/pdf,.pdf" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
              </label>
              <label className="grid gap-1 text-sm text-t2">
                <span className="text-xs font-medium uppercase tracking-wide text-t3">Domain</span>
                <input name="domain" defaultValue="general-compliance" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
              </label>
              <label className="grid gap-1 text-sm text-t2">
                <span className="text-xs font-medium uppercase tracking-wide text-t3">Title</span>
                <input name="title" placeholder="Use file name if blank" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
              </label>
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><UploadCloud size={15} />Upload</button>
              <label className="grid gap-1 text-sm text-t2 lg:col-span-3">
                <span className="text-xs font-medium uppercase tracking-wide text-t3">Source URL</span>
                <input name="sourceUrl" type="url" placeholder="Optional original PDF URL" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
              </label>
            </form>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="font-semibold text-t1">Document versions</h2>
            <span className="text-xs text-t3">{documents.total} records</span>
          </div>
          {documents.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-raised text-xs uppercase tracking-wide text-t3">
                  <tr>
                    <th className="px-4 py-3 font-medium">Document</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">OCR</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Hash</th>
                    <th className="px-4 py-3 font-medium">Imported</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents.items.map((documentVersion) => (
                    <tr key={documentVersion.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link className="font-medium text-accent hover:underline" href={`/documents/${documentVersion.id}`}>{documentVersion.title}</Link>
                        <p className="mt-1 text-xs text-t3">{documentVersion.fileName ?? 'unnamed'} · v{documentVersion.versionNumber}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={documentVersion.status} /></td>
                      <td className="px-4 py-3"><span className="rounded border border-border bg-raised px-2 py-0.5 text-[11px] font-medium text-t2">{documentVersion.ocrStatus}</span></td>
                      <td className="px-4 py-3 text-t2">{formatBytes(documentVersion.byteSize)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-t3">{shortHash(documentVersion.fileSha256)}</td>
                      <td className="px-4 py-3 text-t2">{formatDateTime(documentVersion.createdAt)}</td>
                      <td className="px-4 py-3">
                        {documentVersion.sourceUrl ? (
                          <a className="inline-flex items-center gap-1 text-xs text-accent hover:underline" href={documentVersion.sourceUrl} target="_blank" rel="noreferrer">PDF <ExternalLink size={12} /></a>
                        ) : <span className="text-xs text-t3">Upload</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-t2">No documents have been imported yet.</div>
          )}
        </section>
      </div>
    );
  } catch (error) {
    return <DocumentsError />;
  }
}

function DocumentsError() {
  return (
    <div>
      <PageHeader eyebrow="Documents" title="Imported source documents" description="The frontend could not reach the DocAI API." />
      <section className="rounded-lg border border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.06)] p-4 text-sm text-red">
        Backend API is unavailable at {apiBaseUrl}. Start the backend and reload this page.
      </section>
    </div>
  );
}