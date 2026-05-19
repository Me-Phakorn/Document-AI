import { AlertTriangle, Archive, BrainCircuit, ClipboardCheck, FileText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { MetricCard } from '@/components/metric-card';
import { PageHeader } from '@/components/page-header';
import { RiskBadge } from '@/components/risk-badge';
import { StatusBadge } from '@/components/status-badge';
import { getDocumentSummary, listDocuments } from '@/lib/api/documents';
import { formatBytes, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  try {
    const [summary, documents] = await Promise.all([getDocumentSummary(), listDocuments({ limit: 5 })]);

    return (
      <div>
        <PageHeader
          eyebrow="Operational dashboard"
          title="Document intelligence pipeline"
          description="Live source imports, OCR artifacts, AI queue state, and review gates from the DocAI API."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={FileText} label="Documents" value={summary.documents.totalDocuments.toString()} detail={`${summary.documents.totalVersions} versions · ${summary.documents.latestVersions} latest`} />
          <MetricCard icon={BrainCircuit} label="AI Queue" value={(summary.ai.pending + summary.ai.processing).toString()} detail={`${summary.ai.completed} completed · ${summary.ai.failed} failed`} />
          <MetricCard icon={ClipboardCheck} label="Review" value={summary.documents.pendingReview.toString()} detail={`${summary.documents.notRelevant} not relevant · ${summary.documents.approved} approved`} />
          <MetricCard icon={ShieldCheck} label="OCR" value={summary.ocr.completed.toString()} detail={`${summary.ocr.partial} partial · ${summary.ocr.failed} failed · ${summary.ocr.pending} pending`} />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-lg border border-border bg-panel shadow-panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold text-t1">Recent document imports</h2>
              <Link className="text-xs font-medium text-accent hover:underline" href="/documents">Open documents</Link>
            </div>
            <div className="divide-y divide-border">
              {documents.items.map((item) => (
                <div key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskBadge riskLevel={item.status === 'OCR_FAILED' ? 'HIGH' : item.status === 'OCR_PARTIAL' ? 'MEDIUM' : 'INFO'} />
                      <StatusBadge status={item.status} />
                      <span className="font-mono text-xs text-t3">v{item.versionNumber}</span>
                    </div>
                    <Link className="mt-2 block truncate font-medium text-t1 hover:text-accent" href={`/documents/${item.id}`}>{item.title}</Link>
                    <p className="mt-1 text-sm text-t2">{item.fileName ?? 'PDF'} · {item.document.sourceType} · {formatBytes(item.byteSize)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-t2">
                    <Archive size={14} aria-hidden="true" />
                    OCR {item.ocrStatus} · {formatDateTime(item.createdAt)}
                  </div>
                </div>
              ))}
              {!documents.items.length ? <div className="px-4 py-12 text-center text-sm text-t2">No documents imported yet.</div> : null}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
            <div className="flex items-center gap-2 text-amber">
              <AlertTriangle size={16} aria-hidden="true" />
              <h2 className="font-semibold">Attention gates</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-t2">
              <p>{summary.documents.pendingReview} document versions are waiting for review.</p>
              <p>{summary.documents.ocrFailed} OCR failures need operator action before AI analysis.</p>
              <p>{summary.latestScan ? `Latest BOT scan imported ${summary.latestScan.importedCount} PDFs and skipped ${summary.latestScan.duplicateCount} duplicates.` : 'No website scan has run yet.'}</p>
            </div>
          </section>
        </div>
      </div>
    );
  } catch {
    return (
      <div>
        <PageHeader eyebrow="Operational dashboard" title="Document intelligence pipeline" description="The dashboard could not reach the DocAI API." />
        <section className="rounded-lg border border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.06)] p-4 text-sm text-red">Backend API is unavailable. Start the API and reload the dashboard.</section>
      </div>
    );
  }
}