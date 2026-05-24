import { BrainCircuit, CheckCircle2, Server, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { getAiConfig } from '@/lib/api/analysis';
import { getApiHealth } from '@/lib/api/health';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [health, aiConfig] = await Promise.all([getApiHealth(), getAiConfig()]);

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Configuration and operations"
        description="Live runtime settings from the DocAI API. Sensitive values remain redacted and are only represented by configured flags."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
          <div className="flex items-center gap-2 text-green">
            <Server size={17} aria-hidden="true" />
            <h2 className="font-semibold text-t1">API Health</h2>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-t3">Status</dt><dd className="font-medium text-t1">{health.status}</dd></div>
            <div><dt className="text-t3">Service</dt><dd className="font-medium text-t1">{health.service}</dd></div>
            <div><dt className="text-t3">Timestamp</dt><dd className="font-medium text-t1">{formatDateTime(health.timestamp)}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
          <div className="flex items-center gap-2 text-accent">
            <BrainCircuit size={17} aria-hidden="true" />
            <h2 className="font-semibold text-t1">AI Provider</h2>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-t3">Primary</dt><dd className="font-medium text-t1">{aiConfig.provider}</dd></div>
            <div><dt className="text-t3">Fallback</dt><dd className="font-medium text-t1">{aiConfig.fallbackProvider ?? 'none'}</dd></div>
            <div><dt className="text-t3">Model</dt><dd className="font-medium text-t1">{aiConfig.model}</dd></div>
            <div><dt className="text-t3">Model options</dt><dd className="font-medium text-t1">{aiConfig.modelOptions.length}</dd></div>
            <div><dt className="text-t3">OpenRouter key</dt><dd className="font-medium text-t1">{aiConfig.apiKeyConfigured ? 'configured' : 'missing'}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
          <div className="flex items-center gap-2 text-blue">
            <ShieldCheck size={17} aria-hidden="true" />
            <h2 className="font-semibold text-t1">Auth Gate</h2>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-sm text-t2">
            <CheckCircle2 size={15} className="text-green" aria-hidden="true" />
            Login page session stores a JWT token and frontend requests use Bearer auth for the API.
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-t3">Claude Code command</dt><dd className="font-medium text-t1">{aiConfig.claudeCodeCommand}</dd></div>
            <div><dt className="text-t3">Claude Code model</dt><dd className="font-medium text-t1">{aiConfig.claudeCodeModel}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}