'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '1rem',
            textAlign: 'center',
            padding: '1rem',
          }}
        >
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cf2e35' }}>Application error</p>
          <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '24rem' }}>
            {error.message || 'A critical error occurred. Refresh the page to try again.'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              background: '#f1f5f9',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
