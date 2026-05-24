'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ImportAutoRefreshProps {
  enabled: boolean;
  intervalMs?: number;
}

export function ImportAutoRefresh({ enabled, intervalMs = 5000 }: ImportAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    };

    const intervalId = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, router]);

  return null;
}
