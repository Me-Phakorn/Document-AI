'use client';

import { CheckSquare2, ExternalLink, Pencil, Square } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useTransition } from 'react';
import { StatusBadge } from '@/components/status-badge';
import type { DocumentVersionRecord } from '@/lib/api/documents';
import { formatBytes, formatDate, formatDateTime, shortHash } from '@/lib/format';
import { submitForAnalysisAction } from './actions';

interface Props {
  items: DocumentVersionRecord[];
}

const PAGE_LIMIT = 20;

export function DocumentsTable({ items }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Reset to first page whenever the items list changes (URL filter/search update)
  useEffect(() => { setPage(1); }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_LIMIT));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice((safePage - 1) * PAGE_LIMIT, safePage * PAGE_LIMIT);

  const allSelected = pageItems.length > 0 && pageItems.every((item) => selected.has(item.id));
  const someSelected = !allSelected && pageItems.some((item) => selected.has(item.id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageItems.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pageItems.forEach((item) => next.add(item.id));
        return next;
      });
    }
    setFeedback(null);
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFeedback(null);
  }

  function clearSelection() {
    setSelected(new Set());
    setFeedback(null);
  }

  function handleSubmit() {
    const ids = [...selected];
    startTransition(async () => {
      try {
        const result = await submitForAnalysisAction(ids);
        setSelected(new Set());
        if (result.skipped > 0 && result.queued === 0) {
          setFeedback('รายการที่เลือกกำลังประมวลผลอยู่แล้ว');
        } else if (result.skipped > 0) {
          setFeedback(`เพิ่มเข้าคิว ${result.queued} รายการ · ข้าม ${result.skipped} (กำลังประมวลผล)`);
        } else {
          setFeedback(`เพิ่ม ${result.queued} รายการเข้าคิว AI วิเคราะห์แล้ว`);
        }
      } catch {
        setFeedback('เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    });
  }

  return (
    <div>
      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-border bg-accent/5 px-4 py-2 text-sm">
          <span className="font-medium text-t1">{selected.size} รายการที่เลือก</span>
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            disabled={isPending}
            onClick={handleSubmit}
            type="button"
          >
            {isPending ? 'กำลังส่ง…' : 'เพิ่มเข้าคิว Review'}
          </button>
          <button
            className="text-xs text-t3 hover:text-t1"
            onClick={clearSelection}
            type="button"
          >
            ยกเลิก
          </button>
          {feedback && (
            <span className="ml-2 text-xs text-t2">{feedback}</span>
          )}
        </div>
      )}
      {feedback && selected.size === 0 && (
        <div className="border-b border-border bg-green/5 px-4 py-2 text-xs text-green">
          {feedback}
        </div>
      )}

      {items.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-t2">
          No documents have been imported yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
            <thead className="bg-raised text-xs uppercase tracking-wide text-t3">
              <tr>
                <th className="w-10 px-3 py-2 font-medium">
                  <button
                    aria-label={allSelected ? 'Deselect all' : 'Select all'}
                    className="flex items-center text-t3 hover:text-t1"
                    onClick={toggleAll}
                    type="button"
                  >
                    {allSelected ? (
                      <CheckSquare2 size={15} className="text-accent" />
                    ) : someSelected ? (
                      <CheckSquare2 size={15} className="text-t3 opacity-60" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">Document</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">OCR</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Hash</th>
                <th className="px-3 py-2 font-medium">Doc date</th>
                <th className="px-3 py-2 font-medium">Imported</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageItems.map((dv) => {
                const isSelected = selected.has(dv.id);
                return (
                  <tr
                    key={dv.id}
                    className={`align-middle transition-colors ${isSelected ? 'bg-accent/5' : 'hover:bg-raised/50'}`}
                  >
                    <td className="px-3 py-1.5">
                      <button
                        aria-label={isSelected ? 'Deselect' : 'Select'}
                        className="flex items-center text-t3 hover:text-accent"
                        onClick={() => toggleOne(dv.id)}
                        type="button"
                      >
                        {isSelected ? (
                          <CheckSquare2 size={15} className="text-accent" />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-1.5">
                      <Link
                        className="font-medium text-accent hover:underline"
                        href={`/documents/${dv.id}`}
                      >
                        {dv.title}
                      </Link>
                      <span className="ml-2 text-xs text-t3">v{dv.versionNumber}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={dv.status} />
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="rounded border border-border bg-raised px-1.5 py-0.5 text-[11px] font-medium text-t2">
                        {dv.ocrStatus}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-t2">{formatBytes(dv.byteSize)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-t3">
                      {shortHash(dv.fileSha256)}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-t2">
                      {dv.sourceDocumentDate
                        ? formatDate(dv.sourceDocumentDate)
                        : (dv.sourceDocumentDateText ?? '—')}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-t2">
                      {formatDateTime(dv.createdAt)}
                    </td>
                    <td className="px-3 py-1.5">
                      {dv.sourceUrl ? (
                        <a
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          href={dv.sourceUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          PDF <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-xs text-t3">Upload</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <Link
                        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium text-t2 hover:bg-raised"
                        href={`/documents/${dv.id}`}
                      >
                        <Pencil size={11} />
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
          <span className="text-xs text-t3">
            {items.length > 0
              ? `${(safePage - 1) * PAGE_LIMIT + 1}–${Math.min(safePage * PAGE_LIMIT, items.length)} of ${items.length} รายการ`
              : '0 รายการ'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="inline-flex h-7 items-center rounded border border-border px-2.5 text-xs font-medium text-t2 hover:bg-raised disabled:pointer-events-none disabled:opacity-40"
            >
              ← ก่อนหน้า
            </button>
            <span className="min-w-[4rem] text-center text-xs text-t2">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="inline-flex h-7 items-center rounded border border-border px-2.5 text-xs font-medium text-t2 hover:bg-raised disabled:pointer-events-none disabled:opacity-40"
            >
              ถัดไป →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
