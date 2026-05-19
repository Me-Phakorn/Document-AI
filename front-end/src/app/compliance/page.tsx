import { ClipboardCheck, FileJson, ShieldAlert, ShieldCheck } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { RiskBadge } from '@/components/risk-badge';
import { createComplianceCheck, listComplianceChecks } from '@/lib/api/compliance';
import { generateComplianceReport } from '@/lib/api/reports';
import { listRulebooks } from '@/lib/api/rulebook';
import { formatDateTime, shortHash } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function createComplianceCheckAction(formData: FormData) {
  'use server';
  const content = formData.get('content')?.toString().trim();
  if (!content) return;
  await createComplianceCheck({
    content,
    title: formData.get('title')?.toString().trim() || undefined,
    selectedRulebookVersionId: formData.get('selectedRulebookVersionId')?.toString() || undefined,
  });
  revalidatePath('/compliance');
  revalidatePath('/review');
}

async function generateComplianceReportAction(formData: FormData) {
  'use server';
  const complianceCheckId = formData.get('complianceCheckId')?.toString();
  if (!complianceCheckId) return;
  await generateComplianceReport(complianceCheckId);
  revalidatePath('/compliance');
  revalidatePath('/reports');
}

export default async function CompliancePage() {
  const [rulebooks, checks] = await Promise.all([listRulebooks({ limit: 25 }), listComplianceChecks({ limit: 25 })]);
  const selectableVersions = rulebooks.items.flatMap((rulebook) =>
    rulebook.versions.filter((version) => ['PUBLISHED', 'APPROVED'].includes(version.status)).map((version) => ({ rulebook, version })),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Compliance Checker"
        title="Check real content against approved rules"
        description="Submitted text is hashed, checked against approved/published rulebook rules, stored as a ComplianceCheck, and routed to review when matches require a human decision."
      />

      <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
        <div className="flex items-center gap-2 text-accent">
          <ClipboardCheck size={17} aria-hidden="true" />
          <h2 className="font-semibold text-t1">New compliance check</h2>
        </div>
        <form action={createComplianceCheckAction} className="mt-4 grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">Title</span>
              <input name="title" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" placeholder="Campaign, post, or document name" />
            </label>
            <label className="grid gap-1 text-sm text-t2">
              <span className="text-xs font-medium uppercase tracking-wide text-t3">Rulebook version</span>
              <select name="selectedRulebookVersionId" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1">
                {selectableVersions.map(({ rulebook, version }) => <option key={version.id} value={version.id}>{rulebook.domain} v{version.versionNumber} · {version.status}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm text-t2">
            <span className="text-xs font-medium uppercase tracking-wide text-t3">Content</span>
            <textarea required name="content" className="min-h-36 rounded-md border border-border bg-raised px-3 py-2 text-sm leading-6 text-t1" placeholder="Paste real marketing copy, policy text, landing page text, or OCR output to check" />
          </label>
          <button className="inline-flex w-fit items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><ShieldCheck size={15} />Run Check</button>
        </form>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-t1">Compliance checks</h2>
        </div>
        <div className="divide-y divide-border">
          {checks.items.map((check) => {
            const latest = check.results[0];
            const matchedRules = Array.isArray(latest?.matchedRules) ? latest.matchedRules : [];
            return (
              <article key={check.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {check.status === 'COMPLIANT' ? <ShieldCheck size={16} className="text-green" /> : <ShieldAlert size={16} className="text-amber" />}
                    <span className="font-medium text-t1">{check.status}</span>
                    <span className="font-mono text-xs text-t3">{shortHash(check.inputHash)}</span>
                    <span className="text-xs text-t3">{formatDateTime(check.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-t2">{latest?.summary ?? 'No result summary'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {matchedRules.slice(0, 4).map((rule) => {
                      const item = rule as { ruleCode?: string; riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'; title?: string };
                      return <span key={`${check.id}-${item.ruleCode ?? item.title}`} className="inline-flex items-center gap-2 rounded border border-border bg-raised px-2 py-1 text-xs text-t2"><RiskBadge riskLevel={item.riskLevel ?? 'INFO'} />{item.ruleCode ?? item.title ?? 'Rule'}</span>;
                    })}
                  </div>
                </div>
                <form action={generateComplianceReportAction}>
                  <input type="hidden" name="complianceCheckId" value={check.id} />
                  <button className="inline-flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-sm font-medium text-t2"><FileJson size={14} />Generate Report</button>
                </form>
              </article>
            );
          })}
          {!checks.items.length ? <div className="px-4 py-12 text-center text-sm text-t2">No compliance checks have been submitted yet.</div> : null}
        </div>
      </section>
    </div>
  );
}