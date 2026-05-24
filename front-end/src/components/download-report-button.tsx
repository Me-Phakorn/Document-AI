'use client';

import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  rulebookId: string;
  /** When provided, generates a single-document PDF download; otherwise opens combined print page */
  documentId?: string;
  documentTitle?: string;
  label?: string;
  className?: string;
}

export function DownloadReportButton({
  rulebookId,
  documentId,
  documentTitle,
  label = 'ดาวน์โหลด PDF',
  className,
}: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    const params = new URLSearchParams({ rulebookId });
    if (documentId) params.set('documentId', documentId);
    if (documentTitle) params.set('title', documentTitle);

    setDownloading(true);
    try {
      const res = await fetch(`/api/rulebook-pdf?${params.toString()}`);
      if (!res.ok) {
        // Fall back to print page if PDF generation fails (e.g. Chrome not found)
        window.open(`/rulebook/print?${params.toString()}`, '_blank', 'noopener');
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      if (documentId) {
        a.download = documentTitle ? `${documentTitle}.pdf` : `rulebook-${rulebookId.slice(0, 8)}.pdf`;
      } else {
        a.download = documentTitle ? `${documentTitle}.pdf` : `rulebook-${rulebookId.slice(0, 8)}-all.pdf`;
      }
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(`/rulebook/print?${params.toString()}`, '_blank', 'noopener');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={downloading}
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium text-t2 transition-colors hover:bg-raised disabled:pointer-events-none disabled:opacity-60'
      }
    >
      {downloading ? (
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
      ) : (
        <FileText size={13} aria-hidden="true" />
      )}
      {downloading ? 'กำลังสร้าง PDF...' : label}
    </button>
  );
}

