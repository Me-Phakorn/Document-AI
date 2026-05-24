'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ImageIcon, Info, ShieldAlert, ShieldCheck, Sparkles, X } from 'lucide-react';
import { RiskBadge } from '@/components/risk-badge';
import { apiGetBrowser } from '@/lib/api-client-browser';
import { formatDateTime } from '@/lib/format';
import { AiFinding, ComplianceCheckDetail, ComplianceCheckRecord, RuleChecked } from '@/lib/api/compliance';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { icon: typeof ShieldCheck; label: string; color: string }> = {
  COMPLIANT: { icon: ShieldCheck, label: 'ปฏิบัติตามกฎ', color: 'text-green-400' },
  NON_COMPLIANT: { icon: ShieldAlert, label: 'ไม่ปฏิบัติตามกฎ', color: 'text-red-400' },
  POTENTIAL_VIOLATION: { icon: ShieldAlert, label: 'อาจมีการละเมิด', color: 'text-amber-400' },
  AMBIGUOUS: { icon: ShieldAlert, label: 'ไม่ชัดเจน', color: 'text-t3' },
  NEED_HUMAN_REVIEW: { icon: ShieldAlert, label: 'ต้องการผู้ตรวจสอบ', color: 'text-blue-400' },
  FAILED: { icon: ShieldAlert, label: 'เกิดข้อผิดพลาด', color: 'text-t3' },
};

const RISK_LABEL: Record<string, string> = {
  HIGH: 'สูง', MEDIUM: 'กลาง', LOW: 'ต่ำ', INFO: 'ข้อมูล',
};

// ─── Detail modal ─────────────────────────────────────────────────────────────
type Tab = 'source' | 'rules' | 'result';

function DetailModal({ check, onClose }: { check: ComplianceCheckRecord; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('source');
  const [detail, setDetail] = useState<ComplianceCheckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGetBrowser<ComplianceCheckDetail>(`/compliance/checks/${check.id}/detail`)
      .then(setDetail)
      .catch(() => setFetchError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่'))
      .finally(() => setLoading(false));
  }, [check.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const latest = detail?.results[0] ?? check.results[0];
  const findings = Array.isArray(latest?.matchedRules) ? (latest.matchedRules as AiFinding[]) : [];
  const meta = check.metadata;
  const rulesCount = detail?.rulesChecked.length ?? meta?.totalRulesChecked;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'source', label: 'ต้นทาง' },
    { key: 'rules', label: `กฎที่ใช้${rulesCount != null ? ` (${rulesCount})` : ''}` },
    { key: 'result', label: `ผล AI${findings.length ? ` (${findings.length})` : ''}` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="รายละเอียดการตรวจสอบ"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-t1">รายละเอียดการตรวจสอบ</h2>
            {meta?.title ? <p className="mt-0.5 text-sm text-t2">{meta.title}</p> : null}
            <p className="mt-0.5 text-xs text-t3">{formatDateTime(check.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-md p-1.5 text-t3 transition-colors hover:bg-raised hover:text-t1"
            aria-label="ปิด"
          >
            <X size={17} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-t3 hover:text-t1'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-t3">กำลังโหลด…</div>
          ) : fetchError ? (
            <div className="py-16 text-center text-sm text-red-400">{fetchError}</div>
          ) : activeTab === 'source' ? (
            <SourceTab check={check} />
          ) : activeTab === 'rules' ? (
            <RulesTab rules={detail?.rulesChecked ?? []} />
          ) : (
            <ResultTab findings={findings} summary={latest?.summary ?? null} recommendedAction={latest?.recommendedAction ?? null} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: ต้นทาง ──────────────────────────────────────────────────────────────
function SourceTab({ check }: { check: ComplianceCheckRecord }) {
  const meta = check.metadata;
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'ชื่อเรื่อง', value: meta?.title ?? <span className="text-t3">—</span> },
    {
      label: 'ประเภทข้อมูล',
      value: (
        <span className="inline-flex items-center gap-1.5">
          {meta?.hasImage ? <ImageIcon size={13} className="text-t3" /> : null}
          {check.inputType}
        </span>
      ),
    },
    { label: 'กฎระเบียบที่ใช้', value: meta?.rulebookTitle ?? <span className="text-t3">—</span> },
    {
      label: 'AI Model',
      value: meta?.model ? (
        <span className="font-mono text-xs">{meta.model}</span>
      ) : (
        <span className="text-t3">ค่าเริ่มต้น</span>
      ),
    },
    {
      label: 'โฟกัสพิเศษ',
      value: meta?.focusPrompt ? (
        <span className="flex items-start gap-1.5">
          <Sparkles size={13} className="mt-0.5 shrink-0 text-t3" />
          {meta.focusPrompt}
        </span>
      ) : (
        <span className="text-t3">—</span>
      ),
    },
    { label: 'วันที่ตรวจสอบ', value: formatDateTime(check.createdAt) },
  ];

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Source image preview */}
      {meta?.inputImageKey ? (
        <div>
          <p className="mb-2 text-xs font-medium text-t3">ภาพต้นทาง</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/backend/compliance/checks/${check.id}/image`}
            alt={meta.title ?? 'ภาพที่ตรวจสอบ'}
            className="max-h-80 w-auto rounded-md border border-border object-contain"
          />
        </div>
      ) : null}
      <dl className="grid gap-3">
        {rows.map(({ label, value }) => (
          <div key={label} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
            <dt className="text-t3">{label}</dt>
            <dd className="text-t1">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Tab: กฎที่ใช้ตรวจสอบ ─────────────────────────────────────────────────────
function RulesTab({ rules }: { rules: RuleChecked[] }) {
  if (!rules.length) {
    return <div className="py-16 text-center text-sm text-t3">ไม่พบข้อมูลกฎระเบียบ</div>;
  }

  const byRisk: Record<string, RuleChecked[]> = {};
  for (const r of rules) {
    (byRisk[r.riskLevel] ??= []).push(r);
  }
  const ORDER = ['HIGH', 'MEDIUM', 'LOW', 'INFO'];

  return (
    <div className="divide-y divide-border">
      {ORDER.filter((lvl) => byRisk[lvl]?.length).map((lvl) => (
        <div key={lvl} className="px-5 py-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-t3">
            <RiskBadge riskLevel={lvl as 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'} />
            ความเสี่ยง{RISK_LABEL[lvl]} — {byRisk[lvl].length} กฎ
          </h3>
          <ul className="grid gap-3">
            {byRisk[lvl].map((rule) => (
              <li key={rule.id} className="rounded-lg border border-border bg-raised p-3">
                <div className="mb-1 flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs text-t3">{rule.ruleCode}</span>
                  <span className="text-sm font-medium text-t1">{rule.title}</span>
                  <span className="ml-auto text-[11px] text-t3">v{rule.fromVersionNumber}</span>
                </div>
                <p className="text-xs text-t2">{rule.description}</p>
                {rule.prohibition ? (
                  <p className="mt-1.5 text-xs text-red-400">
                    <span className="font-medium">ข้อห้าม:</span> {rule.prohibition}
                  </p>
                ) : null}
                {rule.condition ? (
                  <p className="mt-1 text-xs text-amber-400">
                    <span className="font-medium">เงื่อนไข:</span> {rule.condition}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: ผลการวิเคราะห์ AI ───────────────────────────────────────────────────
function ResultTab({
  findings,
  summary,
  recommendedAction,
}: {
  findings: AiFinding[];
  summary: string | null;
  recommendedAction: string | null;
}) {
  const violated = findings.filter((f) => f.status === 'VIOLATED');
  const potential = findings.filter((f) => f.status === 'POTENTIAL');
  const compliant = findings.filter((f) => f.status === 'COMPLIANT');

  const sections: { label: string; items: AiFinding[]; borderColor: string; bgColor: string; textColor: string }[] = [
    { label: 'ละเมิด', items: violated, borderColor: 'border-red-500/30', bgColor: 'bg-red-500/5', textColor: 'text-red-400' },
    { label: 'อาจละเมิด', items: potential, borderColor: 'border-amber-500/30', bgColor: 'bg-amber-500/5', textColor: 'text-amber-400' },
    { label: 'ปฏิบัติตาม', items: compliant, borderColor: 'border-green-500/30', bgColor: 'bg-green-500/5', textColor: 'text-green-400' },
  ];

  if (!findings.length) {
    return <div className="py-16 text-center text-sm text-t3">ไม่มีข้อมูลผลการวิเคราะห์</div>;
  }

  return (
    <div className="px-5 py-4 space-y-4">
      {summary ? (
        <div className="rounded-lg border border-border bg-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-t3 mb-1.5">สรุปผล</p>
          <p className="text-sm text-t1">{summary}</p>
        </div>
      ) : null}

      {sections.map(({ label, items, borderColor, bgColor, textColor }) =>
        items.length ? (
          <div key={label}>
            <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${textColor}`}>
              {label} ({items.length})
            </h3>
            <ul className="grid gap-2">
              {items.map((f) => (
                <li key={f.ruleCode} className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <RiskBadge riskLevel={f.riskLevel as 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'} />
                    <span className="font-mono text-xs text-t3">{f.ruleCode}</span>
                    <span className="text-xs font-medium text-t1">{f.ruleTitle}</span>
                  </div>
                  <p className="text-xs text-t2">{f.explanation}</p>
                  {f.evidence ? (
                    <p className="mt-1 text-xs text-t3">
                      <span className="font-medium">หลักฐาน:</span> {f.evidence}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}

      {recommendedAction ? (
        <div className="rounded-lg border border-border bg-raised p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-t3 mb-1">คำแนะนำ</p>
          <p className="text-sm text-t2">{recommendedAction}</p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function ComplianceCheckCard({
  check,
}: {
  check: ComplianceCheckRecord;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const latest = check.results[0];
  const findings = Array.isArray(latest?.matchedRules) ? (latest.matchedRules as AiFinding[]) : [];
  const violations = findings.filter((f) => f.status === 'VIOLATED');
  const potentials = findings.filter((f) => f.status === 'POTENTIAL');
  const meta = check.metadata;
  const statusCfg = STATUS_CONFIG[check.status] ?? STATUS_CONFIG.AMBIGUOUS;
  const StatusIcon = statusCfg.icon;
  const displayTitle = meta?.title ?? (check.inputType === 'IMAGE' ? 'ภาพ (ไม่มีชื่อ)' : check.inputType);

  return (
    <>
      <article className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="grid gap-2">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusIcon size={16} className={statusCfg.color} aria-hidden />
            <span className={`text-sm font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
            {meta?.hasImage ? (
              <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-t3">
                <ImageIcon size={10} /> ภาพ
              </span>
            ) : null}
            <span className="font-medium text-t1">{displayTitle}</span>
            <span className="text-xs text-t3">{formatDateTime(check.createdAt)}</span>
          </div>

          {/* Rulebook label */}
          {meta?.rulebookTitle ? (
            <p className="text-xs text-t3">กฎระเบียบ: {meta.rulebookTitle}</p>
          ) : null}

          {/* Summary */}
          {latest?.summary ? <p className="text-sm text-t2">{latest.summary}</p> : null}

          {/* Focus prompt */}
          {meta?.focusPrompt ? (
            <p className="flex items-center gap-1 text-xs text-t3">
              <Sparkles size={11} aria-hidden /> โฟกัส: {meta.focusPrompt}
            </p>
          ) : null}

          {/* Count badges */}
          {typeof meta?.totalRulesChecked === 'number' ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-400">{meta.violationsCount ?? 0} ละเมิด</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">{meta.potentialCount ?? 0} อาจละเมิด</span>
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-green-400">{meta.compliantCount ?? 0} ปฏิบัติตาม</span>
              <span className="rounded-full bg-raised px-2 py-0.5 text-t3">จาก {meta.totalRulesChecked} กฎ</span>
            </div>
          ) : null}

          {/* Violations preview */}
          {violations.length > 0 ? (
            <ul className="grid gap-2">
              {violations.slice(0, 3).map((f) => (
                <li key={f.ruleCode} className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge riskLevel={f.riskLevel as 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'} />
                    <span className="font-mono text-xs text-t3">{f.ruleCode}</span>
                    <span className="text-xs font-medium text-t1">{f.ruleTitle}</span>
                  </div>
                  <p className="mt-1 text-xs text-t2">{f.explanation}</p>
                  {f.evidence ? <p className="mt-0.5 truncate text-xs text-t3">หลักฐาน: {f.evidence}</p> : null}
                </li>
              ))}
              {violations.length > 3 ? <li className="text-xs text-t3">…และอีก {violations.length - 3} กฎที่ละเมิด</li> : null}
            </ul>
          ) : null}

          {/* Potentials (only if no violations) */}
          {violations.length === 0 && potentials.length > 0 ? (
            <ul className="grid gap-1.5">
              {potentials.slice(0, 2).map((f) => (
                <li key={f.ruleCode} className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge riskLevel={f.riskLevel as 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'} />
                    <span className="font-mono text-xs text-t3">{f.ruleCode}</span>
                    <span className="text-xs font-medium text-t1">{f.ruleTitle}</span>
                  </div>
                  <p className="mt-1 text-xs text-t2">{f.explanation}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Recommended action */}
          {latest?.recommendedAction ? (
            <p className="text-xs text-t3">คำแนะนำ: {latest.recommendedAction}</p>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-col gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-sm font-medium text-t2 hover:text-t1 transition-colors"
          >
            <Info size={14} />
            ดูรายละเอียด
          </button>
          <a
            href={`/api/compliance-pdf?id=${check.id}&title=${encodeURIComponent(meta?.title ?? check.inputType)}`}
            download
            className="inline-flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-sm font-medium text-t2 hover:text-t1 transition-colors"
          >
            <Download size={14} />
            ดาวน์โหลด PDF
          </a>
        </div>
      </article>

      {modalOpen ? <DetailModal check={check} onClose={() => setModalOpen(false)} /> : null}
    </>
  );
}
