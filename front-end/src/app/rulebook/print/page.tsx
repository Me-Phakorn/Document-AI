import { notFound } from 'next/navigation';
import { listRulebooks, type MasterRulebookRecord, type MasterRulebookVersionRecord, type RuleVersionRecord } from '@/lib/api/rulebook';
import { getReviewHistoryByDocument, type ReviewItemRecord } from '@/lib/api/review';
import { PrintTrigger } from './print-trigger';
import { PrintActions } from './print-actions';

export const dynamic = 'force-dynamic';

const RISK_LABEL: Record<string, string> = {
  HIGH: 'ความเสี่ยงสูง',
  MEDIUM: 'ความเสี่ยงปานกลาง',
  LOW: 'ความเสี่ยงต่ำ',
  INFO: 'ข้อมูล',
};

const RISK_COLOR: Record<string, string> = {
  HIGH: '#dc2626',
  MEDIUM: '#d97706',
  LOW: '#16a34a',
  INFO: '#2563eb',
};

const OUTCOME_LABEL: Record<string, string> = {
  APPROVED: 'อนุมัติ',
  CHANGES_REQUESTED: 'ขอแก้ไข',
  REJECTED: 'ปฏิเสธ',
  CONFIRMED_NOT_RELEVANT: 'ไม่เกี่ยวข้อง',
  OVERRIDDEN: 'แทนที่',
};

const OUTCOME_COLOR: Record<string, string> = {
  APPROVED: '#16a34a',
  CHANGES_REQUESTED: '#d97706',
  REJECTED: '#dc2626',
  CONFIRMED_NOT_RELEVANT: '#6b7280',
  OVERRIDDEN: '#2563eb',
};

// ── helpers ──────────────────────────────────────────────────────────────────

interface DocGroup {
  documentId: string;
  title: string;
  versions: MasterRulebookVersionRecord[];
}

function groupVersionsByDocument(versions: MasterRulebookVersionRecord[]): DocGroup[] {
  const map = new Map<string, DocGroup>();
  for (const v of versions) {
    if (!v.sourceDocument) continue;
    const key = v.sourceDocument.documentId;
    if (!map.has(key)) map.set(key, { documentId: key, title: v.sourceDocument.title, versions: [] });
    map.get(key)!.versions.push(v);
  }
  for (const g of map.values()) g.versions.sort((a, b) => a.versionNumber - b.versionNumber);
  return Array.from(map.values());
}

function riskBreakdown(rules: RuleVersionRecord[]) {
  const counts: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const r of rules) counts[r.riskLevel] = (counts[r.riskLevel] ?? 0) + 1;
  return counts;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function RuleCard({ rule, documentTag }: { rule: RuleVersionRecord; documentTag?: string }) {
  const riskColor = RISK_COLOR[rule.riskLevel] ?? '#6b7280';
  const riskLabel = RISK_LABEL[rule.riskLevel] ?? rule.riskLevel;

  const quotes: string[] = [];
  if (Array.isArray(rule.sourceReferences)) {
    for (const r of rule.sourceReferences as unknown[]) {
      if (r && typeof r === 'object') {
        const obj = r as Record<string, unknown>;
        if (typeof obj.quote === 'string' && obj.quote) quotes.push(obj.quote);
      }
    }
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 20px', background: '#fafafa', breakInside: 'avoid' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: riskColor, border: `1px solid ${riskColor}`, borderRadius: 4, padding: '1px 7px', background: `${riskColor}18` }}>
          {riskLabel}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{rule.ruleCode}</span>
        {rule.category ? (
          <span style={{ fontSize: 11, color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 4, padding: '1px 6px' }}>{rule.category}</span>
        ) : null}
        {documentTag ? (
          <span style={{ fontSize: 11, color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 6px', background: '#eff6ff', marginLeft: 'auto' }}>
            {documentTag}
          </span>
        ) : null}
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{rule.title}</p>
      {rule.description && rule.description !== rule.title ? (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{rule.description}</p>
      ) : null}
      {rule.condition ? (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}><strong>เงื่อนไข:</strong> {rule.condition}</p>
      ) : null}
      {rule.prohibition ? (
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#991b1b', lineHeight: 1.6 }}><strong>ข้อห้าม:</strong> {rule.prohibition}</p>
      ) : null}
      {quotes.length > 0 ? (
        <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
          {quotes.map((q, qi) => (
            <blockquote key={qi} style={{ margin: '4px 0 0', paddingLeft: 12, borderLeft: '3px solid #d1d5db', fontSize: 11, color: '#6b7280', lineHeight: 1.6, fontStyle: 'italic' }}>{q}</blockquote>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── report variants ──────────────────────────────────────────────────────────

function SingleDocReport({
  rulebook,
  group,
  reviewHistory,
}: {
  rulebook: MasterRulebookRecord;
  group: DocGroup;
  reviewHistory: ReviewItemRecord[];
}) {
  const latestVersion = group.versions[group.versions.length - 1];
  const breakdown = riskBreakdown(latestVersion.rules);
  const generatedAt = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Sort review history descending by roundNumber so latest is first
  const sortedHistory = [...reviewHistory].sort((a, b) => b.roundNumber - a.roundNumber);
  const roundCount = sortedHistory.length > 0 ? sortedHistory[0].roundNumber : group.versions.length;

  return (
    <>
      <div style={{ borderBottom: '2px solid #111', paddingBottom: 20, marginBottom: 28 }}>
        <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{rulebook.title} · {rulebook.domain}</p>
        <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{group.title || 'ไม่ระบุชื่อเอกสาร'}</h1>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>รายงานรายเอกสาร · สร้างเมื่อ {generatedAt}</p>
      </div>

      {/* ── Review history ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>ประวัติการรีวิว ({roundCount} รอบ)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              {['รอบที่', 'วันที่รีวิว', 'ผลการรีวิว', 'เหตุผล / หมายเหตุ'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedHistory.length > 0 ? (
              sortedHistory.map((item, idx) => {
                const isLatest = idx === 0;
                const outcomeLabel = OUTCOME_LABEL[item.outcome ?? ''] ?? item.outcome ?? 'รอดำเนินการ';
                const outcomeColor = OUTCOME_COLOR[item.outcome ?? ''] ?? '#6b7280';
                const reviewDate = item.decidedAt ?? item.createdAt;
                return (
                  <tr key={item.id} style={{ background: isLatest ? '#eff6ff' : undefined }}>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: isLatest ? 600 : undefined, whiteSpace: 'nowrap' }}>
                      รอบ {item.roundNumber}{isLatest ? ' (ล่าสุด)' : ''}
                    </td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      {reviewDate ? formatDate(reviewDate) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      <span style={{ color: outcomeColor, fontWeight: 600 }}>{outcomeLabel}</span>
                    </td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', color: item.outcome === 'CHANGES_REQUESTED' ? '#92400e' : '#374151', fontStyle: item.comment ? 'normal' : 'italic' }}>
                      {item.comment || '—'}
                    </td>
                  </tr>
                );
              })
            ) : (
              /* Fallback: derive from approved versions when review history not available */
              [...group.versions].reverse().map((v, idx) => {
                const isLatest = idx === 0;
                return (
                  <tr key={v.id} style={{ background: isLatest ? '#eff6ff' : undefined }}>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: isLatest ? 600 : undefined }}>รอบ {group.versions.length - idx}{isLatest ? ' (ล่าสุด)' : ''}</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{v.approvedAt ? formatDate(v.approvedAt) : '—'}</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}><span style={{ color: '#16a34a', fontWeight: 600 }}>อนุมัติ</span></td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontStyle: 'italic', color: '#9ca3af' }}>—</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Risk breakdown ── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>สรุป Rules (Version ล่าสุด · {latestVersion.rules.length} rules)</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(['HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((level) => (
            <div key={level} style={{ border: `1px solid ${RISK_COLOR[level]}`, borderRadius: 8, padding: '12px 20px', textAlign: 'center', minWidth: 90, background: `${RISK_COLOR[level]}0d` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: RISK_COLOR[level] }}>{breakdown[level] ?? 0}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{RISK_LABEL[level]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rule cards ── */}
      <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>รายละเอียด Rules ทั้งหมด</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {latestVersion.rules.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
        </div>
      </div>
    </>
  );
}

function CombinedReport({ rulebook, groups }: { rulebook: MasterRulebookRecord; groups: DocGroup[] }) {
  const allRules: { rule: RuleVersionRecord; docTitle: string }[] = [];
  for (const group of groups) {
    const latest = group.versions[group.versions.length - 1];
    for (const rule of latest.rules) allRules.push({ rule, docTitle: group.title });
  }
  const riskOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
  allRules.sort((a, b) => (riskOrder[a.rule.riskLevel] ?? 9) - (riskOrder[b.rule.riskLevel] ?? 9) || a.rule.ruleCode.localeCompare(b.rule.ruleCode));
  const breakdown = riskBreakdown(allRules.map((x) => x.rule));
  const generatedAt = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div style={{ borderBottom: '2px solid #111', paddingBottom: 20, marginBottom: 28 }}>
        <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Master Rulebook · {rulebook.domain}</p>
        <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{rulebook.title}</h1>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>รายงานรวมทุกเอกสาร · {groups.length} เอกสาร · สร้างเมื่อ {generatedAt}</p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>เอกสารที่ครอบคลุม</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              {['เอกสาร', 'รอบรีวิว', 'Rules ที่ใช้', 'อนุมัติล่าสุด'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const latest = group.versions[group.versions.length - 1];
              return (
                <tr key={group.documentId}>
                  <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{group.title}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{group.versions.length} รอบ</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{latest.rules.length} rules</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>{latest.approvedAt ? formatDate(latest.approvedAt) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>สรุป Rules รวม ({allRules.length} rules)</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(['HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((level) => (
            <div key={level} style={{ border: `1px solid ${RISK_COLOR[level]}`, borderRadius: 8, padding: '12px 20px', textAlign: 'center', minWidth: 90, background: `${RISK_COLOR[level]}0d` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: RISK_COLOR[level] }}>{breakdown[level] ?? 0}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{RISK_LABEL[level]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Rules ที่ใช้ทั้งหมด</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {allRules.map(({ rule, docTitle }) => <RuleCard key={rule.id} rule={rule} documentTag={docTitle} />)}
        </div>
      </div>
    </>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ rulebookId?: string; documentId?: string; title?: string }>;
}

export default async function RulebookPrintPage({ searchParams }: PageProps) {
  const { rulebookId, documentId, title: titleParam } = await searchParams;

  if (!rulebookId) notFound();

  let rulebook: MasterRulebookRecord | undefined;
  try {
    const res = await listRulebooks({ limit: 100 });
    rulebook = res.items.find((r) => r.id === rulebookId);
  } catch {
    notFound();
  }
  if (!rulebook) notFound();

  const groups = groupVersionsByDocument(rulebook.versions);

  let body: React.ReactNode;
  if (documentId) {
    const group = groups.find((g) => g.documentId === documentId);
    if (!group) notFound();
    if (titleParam) group.title = decodeURIComponent(titleParam);

    let reviewHistory: ReviewItemRecord[] = [];
    try {
      const histRes = await getReviewHistoryByDocument(group.documentId);
      reviewHistory = histRes.items;
    } catch {
      // non-fatal — print without review history if API fails
    }

    body = <SingleDocReport rulebook={rulebook} group={group} reviewHistory={reviewHistory} />;
  } else {
    body = <CombinedReport rulebook={rulebook} groups={groups} />;
  }

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          @page { margin: 20mm 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Sarabun', 'Tahoma', 'Arial', sans-serif; }
      `}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', color: '#111', background: '#fff', minHeight: '100vh' }}>
        <PrintActions />
        {body}
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
          <span>DocAI — Master Rulebook Export</span>
          <span>{rulebook.title}</span>
        </div>
      </div>
    </>
  );
}
