'use client';

import { Play } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export function RunScanButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-sm font-medium text-t2 transition-all hover:bg-white hover:text-t1 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          Starting scan…
        </>
      ) : (
        <>
          <Play size={14} aria-hidden="true" />
          Run Scan
        </>
      )}
    </button>
  );
}
