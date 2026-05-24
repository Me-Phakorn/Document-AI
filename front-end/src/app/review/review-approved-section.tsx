'use client';

import { BookOpen, CheckCircle2, ChevronRight, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReviewItemRecord } from '@/lib/api/review';
import { formatDateTime } from '@/lib/format';
import { OutcomeBadge } from './outcome-badge';

// ─── RuleCard ─────────────────────────────────────────────────────────────────
type RuleEntry = Record<string, unknown>;

function RuleCard({ rule, index }: { rule: unknown; index: number }) {
  if (typeof rule === 'string') {
    return (
      <li className="rounded-lg border border-border bg-raised p-3 text-sm text-t1">
        <span className="mr-2 font-mono text-xs text-t3">{index + 1}.</span>
        {rule}
      </li>
    );
  }
  if (typeof rule !== 'object' || rule === null) return null;
  const r = rule as RuleEntry;
  const title = (r.title ?? r.name ?? r.ruleId ?? r.id ?? `Rule ${index + 1}`) as string;
  const description = (r.description ?? r.content ?? r.text ?? '') as string;
  const category = (r.category ?? r.type ?? '') as string;
  const severity = (r.severity ?? r.risk ?? '') as string;
  const SEVERITY_CLS: Record<string, string> = {
    HIGH: 'border-red/40 bg-red/10 text-red',
    MEDIUM: 'border-amber/40 bg-amber/10 text-amber',
    LOW: 'border-border bg-raised text-t3',
    CRITICAL: 'border-red/60 bg-red/15 text-red',
  };
  return (
    <li className="rounded-lg border border-border bg-raised p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm font-semibold text-t1">
          <span className="mr-1.5 font-mono text-xs text-t3">{index + 1}.</span>
          {String(title)}
        </span>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {category ? (
            <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] font-medium text-t3">
              {String(category)}
            </span>
          ) : null}
          {severity ? (
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                SEVERITY_CLS[String(severity).toUpperCase()] ?? 'border-border bg-raised text-t3'
              }`}
            >
              {String(severity)}
            </span>
          ) : null}
        </div>
      </div>
      {description ? (
        <p className="mt-1.5 text-xs leading-5 text-t2">{String(description)}</p>
      ) : null}
    </li>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DetailModal {
  item: ReviewItemRecord;
  history: ReviewItemRecord[];
}

const SECTION_LIMIT = 5;

interface Props {
  items: ReviewItemRecord[];
  allItems: ReviewItemRecord[];
}

export function ReviewApprovedSection({ items, allItems }: Props) {
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<DetailModal | null>(null);

  useEffect(() => { setPage(1); }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / SECTION_LIMIT));
  const safe = Math.min(page, totalPages);
  const slice = items.slice((safe - 1) * SECTION_LIMIT, safe * SECTION_LIMIT);

  function openDetail(item: ReviewItemRecord) {
    const history = allItems
      .filter((i) => i.aiAnalysisResultId && i.aiAnalysisResultId === item.aiAnalysisResultId)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    setDetail({ item, history });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className={items.length > 0 ? 'text-green' : 'text-t3'} aria-hidden="true" />
          <h2 className="font-semibold text-t1">รีวิวเรียบร้อยแล้ว</h2>
          <span className="text-xs text-t3">{items.length} รายการ</span>
        </div>
        <p className="mt-0.5 text-xs text-t3">เอกสารที่อนุมัติแล้ว — กดเพื่อดูรายละเอียด</p>
      </div>

      <div className="divide-y divide-border">
        {slice.map((item) => {
          const doc = item.aiAnalysisResult?.documentVersion;
          const aiResult = item.aiAnalysisResult;
          const aiResultData = aiResult?.result as { summary?: string; rules?: unknown[] } | undefined;
          const rulesCount = Array.isArray(aiResultData?.rules) ? aiResultData.rules.length : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openDetail(item)}
              className="group w-full px-5 py-3 text-left transition-colors hover:bg-raised"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <OutcomeBadge value="APPROVED" />
                  <h3 className="truncate text-sm font-semibold text-t1 group-hover:text-accent">
                    {doc?.title ?? 'Document'}
                  </h3>
                </div>
                <ChevronRight size={14} className="shrink-0 text-t3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-t3">
                {item.decidedAt ? (
                  <span>อนุมัติ {formatDateTime(item.decidedAt)}</span>
                ) : (
                  <span>เข้าคิว {formatDateTime(item.createdAt)}</span>
                )}
                {typeof aiResult?.confidence === 'number' ? (
                  <span className="flex items-center gap-1">
                    <FileText size={10} aria-hidden="true" />
                    {(aiResult.confidence * 100).toFixed(0)}% confidence
                  </span>
                ) : null}
                {rulesCount > 0 ? (
                  <span className="flex items-center gap-1 font-medium text-accent">
                    <BookOpen size={10} aria-hidden="true" />
                    {rulesCount} rules
                  </span>
                ) : null}
              </div>

              {aiResultData?.summary ? (
                <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-t2">
                  {aiResultData.summary}
                </p>
              ) : null}
              {item.comment ? (
                <p className="mt-1 text-xs italic text-t3">&ldquo;{item.comment}&rdquo;</p>
              ) : null}
            </button>
          );
        })}

        {!items.length ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-t2">ยังไม่มีเอกสารที่อนุมัติแล้ว</p>
            <p className="mt-1 text-xs text-t3">รอ Reviewer อนุมัติรายการในคิว</p>
          </div>
        ) : null}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
          <span className="text-xs text-t3">
            {`${(safe - 1) * SECTION_LIMIT + 1}–${Math.min(safe * SECTION_LIMIT, items.length)} of ${items.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safe <= 1}
              onClick={() => setPage(safe - 1)}
              className="inline-flex h-7 items-center rounded border border-border px-2.5 text-xs font-medium text-t2 hover:bg-raised disabled:pointer-events-none disabled:opacity-40"
            >
              ←
            </button>
            <span className="min-w-[3.5rem] text-center text-xs text-t2">{safe} / {totalPages}</span>
            <button
              type="button"
              disabled={safe >= totalPages}
              onClick={() => setPage(safe + 1)}
              className="inline-flex h-7 items-center rounded border border-border px-2.5 text-xs font-medium text-t2 hover:bg-raised disabled:pointer-events-none disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ──────────────────────────────────────────────── */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-green" aria-hidden="true" />
                  <h3 className="truncate font-semibold text-t1">
                    {detail.item.aiAnalysisResult?.documentVersion?.title ?? 'Document'}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-t3">
                  {detail.history.length} รอบรีวิว ·{' '}
                  {detail.item.decidedAt
                    ? `อนุมัติ ${formatDateTime(detail.item.decidedAt)}`
                    : 'ยังไม่มีวันที่'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="shrink-0 rounded-md p-1 text-t3 hover:bg-raised hover:text-t1"
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-5 overflow-y-auto px-6 py-5">
              {/* AI Summary */}
              {(() => {
                const d = detail.item.aiAnalysisResult?.result as { summary?: string } | undefined;
                return d?.summary ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-t3">AI Summary</p>
                    <p className="text-sm leading-6 text-t2">{d.summary}</p>
                  </div>
                ) : null;
              })()}

              {/* Review history */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-t3">
                  ประวัติการรีวิว ({detail.history.length} ครั้ง)
                </p>
                {detail.history.length > 0 ? (
                  <ol className="space-y-2">
                    {detail.history.map((h) => {
                      const isDeciding = h.outcome === 'APPROVED';
                      return (
                        <li
                          key={h.id}
                          className={`rounded-lg border p-3 ${isDeciding ? 'border-green/30 bg-green/5' : 'border-border bg-raised'}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${isDeciding ? 'bg-green text-white' : 'border border-border bg-panel text-t3'}`}
                              >
                                {h.roundNumber}
                              </span>
                              <OutcomeBadge value={h.outcome ?? 'PENDING'} />
                              {isDeciding ? (
                                <span className="text-xs font-medium text-green">★ รอบที่อนุมัติ</span>
                              ) : null}
                            </div>
                            {h.decidedAt ? (
                              <span className="text-xs text-t3">{formatDateTime(h.decidedAt)}</span>
                            ) : null}
                          </div>
                          {h.comment ? (
                            <p className="mt-1.5 text-xs leading-5 italic text-t2">&ldquo;{h.comment}&rdquo;</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-xs text-t3">ไม่พบประวัติการรีวิว</p>
                )}
              </div>

              {/* AI Rules */}
              {(() => {
                const d = detail.item.aiAnalysisResult?.result as { rules?: unknown[] } | undefined;
                const rules = d?.rules;
                if (!Array.isArray(rules) || rules.length === 0) return null;
                return (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-t3">
                      Rules ที่ AI พบ ({rules.length})
                    </p>
                    <ul className="space-y-2">
                      {rules.map((rule, i) => (
                        <RuleCard key={i} rule={rule} index={i} />
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
