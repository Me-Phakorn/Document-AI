import { BookOpen, FileText, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { RiskBadge } from '@/components/risk-badge';
import { DownloadReportButton } from '@/components/download-report-button';
import { listRulebooks, type MasterRulebookVersionRecord, type RuleVersionRecord } from '@/lib/api/rulebook';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

// ── helpers ──────────────────────────────────────────────────────────────────

interface DocumentGroup {
  documentId: string;
  title: string;
  versions: MasterRulebookVersionRecord[]; // ascending by versionNumber (round 1 first)
}

function groupVersionsByDocument(versions: MasterRulebookVersionRecord[]): DocumentGroup[] {
  const map = new Map<string, DocumentGroup>();
  // versions come desc from API; iterate to build groups, then we'll sort within
  for (const v of versions) {
    if (!v.sourceDocument) continue;
    const key = v.sourceDocument.documentId;
    if (!map.has(key)) {
      map.set(key, { documentId: key, title: v.sourceDocument.title, versions: [] });
    }
    map.get(key)!.versions.push(v);
  }
  // Sort each group ascending so round 1 = lowest versionNumber
  for (const group of map.values()) {
    group.versions.sort((a, b) => a.versionNumber - b.versionNumber);
  }
  // Return groups ordered by latest versionNumber desc (most recently updated document first)
  return Array.from(map.values()).sort(
    (a, b) =>
      b.versions[b.versions.length - 1].versionNumber -
      a.versions[a.versions.length - 1].versionNumber,
  );
}

function RuleCard({ rule, documentTitle }: { rule: RuleVersionRecord; documentTitle?: string }) {
  // Extract meaningful text from sourceReferences; skip generic fallback strings
  const refs: string[] = [];
  if (Array.isArray(rule.sourceReferences)) {
    for (const r of rule.sourceReferences as unknown[]) {
      if (typeof r === 'string') {
        refs.push(r);
      } else if (r && typeof r === 'object') {
        const obj = r as Record<string, unknown>;
        const text = obj.documentTitle ?? obj.title ?? obj.url;
        if (typeof text === 'string' && text) refs.push(text);
      }
    }
  }
  // Fall back to the document title supplied by the parent (available even for legacy data)
  const sourceLabel = refs.length > 0 ? refs.join(', ') : (documentTitle ?? null);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge riskLevel={rule.riskLevel} />
        <span className="font-mono text-xs text-t3">{rule.ruleCode}</span>
        {rule.category ? (
          <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] text-t3">
            {rule.category}
          </span>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-semibold leading-5 text-t1">{rule.title}</p>
        {rule.description ? (
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-t2">{rule.description}</p>
        ) : null}
      </div>

      {rule.condition ? (
        <p className="text-xs leading-5 text-t3">
          <span className="font-medium text-t2">เงื่อนไข:</span> {rule.condition}
        </p>
      ) : null}
      {rule.prohibition ? (
        <p className="text-xs leading-5 text-t3">
          <span className="font-medium text-red/80">ข้อห้าม:</span> {rule.prohibition}
        </p>
      ) : null}

      {sourceLabel ? (
        <div className="mt-auto border-t border-border/50 pt-2">
          <p className="text-[11px] text-t3">เอกสาร: {sourceLabel}</p>
        </div>
      ) : null}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function RulebookPage() {
  const rulebooks = await listRulebooks({ limit: 25 });

  return (
    <div>
      <PageHeader
        eyebrow="Rulebook"
        title="Master Rulebook"
        description="Rules ทั้งหมดที่ได้รับการยืนยันจาก Reviewer — จัดเก็บรายเอกสาร พร้อมใช้ใน Compliance Check"
      />

      <div className="space-y-6">
        {rulebooks.items.map((rulebook) => {
          const docGroups = groupVersionsByDocument(rulebook.versions);

          return (
            <section
              key={rulebook.id}
              className="overflow-hidden rounded-lg border border-border bg-panel shadow-panel"
            >
              {/* Rulebook header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-accent" aria-hidden="true" />
                    <h2 className="font-semibold text-t1">{rulebook.title}</h2>
                    <span className="rounded border border-border bg-raised px-1.5 py-0.5 text-xs text-t3">
                      {rulebook.domain}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-t3">
                    {docGroups.length} เอกสาร · อัปเดต {formatDateTime(rulebook.updatedAt)}
                  </p>
                </div>

                {/* Single PDF button per rulebook — downloads combined PDF for all docs */}
                {rulebook.versions.length > 0 ? (
                  <DownloadReportButton
                    rulebookId={rulebook.id}
                    documentTitle={rulebook.title}
                    label="PDF ทั้งหมด"
                  />
                ) : null}
              </div>

              {/* Document groups */}
              <div className="divide-y divide-border">
                {docGroups.map((group) => {
                  const latestGroupVersion = group.versions[group.versions.length - 1];
                  const roundCount = group.versions.length;

                  return (
                    <div key={group.documentId} className="px-5 py-5">
                      {/* Document header */}
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="shrink-0 text-t3" aria-hidden="true" />
                            <h3 className="font-medium text-t1">
                              {group.title || 'ไม่ระบุชื่อเอกสาร'}
                            </h3>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-t3">
                            <span className="flex items-center gap-1">
                              <RotateCcw size={11} aria-hidden="true" />
                              {roundCount} รอบรีวิว
                            </span>
                            <span>ล่าสุด {formatDateTime(latestGroupVersion.createdAt)}</span>
                            <span>{latestGroupVersion.rules.length} rules</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Round history chips */}
                          {roundCount > 1 ? (
                            <div className="flex flex-wrap gap-1">
                              {group.versions.map((v, idx) => (
                                <span
                                  key={v.id}
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                    idx === roundCount - 1
                                      ? 'border-accent/30 bg-[var(--accent-lo)] text-accent'
                                      : 'border-border bg-raised text-t3'
                                  }`}
                                >
                                  รอบ {idx + 1}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {/* Per-document export button — opens single-doc report */}
                          <DownloadReportButton
                            rulebookId={rulebook.id}
                            documentId={group.documentId}
                            documentTitle={group.title}
                            label="PDF เอกสารนี้"
                          />
                        </div>
                      </div>

                      {/* Rules grid — show latest round's rules */}
                      {latestGroupVersion.rules.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {latestGroupVersion.rules.map((rule) => (
                            <RuleCard key={rule.id} rule={rule} documentTitle={group.title} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-t3">ไม่มี rules ในรอบล่าสุด</p>
                      )}
                    </div>
                  );
                })}

                {/* Versions without sourceDocument (legacy or unresolved) */}
                {(() => {
                  const orphans = rulebook.versions.filter((v) => !v.sourceDocument);
                  if (!orphans.length) return null;
                  return (
                    <div className="px-5 py-5">
                      <p className="mb-3 text-xs font-medium text-t3">
                        Rules ที่ยังไม่ระบุเอกสาร ({orphans.length} version)
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {orphans.flatMap((v) =>
                          v.rules.map((rule) => <RuleCard key={rule.id} rule={rule} />),
                        )}
                      </div>
                    </div>
                  );
                })()}

                {rulebook.versions.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-t2">ยังไม่มี rules</div>
                ) : null}
              </div>
            </section>
          );
        })}

        {!rulebooks.items.length ? (
          <div className="rounded-lg border border-border bg-panel px-5 py-12 text-center shadow-panel">
            <BookOpen size={32} className="mx-auto mb-3 text-t3" aria-hidden="true" />
            <p className="text-sm font-medium text-t2">ยังไม่มี Rulebook</p>
            <p className="mt-1 text-xs text-t3">
              อนุมัติ AI review results เพื่อสร้าง rulebook แรก
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
