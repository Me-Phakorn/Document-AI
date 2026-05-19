import { Archive, BrainCircuit, CheckCircle2, CircleSlash, FileText, RefreshCw, XCircle } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { RiskBadge } from '@/components/risk-badge';
import { StatusBadge } from '@/components/status-badge';
import { runDocumentAnalysis } from '@/lib/api/analysis';
import { getOcrText, listDocuments } from '@/lib/api/documents';
import { approveReviewItem, confirmReviewNotRelevant, listReviewItems, markDocumentVersionNotRelevant, requestReviewChanges } from '@/lib/api/review';
import { formatBytes, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function runAnalysisAction(formData: FormData) {
  'use server';
  const documentVersionId = formData.get('documentVersionId')?.toString();
  if (!documentVersionId) return;
  await runDocumentAnalysis(documentVersionId);
  revalidateReviewPaths();
}

async function approveReviewAction(formData: FormData) {
  'use server';
  const reviewItemId = formData.get('reviewItemId')?.toString();
  if (!reviewItemId) return;
  await approveReviewItem(reviewItemId, formData.get('comment')?.toString() || undefined);
  revalidateReviewPaths();
}

async function requestChangesAction(formData: FormData) {
  'use server';
  const reviewItemId = formData.get('reviewItemId')?.toString();
  const comment = formData.get('comment')?.toString().trim();
  if (!reviewItemId || !comment) return;
  await requestReviewChanges(reviewItemId, comment);
  revalidateReviewPaths();
}

async function confirmNotRelevantAction(formData: FormData) {
  'use server';
  const reviewItemId = formData.get('reviewItemId')?.toString();
  if (!reviewItemId) return;
  await confirmReviewNotRelevant(reviewItemId, formData.get('comment')?.toString() || undefined);
  revalidateReviewPaths();
}

async function markDocumentNotRelevantAction(formData: FormData) {
  'use server';
  const documentVersionId = formData.get('documentVersionId')?.toString();
  if (!documentVersionId) return;
  await markDocumentVersionNotRelevant(documentVersionId, formData.get('comment')?.toString() || undefined);
  revalidateReviewPaths();
}

function revalidateReviewPaths() {
  revalidatePath('/review');
  revalidatePath('/documents');
  revalidatePath('/dashboard');
  revalidatePath('/rulebook');
}

export default async function ReviewPage() {
  const [documents, reviewItems] = await Promise.all([listDocuments({ limit: 50 }), listReviewItems({ limit: 50 })]);
  const pendingReviewItems = reviewItems.items.filter((item) => item.status === 'PENDING');
  const readyForAnalysis = documents.items.filter((item) => item.status === 'OCR_COMPLETED');
  const selectedReviewItem = pendingReviewItems[0];
  const selectedDocument = selectedReviewItem?.aiAnalysisResult?.documentVersion ?? readyForAnalysis[0];
  const selectedTextState = selectedDocument
    ? await getOcrText(selectedDocument.id)
        .then((value) => ({ value, error: null as string | null }))
        .catch((error) => ({ value: null, error: error instanceof Error ? error.message : 'Failed to load OCR text from the API.' }))
    : { value: null, error: null as string | null };
  const result = selectedReviewItem?.aiAnalysisResult?.result as { summary?: string; rules?: unknown[]; notRelevantReason?: string } | undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Review Center"
        title="Human gate for OCR and AI results"
        description="Run rule extraction, approve into the rulebook, request changes, or confirm that a PDF is not relevant. Every action writes backend state and audit records."
      />

      <div className="grid min-h-[720px] gap-4 xl:grid-cols-[340px_1fr]">
        <aside className="overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-t1">Review Queue</h2>
              <span className="rounded bg-[var(--accent-lo)] px-2 py-0.5 text-xs font-medium text-accent">{pendingReviewItems.length}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-t2">
              <span className="rounded-full bg-[var(--accent-lo)] px-2 py-1 text-accent">Pending review</span>
              <span className="rounded-full bg-raised px-2 py-1">{readyForAnalysis.length} OCR ready</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {pendingReviewItems.map((item) => {
              const documentVersion = item.aiAnalysisResult?.documentVersion;
              return (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-5 text-t1">{documentVersion?.title ?? item.reviewType}</p>
                    <span className="rounded border border-border bg-raised px-2 py-0.5 text-[11px] text-t2">{item.reviewType}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <RiskBadge riskLevel={item.reviewType === 'NOT_RELEVANT' ? 'LOW' : 'HIGH'} />
                    <span className="font-mono text-xs text-t3">{item.status}</span>
                  </div>
                </div>
              );
            })}
            {readyForAnalysis.slice(0, 8).map((item) => (
              <div key={item.id} className="px-4 py-3">
                <p className="text-sm font-medium leading-5 text-t1">{item.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RiskBadge riskLevel="INFO" />
                  <StatusBadge status={item.status} />
                  <span className="font-mono text-xs text-t3">OCR {item.ocrStatus}</span>
                </div>
              </div>
            ))}
            {!pendingReviewItems.length && !readyForAnalysis.length ? <div className="px-4 py-10 text-center text-sm text-t2">No OCR-ready or reviewable documents are available.</div> : null}
          </div>
        </aside>

        <section className="overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
          {selectedDocument ? (
            <>
              <div className="border-b border-border px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-t3">
                  <span>{selectedReviewItem ? 'Review item' : 'OCR ready'}</span>
                  <span>/</span>
                  <span className="font-mono">{selectedReviewItem?.id ?? selectedDocument.id}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-t1">{selectedDocument.title}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RiskBadge riskLevel={selectedReviewItem?.reviewType === 'NOT_RELEVANT' ? 'LOW' : selectedReviewItem ? 'HIGH' : 'INFO'} />
                  <StatusBadge status={selectedDocument.status} />
                  <span className="rounded border border-border bg-raised px-2 py-0.5 text-xs text-t2">OCR {selectedDocument.ocrStatus}</span>
                  <span className="rounded border border-border bg-raised px-2 py-0.5 text-xs text-t2">{formatBytes(selectedDocument.byteSize)}</span>
                </div>
              </div>

              <div className="grid lg:grid-cols-2">
                <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
                  <p className="text-xs font-semibold uppercase tracking-wide text-t3">OCR Text</p>
                  {selectedTextState.value ? (
                    <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap font-sans text-sm leading-7 text-t2">{selectedTextState.value.text}</pre>
                  ) : selectedTextState.error ? (
                    <p className="mt-4 text-sm text-red">OCR text could not be loaded from the DocAI API: {selectedTextState.error}</p>
                  ) : (
                    <p className="mt-4 text-sm text-t2">No OCR text artifact is available.</p>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">Analysis and decision</p>
                  <div className="mt-4 rounded-md border border-border bg-raised p-3">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-accent" aria-hidden="true" />
                      <p className="text-sm font-semibold text-t1">{selectedReviewItem?.aiAnalysisResult?.outcome ?? (selectedDocument.status === 'OCR_COMPLETED' ? 'Ready for AI analysis' : selectedDocument.status.replaceAll('_', ' '))}</p>
                    </div>
                    <p className="mt-2 text-sm text-t2">Imported {formatDateTime(selectedDocument.createdAt)} · source hash {selectedDocument.fileSha256?.slice(0, 12) ?? 'none'}</p>
                    {result?.summary ? <p className="mt-3 text-sm text-t2">{result.summary}</p> : null}
                    {result?.notRelevantReason ? <p className="mt-3 text-sm text-t2">{result.notRelevantReason}</p> : null}
                    {Array.isArray(result?.rules) ? <p className="mt-3 text-sm text-t2">{result.rules.length} extracted rule candidates.</p> : null}
                    <Link className="mt-3 inline-flex text-sm font-medium text-accent hover:underline" href={`/documents/${selectedDocument.id}`}>Open document detail</Link>
                  </div>
                </div>
              </div>

              <div className="border-t border-border bg-panel px-5 py-3">
                {selectedReviewItem ? (
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                    <textarea form="review-request-changes" name="comment" placeholder="Reviewer comment" className="min-h-20 rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
                    <div className="flex flex-wrap gap-2">
                      {selectedReviewItem.reviewType === 'NOT_RELEVANT' ? (
                        <form action={confirmNotRelevantAction}>
                          <input type="hidden" name="reviewItemId" value={selectedReviewItem.id} />
                          <button className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><Archive size={15} />Confirm Not Relevant</button>
                        </form>
                      ) : (
                        <form action={approveReviewAction}>
                          <input type="hidden" name="reviewItemId" value={selectedReviewItem.id} />
                          <button className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><CheckCircle2 size={15} />Approve & Extract Rules</button>
                        </form>
                      )}
                      <form id="review-request-changes" action={requestChangesAction}>
                        <input type="hidden" name="reviewItemId" value={selectedReviewItem.id} />
                        <button className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-t2"><XCircle size={15} />Request Changes</button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <form action={runAnalysisAction}>
                      <input type="hidden" name="documentVersionId" value={selectedDocument.id} />
                      <button className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><BrainCircuit size={15} />Run AI Analysis</button>
                    </form>
                    <form action={markDocumentNotRelevantAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="documentVersionId" value={selectedDocument.id} />
                      <input name="comment" placeholder="Reason" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" />
                      <button className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-t2"><CircleSlash size={15} />Mark Not Relevant</button>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : <div className="p-8 text-sm text-t2">No reviewable document is available.</div>}
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-border bg-panel p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-raised p-2 text-t2"><RefreshCw size={18} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-t1">Review outcomes</h2>
            <p className="mt-2 text-sm text-t2">Approvals create immutable rulebook versions. Not-relevant confirmations update the document status and stay auditable through backend audit logs.</p>
          </div>
        </div>
      </section>
    </div>
  );
}