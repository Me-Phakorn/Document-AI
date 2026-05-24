'use client';

import { Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReviewItemRecord } from '@/lib/api/review';
import { formatDateTime } from '@/lib/format';
import { OutcomeBadge } from './outcome-badge';

const SECTION_LIMIT = 5;

interface Props {
  items: ReviewItemRecord[];
}

export function NotRelevantSection({ items }: Props) {
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / SECTION_LIMIT));
  const safe = Math.min(page, totalPages);
  const slice = items.slice((safe - 1) * SECTION_LIMIT, safe * SECTION_LIMIT);

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Archive size={15} className="text-t3" aria-hidden="true" />
          <h2 className="font-semibold text-t1">ไม่เกี่ยวข้อง</h2>
          <span className="text-xs text-t3">{items.length} รายการ</span>
        </div>
        <p className="mt-0.5 text-xs text-t3">เอกสารที่ถูกยืนยันว่าไม่เกี่ยวข้องกับ compliance</p>
      </div>

      <div className="divide-y divide-border">
        {slice.map((item) => {
          const doc = item.aiAnalysisResult?.documentVersion;
          const aiResultData = item.aiAnalysisResult?.result as
            | { notRelevantReason?: string }
            | undefined;

          return (
            <div key={item.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <OutcomeBadge value="CONFIRMED_NOT_RELEVANT" />
                <h3 className="text-sm font-semibold leading-5 text-t1">
                  {doc?.title ?? 'Document'}
                </h3>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-t3">
                <span>เข้าคิว {formatDateTime(item.createdAt)}</span>
                {item.decidedAt ? (
                  <span>ยืนยัน {formatDateTime(item.decidedAt)}</span>
                ) : null}
              </div>

              {aiResultData?.notRelevantReason ? (
                <p className="mt-2 text-sm leading-6 text-t2">{aiResultData.notRelevantReason}</p>
              ) : null}
              {item.comment ? (
                <p className="mt-2 rounded-md border border-border bg-raised px-3 py-2 text-sm italic text-t2">
                  &ldquo;{item.comment}&rdquo;
                </p>
              ) : null}
            </div>
          );
        })}

        {!items.length ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-t2">ยังไม่มีเอกสารที่ไม่เกี่ยวข้อง</p>
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
    </section>
  );
}
