import { ClipboardCheck, FileDown } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { getAiConfig } from '@/lib/api/analysis';
import { createComplianceCheck, listComplianceChecks } from '@/lib/api/compliance';
import { listRulebooks } from '@/lib/api/rulebook';
import { ComplianceCheckCard } from './compliance-check-card';
import { ComplianceForm, ComplianceFormState } from './compliance-form';

export const dynamic = 'force-dynamic';

async function submitComplianceAction(prevState: ComplianceFormState | null, formData: FormData): Promise<ComplianceFormState> {
  'use server';
  try {
    const imageFile = formData.get('image') as File | null;
    const selectedRulebookId = formData.get('selectedRulebookId')?.toString() || undefined;
    const focusPrompt = formData.get('focusPrompt')?.toString().trim() || undefined;
    const title = formData.get('title')?.toString().trim() || undefined;

    const model = formData.get('model')?.toString().trim() || undefined;

    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;

    if (imageFile && imageFile.size > 0) {
      const buffer = await imageFile.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
      imageMimeType = imageFile.type || 'image/jpeg';
    }

    if (!imageBase64) {
      return { error: 'กรุณาอัปโหลดภาพก่อนตรวจสอบ' };
    }

    await createComplianceCheck({ imageBase64, imageMimeType, focusPrompt, title, selectedRulebookId, model });
    revalidatePath('/compliance');
    revalidatePath('/review');
    return { success: true };
  } catch (err) {
    return { error: (err as Error).message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
  }
}


export default async function CompliancePage() {
  const [rulebooks, checks, aiConfig] = await Promise.all([
    listRulebooks({ limit: 50 }),
    listComplianceChecks({ limit: 25 }),
    getAiConfig().catch(() => ({ model: 'openai/gpt-4o-mini', modelOptions: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash'] })),
  ]);

  const selectableRulebooks = rulebooks.items.map((rb) => ({ id: rb.id, title: rb.title, domain: rb.domain }));

  return (
    <div>
      <PageHeader
        eyebrow="Compliance Checker"
        title="ตรวจสอบเนื้อหา / ภาพ ด้วย AI"
        description="อัปโหลดภาพโฆษณา เอกสาร หรือ Screenshot แล้วให้ AI ตรวจสอบกับกฎระเบียบทุกข้อในกฎหมายที่เลือก"
      />

      <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
        <div className="flex items-center gap-2 text-accent">
          <ClipboardCheck size={17} aria-hidden="true" />
          <h2 className="font-semibold text-t1">ตรวจสอบใหม่</h2>
        </div>
        <ComplianceForm
          action={submitComplianceAction}
          selectableRulebooks={selectableRulebooks}
          modelOptions={aiConfig.modelOptions.length ? aiConfig.modelOptions : ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash']}
          defaultModel={aiConfig.model}
        />
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-t1">ประวัติการตรวจสอบ</h2>
          {checks.items.length > 0 ? (
            <a
              href="/api/compliance-history-pdf"
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-raised px-3 py-1.5 text-xs font-medium text-t2 hover:text-t1 transition-colors"
            >
              <FileDown size={13} />
              สร้างรายงาน PDF
            </a>
          ) : null}
        </div>
        <div className="divide-y divide-border">
          {checks.items.map((check) => (
            <ComplianceCheckCard key={check.id} check={check} />
          ))}
          {checks.items.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-t2">ยังไม่มีรายการตรวจสอบ อัปโหลดภาพด้านบนเพื่อเริ่มต้น</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
