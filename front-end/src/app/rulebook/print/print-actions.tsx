'use client';

export function PrintActions() {
  return (
    <div className="no-print" style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
      >
        พิมพ์ / บันทึก PDF
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        style={{ padding: '8px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
      >
        ปิด
      </button>
    </div>
  );
}
