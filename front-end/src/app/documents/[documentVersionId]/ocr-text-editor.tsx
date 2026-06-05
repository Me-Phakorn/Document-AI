'use client';

import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { apiPatchBrowser } from '@/lib/api-client-browser';

interface Props {
  documentVersionId: string;
  initialText: string;
}

export function OcrTextEditor({ documentVersionId, initialText }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialText);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function openEditor() {
    setEditing(true);
    setError(null);
    // Focus textarea on next render
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setText(initialText);
    setEditing(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await apiPatchBrowser(`/documents/${documentVersionId}/ocr-text`, { text });
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
      }
    });
  }

  if (!editing) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={openEditor}
          className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs font-medium text-t2 shadow-sm hover:bg-raised hover:text-t1"
          title="Edit OCR text manually"
        >
          <Pencil size={12} aria-hidden="true" />
          Edit
        </button>
        <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap p-5 font-sans text-sm leading-7 text-t2">
          {text || <span className="text-t3 italic">No text content</span>}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-[var(--accent-lo)] px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
          <Pencil size={12} aria-hidden="true" />
          แก้ไข OCR text — จะบันทึกเป็น MANUAL EDIT
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs font-medium text-t2 hover:bg-raised disabled:opacity-50"
          >
            <X size={12} aria-hidden="true" />
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <Check size={12} aria-hidden="true" />
            )}
            {isPending ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red/20 bg-red/5 px-4 py-2 text-xs text-red">{error}</div>
      )}

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isPending}
        className="min-h-[400px] w-full resize-y bg-white p-5 font-sans text-sm leading-7 text-t1 focus:outline-none disabled:opacity-60"
        placeholder="พิมพ์หรือวางเนื้อหาที่นี่…"
        spellCheck={false}
      />

      <div className="border-t border-border bg-raised/50 px-4 py-2 text-xs text-t3">
        {text.length.toLocaleString()} ตัวอักษร
        {text !== initialText && (
          <span className="ml-2 text-accent">• มีการแก้ไข</span>
        )}
      </div>
    </div>
  );
}
