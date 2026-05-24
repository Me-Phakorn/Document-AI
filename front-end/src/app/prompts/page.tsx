import { BrainCircuit, CheckCircle2, CopyPlus, Plus } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { getAiConfig } from '@/lib/api/analysis';
import { activatePromptVersion, createPromptTemplate, createPromptVersion, listPromptTemplates } from '@/lib/api/prompts';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const templateVariables = ['documentTitle', 'ocrText'];

const tagOptions = [
  'กฎระเบียบไทย',
  'Rule Base',
  'Compliance',
  'ธนาคารแห่งประเทศไทย',
  'ประกาศ/หลักเกณฑ์',
  'ความเสี่ยงสูง',
  'การเปิดเผยข้อมูล',
];

const exampleTemplate = {
  name: 'เทมเพลตสร้าง Rule Base จากเอกสารกำกับดูแลไทย',
  tags: ['กฎระเบียบไทย', 'Rule Base', 'Compliance'],
  templateText: `ชื่อเอกสาร: {{documentTitle}}

คุณคือ AI สำหรับอ่านเอกสารกำกับดูแลและแปลงสาระสำคัญให้เป็น Rule Base สำหรับระบบตรวจสอบ Compliance

Rule Base หมายถึงชุดกฎที่ระบบสามารถนำไปใช้ตรวจสอบเนื้อหาอื่นได้ โดยแต่ละกฎต้องมีเงื่อนไขที่ทำให้กฎมีผล หน้าที่หรือข้อกำหนดที่ต้องปฏิบัติ ข้อห้าม ข้อยกเว้น ระดับความเสี่ยง และหลักฐานอ้างอิงจากเอกสารต้นทาง

ให้อ่าน OCR text แล้วสกัดเฉพาะข้อกำหนดที่นำไปใช้เป็นกฎได้จริง เช่น ข้อกำหนดเชิงบังคับ เงื่อนไขการอนุญาต หน้าที่ของผู้ประกอบธุรกิจ ข้อห้าม ระยะเวลา เอกสารประกอบ การเปิดเผยข้อมูล เกณฑ์ความเสี่ยง หรือข้อยกเว้น

ถ้าเอกสารไม่เกี่ยวข้องกับการสร้าง Rule Base ให้ตอบ outcome เป็น NOT_RELEVANT และอธิบายเหตุผลเป็นภาษาไทย

ต้องตอบเป็น JSON ที่ถูกต้องเท่านั้น ห้ามมีข้อความอื่นนอก JSON ค่า enum เช่น outcome และ riskLevel ให้คงเป็นภาษาอังกฤษเพื่อให้ระบบอ่านได้ แต่ข้อความอธิบายทั้งหมดต้องเป็นภาษาไทย

รูปแบบผลลัพธ์ที่ต้องการ:
{
  "outcome": "RULES_FOUND|NO_RULES_FOUND|NOT_RELEVANT",
  "summary": "สรุปภาษาไทยว่าเอกสารนี้เกี่ยวกับอะไรและพบข้อกำหนดประเภทใด",
  "confidence": 0.0,
  "rules": [
    {
      "ruleCode": "R-001",
      "title": "ชื่อกฎภาษาไทยแบบสั้นและชัดเจน",
      "description": "คำอธิบายกฎเป็นภาษาไทย",
      "condition": "เงื่อนไขที่ทำให้กฎนี้มีผลเป็นภาษาไทย",
      "obligation": "หน้าที่หรือสิ่งที่ต้องปฏิบัติเป็นภาษาไทย",
      "prohibition": "ข้อห้ามหรือข้อจำกัดเป็นภาษาไทย ถ้าไม่มีให้ใส่ null",
      "exception": "ข้อยกเว้นเป็นภาษาไทย ถ้าไม่มีให้ใส่ null",
      "riskLevel": "HIGH|MEDIUM|LOW|INFO",
      "sourceReferences": [
        {
          "page": 1,
          "quote": "ข้อความอ้างอิงจากเอกสารต้นทางเป็นภาษาไทย"
        }
      ]
    }
  ],
  "notRelevantReason": "เหตุผลภาษาไทยเมื่อ outcome เป็น NOT_RELEVANT หรือ null"
}

OCR text:
{{ocrText}}`,
};

function selectedTags(formData: FormData) {
  return formData.getAll('tags').map((item) => item.toString().trim()).filter(Boolean);
}

function uniqueModelOptions(currentModel: string, options: string[]) {
  return Array.from(new Set([currentModel, ...options].filter(Boolean)));
}

function ModelSelect({ defaultValue, modelOptions }: { defaultValue: string; modelOptions: string[] }) {
  return (
    <select name="aiModel" defaultValue={defaultValue} className="h-10 rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1">
      {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
    </select>
  );
}

function TagCapsules({ defaultTags = [] }: { defaultTags?: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tagOptions.map((tag) => (
        <label key={tag} className="cursor-pointer">
          <input type="checkbox" name="tags" value={tag} defaultChecked={defaultTags.includes(tag)} className="peer sr-only" />
          <span className="inline-flex h-9 items-center rounded-full border border-border bg-raised px-3 text-sm font-medium text-t2 transition peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
            {tag}
          </span>
        </label>
      ))}
    </div>
  );
}

async function createPromptAction(formData: FormData) {
  'use server';
  const name = formData.get('name')?.toString().trim();
  const templateText = formData.get('templateText')?.toString().trim();
  if (!name || !templateText) return;

  await createPromptTemplate({
    name,
    templateText,
    tags: selectedTags(formData),
    variables: templateVariables,
    aiModel: formData.get('aiModel')?.toString().trim() || undefined,
  });
  revalidatePath('/prompts');
}

async function createPromptVersionAction(formData: FormData) {
  'use server';
  const promptTemplateId = formData.get('promptTemplateId')?.toString();
  const templateText = formData.get('templateText')?.toString().trim();
  if (!promptTemplateId || !templateText) return;

  await createPromptVersion(promptTemplateId, {
    templateText,
    variables: templateVariables,
    aiModel: formData.get('aiModel')?.toString().trim() || undefined,
  });
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
  const [prompts, aiConfig] = await Promise.all([listPromptTemplates({ limit: 25 }), getAiConfig()]);
  const modelOptions = uniqueModelOptions(aiConfig.model, aiConfig.modelOptions);

  return (
    <div>
      <PageHeader
        eyebrow="Prompt Library"
        title="Rule Base prompt templates"
        description="Create reusable Thai instructions for extracting compliance rules from regulatory documents."
      />

      <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
        <div className="flex items-center gap-2 text-accent">
          <BrainCircuit size={17} aria-hidden="true" />
          <h2 className="font-semibold text-t1">Template</h2>
        </div>
        <form action={createPromptAction} className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Name</span><input required name="name" defaultValue={exampleTemplate.name} className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" /></label>
            <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">AI model</span><ModelSelect defaultValue={aiConfig.model} modelOptions={modelOptions} /></label>
          </div>
          <div className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Tags</span><TagCapsules defaultTags={exampleTemplate.tags} /></div>
          <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Text</span><textarea required name="templateText" defaultValue={exampleTemplate.templateText} className="min-h-[32rem] rounded-md border border-border bg-raised px-3 py-2 text-sm leading-6 text-t1" /></label>
          <button className="inline-flex w-fit items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><Plus size={15} />Create Template</button>
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
                  <p className="mt-1 text-sm text-t2">{prompt.versions.length} versions · updated {formatDateTime(prompt.updatedAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{prompt.tags.map((tag) => <span key={tag} className="rounded border border-border bg-raised px-2 py-1 text-xs text-t2">{tag}</span>)}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                <div className="grid gap-2">
                  {prompt.versions.map((version) => (
                    <div key={version.id} className="rounded-md border border-border bg-raised p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-t1">Version {version.versionNumber} · {version.status}</p><form action={activatePromptVersionAction}><input type="hidden" name="promptTemplateVersionId" value={version.id} /><button className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-t2"><CheckCircle2 size={14} />Activate</button></form></div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-t2">
                        <span className="rounded border border-border bg-panel px-2 py-1">{version.aiProvider ?? aiConfig.provider}</span>
                        <span className="rounded border border-border bg-panel px-2 py-1">{version.aiModel ?? aiConfig.model}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-t2">{version.templateText}</p>
                    </div>
                  ))}
                </div>
                <form action={createPromptVersionAction} className="grid gap-2 rounded-md border border-border bg-raised p-3">
                  <input type="hidden" name="promptTemplateId" value={prompt.id} />
                  <h4 className="font-medium text-t1">New draft version</h4>
                  <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">AI model</span><ModelSelect defaultValue={prompt.versions[0]?.aiModel ?? aiConfig.model} modelOptions={modelOptions} /></label>
                  <textarea required name="templateText" defaultValue={prompt.versions[0]?.templateText ?? exampleTemplate.templateText} className="min-h-48 rounded-md border border-border bg-panel px-3 py-2 text-sm leading-6 text-t1" />
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