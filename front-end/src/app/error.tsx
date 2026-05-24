'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium text-red">Something went wrong</p>
      <p className="max-w-sm text-sm text-t2">{error.message || 'An unexpected error occurred.'}</p>
      <button
        onClick={reset}
        className="rounded-md border border-border bg-raised px-4 py-2 text-sm text-t1 transition hover:bg-white"
      >
        Try again
      </button>
    </div>
  );
}
