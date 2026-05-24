const BADGE_MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'รอ Review', cls: 'border-accent/40 bg-[var(--accent-lo)] text-accent' },
  APPROVED: { label: 'อนุมัติ', cls: 'border-green/40 bg-green/10 text-green' },
  REJECTED: { label: 'ปฏิเสธ', cls: 'border-red/40 bg-red/10 text-red' },
  CHANGES_REQUESTED: { label: 'ขอแก้ไข', cls: 'border-amber/40 bg-amber/10 text-amber' },
  REQUEST_CHANGES: { label: 'ขอแก้ไข', cls: 'border-amber/40 bg-amber/10 text-amber' },
  CONFIRMED_NOT_RELEVANT: { label: 'ไม่เกี่ยวข้อง', cls: 'border-border bg-raised text-t3' },
  OVERRIDDEN: { label: 'Override', cls: 'border-border bg-raised text-t3' },
};

export function OutcomeBadge({ value }: { value: string | null }) {
  const entry = BADGE_MAP[value ?? ''] ?? {
    label: value?.replaceAll('_', ' ') ?? 'Unknown',
    cls: 'border-border bg-raised text-t2',
  };
  return (
    <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${entry.cls}`}>
      {entry.label}
    </span>
  );
}
