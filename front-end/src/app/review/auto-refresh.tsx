'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Silently calls router.refresh() on an interval so the review page stays live. */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
