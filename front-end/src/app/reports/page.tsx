import { FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { apiBaseUrl } from '@/lib/api-client';
import { listReports } from '@/lib/api/reports';
import { formatDateTime } from '@/lib/format';

const reportTypeLabel = {
  RULE_EXTRACTION: 'Rule Extraction / Regulatory Intelligence',
  COMPLIANCE_USAGE: 'Compliance Usage / Content Check',
} as const;

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const reports = await listReports({ limit: 50 });

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Separate regulatory intelligence from usage checks"
        description="Rule Extraction Reports summarize approved source-document rules. Compliance Usage Reports preserve evidence for real content checked against approved rule versions."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
          <div className="flex items-center gap-2 text-accent">
            <FileText size={17} aria-hidden="true" />
            <h2 className="font-semibold">Rule Extraction Reports</h2>
          </div>
          <p className="mt-2 text-sm text-t2">Built from source PDFs/URLs after OCR, AI analysis, human review, and approval.</p>
        </section>
        <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
          <div className="flex items-center gap-2 text-blue">
            <FileSpreadsheet size={17} aria-hidden="true" />
            <h2 className="font-semibold">Compliance Usage Reports</h2>
          </div>
          <p className="mt-2 text-sm text-t2">Built from real usage media checked against approved reports or published rulebook versions.</p>
        </section>
      </div>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-t1">Report queue</h2>
        </div>
        <div className="divide-y divide-border">
          {reports?.items.map((report) => (
            <div key={report.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border bg-raised px-2 py-0.5 text-xs text-t2">{reportTypeLabel[report.reportType]}</span>
                  <span className="font-mono text-xs text-t3">{report.id}</span>
                  <span className="rounded border border-border bg-raised px-2 py-0.5 text-xs text-t2">{report.status}</span>
                </div>
                <p className="mt-2 font-medium text-t1">{report.title}</p>
                <p className="mt-1 text-sm text-t2">Generated {formatDateTime(report.generatedAt)} · {report.exports.length} exports</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.exports.filter((item) => item.status === 'COMPLETED' && item.storedObjectId).map((item) => (
                  <a key={item.id} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-t2 hover:bg-raised" href={`${apiBaseUrl}/reports/exports/${item.id}`} target="_blank" rel="noreferrer"><FileJson size={14} />{item.format}</a>
                ))}
              </div>
            </div>
          ))}
          {!reports?.items.length ? (
            <div className="px-4 py-12 text-center text-sm text-t2">
              No reports have been generated from approved review or compliance workflows yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}