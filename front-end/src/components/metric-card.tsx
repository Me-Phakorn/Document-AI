import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}

export function MetricCard({ icon: Icon, label, value, detail }: MetricCardProps) {
  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-t3">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-t1">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-raised text-accent">
          <Icon size={17} aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-sm text-t2">{detail}</p>
    </section>
  );
}