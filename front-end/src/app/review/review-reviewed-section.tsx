'use client';

import { FileText, Loader2, RefreshCw, Search, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ReviewItemRecord } from '@/lib/api/review';
import { formatDateTime } from '@/lib/format';
import { OutcomeBadge } from './outcome-badge';

const SECTION_LIMIT = 5;

const OUTCOME_OPTIONS = [
  { value: '', label: 'ทุก Outcome' },
  { value: 'CHANGES_REQUESTED', label: 'ขอแก้ไข' },
  { value: 'REJECTED', label: 'ปฏิเสธ' },
  { value: 'OVERRIDDEN', label: 'Override' },
];

interface Props {
  items: ReviewItemRecord[];
  title?: string;
  description?: string;
  onReReview?: (formData: FormData) => Promise<void>;
}

function ReReviewButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={12} aria-hidden="true" />}
      {pending ? 'กำลังส่งไป AI ใหม่...' : 'Review ใหม่ (พร้อม Feedback)'}
    </button>
  );
}

export function ReviewedSection({ items, title = 'ขอแก้ไข / ปฏิเสธ', description = 'เอกสารที่รอการแก้ไขหรือถูกปฏิเสธจาก Reviewer', onReReview }: Props) {
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(1);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [search, outcome]);

  // Reset page when items change (after server revalidation)
  useEffect(() => { setPage(1); }, [items]);

  const filtered = items.filter((i) => {
    const title = (i.aiAnalysisResult?.documentVersion?.title ?? '').toLowerCase();
    const matchesSearch = !search.trim() || title.includes(search.toLowerCase().trim());
    const matchesOutcome = !outcome || i.outcome === outcome;
    return matchesSearch && matchesOutcome;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / SECTION_LIMIT));
  const safe = Math.min(page, totalPages);
  const slice = filtered.slice((safe - 1) * SECTION_LIMIT, safe * SECTION_LIMIT);

  const hasFilter = !!(search || outcome);

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <div className="flex items-center gap-2">
            <XCircle size={15} className={items.length > 0 ? 'text-amber' : 'text-t3'} aria-hidden="true" />
            <h2 className="font-semibold text-t1">{title}</h2>
            <span className="text-xs text-t3">
              {filtered.length !== items.length
                ? `${filtered.length} / ${items.length} รายการ`
                : `${items.length} รายการ`}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-t3">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-t3"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเอกสาร..."
              className="h-8 w-44 rounded-md border border-border bg-raised pl-8 pr-3 text-xs text-t1 placeholder:text-t3 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="h-8 rounded-md border border-border bg-raised px-2.5 text-xs text-t1 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {hasFilter && (
            <button
              type="button"
              onClick={() => { setSearch(''); setOutcome(''); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-t3 hover:bg-raised"
            >
              <X size={12} />
              ล้าง
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {slice.map((item) => {
          const doc = item.aiAnalysisResult?.documentVersion;
          const aiResult = item.aiAnalysisResult;
          const aiResultData = aiResult?.result as
            | { summary?: string; notRelevantReason?: string }
            | undefined;

          return (
            <div key={item.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <OutcomeBadge value={item.outcome} />
                <h3 className="text-sm font-semibold leading-5 text-t1">
                  {doc?.title ?? 'Document'}
                </h3>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-t3">
                <span>เข้าคิว {formatDateTime(item.createdAt)}</span>
                {item.decidedAt ? (
                  <span>ตัดสินใจ {formatDateTime(item.decidedAt)}</span>
                ) : null}
                {aiResult?.outcome ? (
                  <span className="flex items-center gap-1">
                    <FileText size={11} aria-hidden="true" />
                    AI: {aiResult.outcome.replaceAll('_', ' ')}
                  </span>
                ) : null}
                {typeof aiResult?.confidence === 'number' ? (
                  <span>Confidence {(aiResult.confidence * 100).toFixed(0)}%</span>
                ) : null}
              </div>

              {aiResultData?.summary ? (
                <p className="mt-2 text-sm leading-6 text-t2">{aiResultData.summary}</p>
              ) : null}
              {item.comment ? (
                <p className="mt-2 rounded-md border border-border bg-raised px-3 py-2 text-sm italic text-t2">
                  &ldquo;{item.comment}&rdquo;
                </p>
              ) : null}

              {/* Re-review button — only for items still awaiting action */}
              {item.status === 'REQUEST_CHANGES' && onReReview ? (
                <form action={onReReview} className="mt-3">
                  <input type="hidden" name="reviewItemId" value={item.id} />
                  <ReReviewButton />
                </form>
              ) : null}
            </div>
          );
        })}

        {!filtered.length && !items.length ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-t2">ยังไม่มีเอกสารที่รีวิวแล้ว</p>
          </div>
        ) : null}
        {!filtered.length && items.length > 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-t2">ไม่พบเอกสารที่ตรงกับตัวกรอง</p>
            <p className="mt-1 text-xs text-t3">ลองเปลี่ยน Search หรือ Outcome filter</p>
          </div>
        ) : null}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
          <span className="text-xs text-t3">
            {filtered.length > 0
              ? `${(safe - 1) * SECTION_LIMIT + 1}–${Math.min(safe * SECTION_LIMIT, filtered.length)} of ${filtered.length} รายการ`
              : '0 รายการ'}
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
    </section>
  );
}
