'use client';

import { useEffect } from 'react';

export function PrintTrigger() {
  useEffect(() => {
    // Give the browser one tick to finish layout before opening the print dialog
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);

  return null;
}
