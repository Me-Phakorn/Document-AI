import { ArrowLeft, ExternalLink, FileText, RefreshCw, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { getDocumentDetail, getOcrText, refetchDocumentSource, reuploadDocumentVersion } from '@/lib/api/documents';
import { formatBytes, formatDate, formatDateTime, shortHash } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function reuploadVersionAction(formData: FormData) {
  'use server';

  const documentVersionId = formData.get('documentVersionId')?.toString();
  const file = formData.get('file');
  if (!documentVersionId || !(file instanceof File) || file.size === 0) return;

  const title = formData.get('title')?.toString().trim() || file.name;
  const contentBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const result = await reuploadDocumentVersion(documentVersionId, { title, fileName: file.name, mimeType: file.type || 'application/pdf', contentBase64 });

  revalidatePath('/documents');
  revalidatePath('/dashboard');
  revalidatePath('/review');
  redirect(`/documents/${result.documentVersionId ?? documentVersionId}`);
}

async function refetchSourceAction(formData: FormData) {
  'use server';

  const documentVersionId = formData.get('documentVersionId')?.toString();
  if (!documentVersionId) return;

  const result = await refetchDocumentSource(documentVersionId);
  revalidatePath('/documents');
  revalidatePath('/dashboard');
  revalidatePath('/review');
  redirect(`/documents/${result.documentVersionId ?? documentVersionId}`);
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ documentVersionId: string }> }) {
  const { documentVersionId } = await params;

  try {
    const detail = await getDocumentDetail(documentVersionId);
    const ocrTextState = await getOcrText(documentVersionId)
      .then((value) => ({ value, error: null as string | null }))
      .catch((error) => ({ value: null, error: error instanceof Error ? error.message : 'Failed to load OCR text from the API.' }));
    const documentVersion = detail.documentVersion;
    const originalObject = detail.storedObjects.find((item) => item.ownerType === 'DocumentVersion');

    return (
      <div>
        <PageHeader
          eyebrow="Document detail"
          title={documentVersion.title}
          description={`${documentVersion.fileName ?? 'PDF'} · v${documentVersion.versionNumber} · ${formatBytes(documentVersion.byteSize)}`}
          action={<Link className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-t2" href="/documents"><ArrowLeft size={15} />Documents</Link>}
        />

        <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-t3">Pipeline state</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={documentVersion.status} />
                  <span className="rounded border border-border bg-raised px-2 py-0.5 text-[11px] font-medium text-t2">OCR {documentVersion.ocrStatus}</span>
                </div>
              </div>
              <FileText size={20} className="text-accent" aria-hidden="true" />
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="text-t3">Source type</dt><dd className="mt-1 text-t1">{documentVersion.document.sourceType}</dd></div>
              <div><dt className="text-t3">File SHA-256</dt><dd className="mt-1 break-all font-mono text-xs text-t2">{documentVersion.fileSha256 ?? 'none'}</dd></div>
              <div><dt className="text-t3">Content SHA-256</dt><dd className="mt-1 break-all font-mono text-xs text-t2">{documentVersion.contentSha256 ?? 'none'}</dd></div>
              <div><dt className="text-t3">Document date</dt><dd className="mt-1 text-t1">{documentVersion.sourceDocumentDate ? formatDate(documentVersion.sourceDocumentDate) : documentVersion.sourceDocumentDateText ?? 'Not recorded'}</dd></div>
              <div><dt className="text-t3">Imported</dt><dd className="mt-1 text-t1">{formatDateTime(documentVersion.createdAt)}</dd></div>
              {documentVersion.sourceUrl ? (
                <div><dt className="text-t3">Source URL</dt><dd className="mt-1"><a className="inline-flex items-center gap-1 break-all text-accent hover:underline" href={documentVersion.sourceUrl} target="_blank" rel="noreferrer">Open source PDF <ExternalLink size={13} /></a></dd></div>
              ) : null}
            </dl>

            <div className="mt-5 border-t border-border pt-4">
              <h2 className="font-semibold text-t1">Edit</h2>
              <form action={reuploadVersionAction} className="mt-3 grid gap-3">
                <input type="hidden" name="documentVersionId" value={documentVersion.id} />
                <label className="grid gap-1 text-sm text-t2">
                  <span className="text-xs font-medium uppercase tracking-wide text-t3">Title</span>
                  <input name="title" defaultValue={documentVersion.title} className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
                </label>
                <label className="grid gap-1 text-sm text-t2">
                  <span className="text-xs font-medium uppercase tracking-wide text-t3">PDF file</span>
                  <input required name="file" type="file" accept="application/pdf,.pdf" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
                </label>
                <button className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><UploadCloud size={15} />Re-upload</button>
              </form>

              {documentVersion.sourceUrl ? (
                <form action={refetchSourceAction} className="mt-3">
                  <input type="hidden" name="documentVersionId" value={documentVersion.id} />
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-t2 hover:bg-raised"><RefreshCw size={15} />Fetch source URL</button>
                </form>
              ) : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold text-t1">Extracted text</h2>
              <p className="mt-1 text-sm text-t2">
                {ocrTextState.value
                  ? `${ocrTextState.value.ocrArtifact.engine} · ${ocrTextState.value.ocrArtifact.pageCount ?? 0} pages · ${ocrTextState.value.textLength.toLocaleString()} characters`
                  : ocrTextState.error
                    ? 'OCR text could not be loaded from the DocAI API.'
                    : 'No text artifact is available for this document.'}
              </p>
            </div>
            {ocrTextState.value ? (
              <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap p-5 font-sans text-sm leading-7 text-t2">{ocrTextState.value.text}</pre>
            ) : ocrTextState.error ? (
              <div className="p-5 text-sm text-red">{ocrTextState.error}</div>
            ) : (
              <div className="p-5 text-sm text-t2">OCR text has not been stored for this version.</div>
            )}
          </section>
        </div>

        <section className="mt-4 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
          <div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-t1">Stored artifacts</h2></div>
          <div className="divide-y divide-border">
            {detail.storedObjects.map((artifact) => (
              <div key={artifact.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="font-medium text-t1">{artifact.fileName ?? artifact.objectKey}</p>
                  <p className="mt-1 break-all font-mono text-xs text-t3">{artifact.bucket}/{artifact.objectKey}</p>
                </div>
                <div className="text-t2">{artifact.contentType} · {formatBytes(artifact.byteSize)} · {shortHash(artifact.sha256)}</div>
              </div>
            ))}
            {!originalObject ? <div className="px-4 py-6 text-sm text-t2">No original PDF object metadata found.</div> : null}
          </div>
        </section>
      </div>
    );
  } catch {
    return (
      <div>
        <PageHeader eyebrow="Document detail" title="Document not available" description="The document detail could not be loaded from the DocAI API." />
        <Link className="text-sm font-medium text-accent hover:underline" href="/documents">Back to documents</Link>
      </div>
    );
  }
}