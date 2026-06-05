'use client';

import { Archive, AlertTriangle, BookOpen, CheckCircle2, Clock, FileText, Loader2, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ReviewItemRecord } from '@/lib/api/review';
import { formatDateTime } from '@/lib/format';
import { OutcomeBadge } from './outcome-badge';

type RuleEntry = Record<string, unknown>;

interface RulesModal {
  docTitle: string;
  rules: unknown[];
}

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
            <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${SEVERITY_CLS[String(severity).toUpperCase()] ?? 'border-border bg-raised text-t3'}`}>
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



const SECTION_LIMIT = 5;

function SubmitButton({ icon, label, variant, disabled: externalDisabled }: { icon: React.ReactNode; label: string; variant: 'accent' | 'outline'; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const base = 'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60';
  const cls = variant === 'accent'
    ? `${base} bg-accent text-white hover:brightness-110 shadow-sm`
    : `${base} border border-border text-t2 hover:bg-raised hover:text-t1`;
  return (
    <button type="submit" disabled={pending || externalDisabled} className={cls}>
      {pending ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

interface Props {
  items: ReviewItemRecord[];
  hasActiveTemplate: boolean;
  onApprove: (formData: FormData) => Promise<void>;
  onRequestChanges: (formData: FormData) => Promise<void>;
  onConfirmNotRelevant: (formData: FormData) => Promise<void>;
}

export function ReviewPendingSection({ items, hasActiveTemplate, onApprove, onRequestChanges, onConfirmNotRelevant }: Props) {
  const [page, setPage] = useState(1);
  const [rulesModal, setRulesModal] = useState<RulesModal | null>(null);

  // Reset to page 1 when items list changes (after server action revalidates)
  useEffect(() => { setPage(1); }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / SECTION_LIMIT));
  const safe = Math.min(page, totalPages);
  const slice = items.slice((safe - 1) * SECTION_LIMIT, safe * SECTION_LIMIT);

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Clock size={15} className={items.length > 0 ? 'text-accent' : 'text-t3'} aria-hidden="true" />
          <h2 className="font-semibold text-t1">รอ Review</h2>
          <span className="text-xs text-t3">{items.length} รายการ</span>
        </div>
        <p className="mt-0.5 text-xs text-t3">เอกสารที่ AI วิเคราะห์แล้ว รอการตัดสินใจจาก Reviewer</p>
      </div>

      {!hasActiveTemplate && (
        <div className="flex items-start gap-3 border-b border-amber/30 bg-amber/10 px-5 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-amber">ไม่มี Prompt Template ที่ Activate อยู่</p>
            <p className="mt-0.5 text-xs text-t2">
              กรุณาไปที่{' '}
              <a href="/prompts" className="underline hover:text-t1">Prompt Library</a>{' '}
              และ Activate template version ก่อน จึงจะสามารถทำ Review ได้
            </p>
          </div>
        </div>
      )}

      <div className="divide-y divide-border">
        {slice.map((item) => {
          const doc = item.aiAnalysisResult?.documentVersion;
          const aiResult = item.aiAnalysisResult;
          const aiResultData = aiResult?.result as
            | { summary?: string; rules?: unknown[]; notRelevantReason?: string }
            | undefined;

          return (
            <div key={item.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <OutcomeBadge value="PENDING" />
                <h3 className="text-sm font-semibold leading-5 text-t1">
                  {doc?.title ?? 'Document'}
                </h3>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-t3">
                <span>เข้าคิว {formatDateTime(item.createdAt)}</span>
                {aiResult?.outcome ? (
                  <span className="flex items-center gap-1">
                    <FileText size={11} aria-hidden="true" />
                    AI: {aiResult.outcome.replaceAll('_', ' ')}
                  </span>
                ) : null}
                {typeof aiResult?.confidence === 'number' ? (
                  <span>Confidence {(aiResult.confidence * 100).toFixed(0)}%</span>
                ) : null}
                {Array.isArray(aiResultData?.rules) ? (
                  <button
                    type="button"
                    onClick={() =>
                      setRulesModal({
                        docTitle: doc?.title ?? 'Document',
                        rules: aiResultData.rules!,
                      })
                    }
                    className="flex items-center gap-1 rounded border border-accent/40 bg-[var(--accent-lo)] px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent/10"
                  >
                    <BookOpen size={11} />
                    {aiResultData.rules.length} rules
                  </button>
                ) : null}
              </div>

              {aiResultData?.summary ? (
                <p className="mt-2 text-sm leading-6 text-t2">{aiResultData.summary}</p>
              ) : null}
              {aiResultData?.notRelevantReason ? (
                <p className="mt-2 text-sm leading-6 text-t2">{aiResultData.notRelevantReason}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-border/50 pt-4">
                <textarea
                  form={`rc-${item.id}`}
                  name="comment"
                  placeholder="Reviewer comment (จำเป็นสำหรับ Request Changes)"
                  disabled={!hasActiveTemplate}
                  className="min-h-[4rem] flex-1 rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="flex flex-wrap gap-2">
                  {item.reviewType === 'NOT_RELEVANT' || aiResult?.outcome === 'NO_RULES_FOUND' ? (
                    <form action={onConfirmNotRelevant}>
                      <input type="hidden" name="reviewItemId" value={item.id} />
                      <SubmitButton icon={<Archive size={14} />} label="Confirm Not Relevant" variant="accent" disabled={!hasActiveTemplate} />
                    </form>
                  ) : (
                    <form action={onApprove}>
                      <input type="hidden" name="reviewItemId" value={item.id} />
                      <SubmitButton icon={<CheckCircle2 size={14} />} label="Approve" variant="accent" disabled={!hasActiveTemplate} />
                    </form>
                  )}
                  <form id={`rc-${item.id}`} action={onRequestChanges}>
                    <input type="hidden" name="reviewItemId" value={item.id} />
                    <SubmitButton icon={<XCircle size={14} />} label="Request Changes" variant="outline" disabled={!hasActiveTemplate} />
                  </form>
                </div>
              </div>
            </div>
          );
        })}

        {!items.length ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-3 text-green/60" aria-hidden="true" />
            <p className="text-sm font-medium text-t2">ไม่มีรายการที่รอ Review</p>
            <p className="mt-1 text-xs text-t3">เอกสารทั้งหมดได้รับการตัดสินใจแล้ว</p>
          </div>
        ) : null}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
          <span className="text-xs text-t3">
            {`${(safe - 1) * SECTION_LIMIT + 1}–${Math.min(safe * SECTION_LIMIT, items.length)} of ${items.length} รายการ`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safe <= 1}
              onClick={() => setPage(safe - 1)}
              className="inline-flex h-7 items-center rounded border border-border px-2.5 text-xs font-medium text-t2 hover:bg-raised disabled:pointer-events-none disabled:opacity-40"
            >
              ← ก่อนหน้า
            </button>
            <span className="min-w-[4rem] text-center text-xs text-t2">
              {safe} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safe >= totalPages}
              onClick={() => setPage(safe + 1)}
              className="inline-flex h-7 items-center rounded border border-border px-2.5 text-xs font-medium text-t2 hover:bg-raised disabled:pointer-events-none disabled:opacity-40"
            >
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {rulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRulesModal(null)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-accent" aria-hidden="true" />
                  <h3 className="font-semibold text-t1">Rule Candidates</h3>
                  <span className="rounded border border-border bg-raised px-1.5 py-0.5 text-xs text-t3">
                    {rulesModal.rules.length} รายการ
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-t3 line-clamp-1">{rulesModal.docTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setRulesModal(null)}
                className="shrink-0 rounded-md p-1 text-t3 hover:bg-raised hover:text-t1"
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-4">
              <ul className="space-y-3">
                {rulesModal.rules.map((rule, i) => (
                  <RuleCard key={i} rule={rule} index={i} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
