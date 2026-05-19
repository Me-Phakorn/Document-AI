import { BrainCircuit, CheckCircle2, CopyPlus, Plus } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { activatePromptVersion, createPromptTemplate, createPromptVersion, listPromptTemplates } from '@/lib/api/prompts';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

function splitList(value: FormDataEntryValue | null) {
  return value?.toString().split(',').map((item) => item.trim()).filter(Boolean) ?? [];
}

async function createPromptAction(formData: FormData) {
  'use server';
  const name = formData.get('name')?.toString().trim();
  const templateText = formData.get('templateText')?.toString().trim();
  if (!name || !templateText) return;

  await createPromptTemplate({
    name,
    templateText,
    domain: formData.get('domain')?.toString().trim() || undefined,
    tags: splitList(formData.get('tags')),
    variables: splitList(formData.get('variables')),
  });
  revalidatePath('/prompts');
}

async function createPromptVersionAction(formData: FormData) {
  'use server';
  const promptTemplateId = formData.get('promptTemplateId')?.toString();
  const templateText = formData.get('templateText')?.toString().trim();
  if (!promptTemplateId || !templateText) return;

  await createPromptVersion(promptTemplateId, { templateText, variables: splitList(formData.get('variables')) });
  revalidatePath('/prompts');
}

async function activatePromptVersionAction(formData: FormData) {
  'use server';
  const promptTemplateVersionId = formData.get('promptTemplateVersionId')?.toString();
  if (!promptTemplateVersionId) return;
  await activatePromptVersion(promptTemplateVersionId);
  revalidatePath('/prompts');
}

export default async function PromptsPage() {
  const prompts = await listPromptTemplates({ limit: 25 });

  return (
    <div>
      <PageHeader
        eyebrow="Prompt Library"
        title="Versioned AI instructions"
        description="Prompt templates are stored as immutable versions, activated explicitly, and audited before reuse in document analysis workflows."
      />

      <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
        <div className="flex items-center gap-2 text-accent">
          <BrainCircuit size={17} aria-hidden="true" />
          <h2 className="font-semibold text-t1">Create prompt template</h2>
        </div>
        <form action={createPromptAction} className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Name</span><input required name="name" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" /></label>
            <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Domain</span><input name="domain" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Tags</span><input name="tags" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" /></label>
            <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Variables</span><input name="variables" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" /></label>
          </div>
          <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Template text</span><textarea required name="templateText" className="min-h-32 rounded-md border border-border bg-raised px-3 py-2 text-sm leading-6 text-t1" /></label>
          <button className="inline-flex w-fit items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><Plus size={15} />Create Prompt</button>
        </form>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-t1">Templates</h2></div>
        <div className="divide-y divide-border">
          {prompts.items.map((prompt) => (
            <article key={prompt.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-t1">{prompt.name}</h3><span className="rounded bg-raised px-2 py-1 text-xs text-t2">{prompt.status}</span></div>
                  <p className="mt-1 text-sm text-t2">{prompt.domain ?? 'general'} · {prompt.versions.length} versions · updated {formatDateTime(prompt.updatedAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{prompt.tags.map((tag) => <span key={tag} className="rounded border border-border bg-raised px-2 py-1 text-xs text-t2">{tag}</span>)}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                <div className="grid gap-2">
                  {prompt.versions.map((version) => (
                    <div key={version.id} className="rounded-md border border-border bg-raised p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-t1">Version {version.versionNumber} · {version.status}</p><form action={activatePromptVersionAction}><input type="hidden" name="promptTemplateVersionId" value={version.id} /><button className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-t2"><CheckCircle2 size={14} />Activate</button></form></div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-t2">{version.templateText}</p>
                    </div>
                  ))}
                </div>
                <form action={createPromptVersionAction} className="grid gap-2 rounded-md border border-border bg-raised p-3">
                  <input type="hidden" name="promptTemplateId" value={prompt.id} />
                  <h4 className="font-medium text-t1">New draft version</h4>
                  <input name="variables" className="rounded-md border border-border bg-panel px-3 py-2 text-sm text-t1" />
                  <textarea required name="templateText" className="min-h-24 rounded-md border border-border bg-panel px-3 py-2 text-sm text-t1" />
                  <button className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-sm text-t2"><CopyPlus size={14} />Create Version</button>
                </form>
              </div>
            </article>
          ))}
          {!prompts.items.length ? <div className="px-4 py-12 text-center text-sm text-t2">No prompt templates have been created yet.</div> : null}
        </div>
      </section>
    </div>
  );
}