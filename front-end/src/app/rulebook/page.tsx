import { BookOpen, FileJson, Rocket } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { RiskBadge } from '@/components/risk-badge';
import { generateRulebookReport } from '@/lib/api/reports';
import { listRulebooks, publishRulebookVersion } from '@/lib/api/rulebook';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function publishRulebookAction(formData: FormData) {
  'use server';
  const rulebookVersionId = formData.get('rulebookVersionId')?.toString();
  if (!rulebookVersionId) return;
  await publishRulebookVersion(rulebookVersionId);
  revalidatePath('/rulebook');
  revalidatePath('/compliance');
}

async function generateRulebookReportAction(formData: FormData) {
  'use server';
  const rulebookVersionId = formData.get('rulebookVersionId')?.toString();
  if (!rulebookVersionId) return;
  await generateRulebookReport(rulebookVersionId);
  revalidatePath('/rulebook');
  revalidatePath('/reports');
}

export default async function RulebookPage() {
  const rulebooks = await listRulebooks({ limit: 25 });

  return (
    <div>
      <PageHeader
        eyebrow="Rulebook"
        title="Approved rule governance"
        description="Rulebooks are built from approved review results, versioned immutably, and published before compliance checks use them."
      />

      <section className="overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-t1">Master Rulebooks</h2>
        </div>
        <div className="divide-y divide-border">
          {rulebooks.items.map((rulebook) => (
            <article key={rulebook.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-accent">
                    <BookOpen size={16} aria-hidden="true" />
                    <h3 className="font-semibold text-t1">{rulebook.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-t2">{rulebook.domain} · {rulebook.versions.length} versions · updated {formatDateTime(rulebook.updatedAt)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {rulebook.versions.map((version) => (
                  <div key={version.id} className="rounded-md border border-border bg-raised p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-t1">Version {version.versionNumber}</p>
                        <p className="mt-1 text-sm text-t2">{version.status} · {version.rules.length} rules · created {formatDateTime(version.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={publishRulebookAction}>
                          <input type="hidden" name="rulebookVersionId" value={version.id} />
                          <button className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-sm font-medium text-t2"><Rocket size={14} />Publish</button>
                        </form>
                        <form action={generateRulebookReportAction}>
                          <input type="hidden" name="rulebookVersionId" value={version.id} />
                          <button className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-sm font-medium text-t2"><FileJson size={14} />Generate Report</button>
                        </form>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {version.rules.slice(0, 6).map((rule) => (
                        <div key={rule.id} className="rounded border border-border bg-panel p-3">
                          <div className="flex items-center gap-2">
                            <RiskBadge riskLevel={rule.riskLevel} />
                            <span className="font-mono text-xs text-t3">{rule.ruleCode}</span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-t1">{rule.title}</p>
                          <p className="mt-1 line-clamp-3 text-sm text-t2">{rule.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
          {!rulebooks.items.length ? <div className="px-4 py-12 text-center text-sm text-t2">No approved AI review results have created a rulebook yet.</div> : null}
        </div>
      </section>
    </div>
  );
}