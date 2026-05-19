import { History } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { listAuditLogs } from '@/lib/api/audit';
import { formatDateTime, shortHash } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const logs = await listAuditLogs({ limit: 75 });

  return (
    <div>
      <PageHeader
        eyebrow="Audit"
        title="State change trail"
        description="Audited transitions across imports, OCR artifacts, AI results, review actions, rulebooks, reports, sources, prompts, and users."
      />

      <section className="overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-t1">Audit logs</h2></div>
        <div className="divide-y divide-border">
          {logs.items.map((log) => (
            <article key={log.id} className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr_180px] md:items-center">
              <div className="flex items-center gap-2 text-sm text-t2"><History size={15} className="text-accent" />{formatDateTime(log.createdAt)}</div>
              <div>
                <p className="font-medium text-t1">{log.action}</p>
                <p className="mt-1 text-sm text-t2">{log.entityType} · {shortHash(log.entityId)} · actor {log.actorId ? shortHash(log.actorId) : log.actorType}</p>
              </div>
              <p className="truncate font-mono text-xs text-t3">{log.correlationId}</p>
            </article>
          ))}
          {!logs.items.length ? <div className="px-4 py-12 text-center text-sm text-t2">No audit records have been written yet.</div> : null}
        </div>
      </section>
    </div>
  );
}