'use client';

import { ImageIcon, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useActionState, useRef, useState } from 'react';

interface SelectableRulebook {
  id: string;
  title: string;
  domain: string;
}

export interface ComplianceFormState {
  error?: string;
  success?: boolean;
}

interface Props {
  action: (prevState: ComplianceFormState | null, formData: FormData) => Promise<ComplianceFormState>;
  selectableRulebooks: SelectableRulebook[];
  modelOptions: string[];
  defaultModel: string;
}

export function ComplianceForm({ action, selectableRulebooks, modelOptions, defaultModel }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setPreview(null);
    setImageName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Shorten a model id for display: "anthropic/claude-3.5-sonnet" → "claude-3.5-sonnet"
  function shortModel(id: string) {
    return id.includes('/') ? id.split('/').slice(1).join('/') : id;
  }

  return (
    <form action={formAction} className="mt-4 grid gap-4">
      {/* Image drop zone */}
      <div>
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-t3">ภาพที่ต้องการตรวจสอบ</span>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${isDragging ? 'border-accent bg-accent/5' : 'border-border bg-raised hover:border-accent/50'}`}
          onClick={() => !preview && fileInputRef.current?.click()}
        >
          {preview ? (
            <div className="relative w-full p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="mx-auto max-h-72 rounded object-contain" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearImage(); }}
                className="absolute right-3 top-3 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
              <p className="mt-2 text-center text-xs text-t3">{imageName}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <ImageIcon size={32} className="text-t3" />
              <p className="text-sm font-medium text-t2">วางภาพที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
              <p className="text-xs text-t3">รองรับ JPG, PNG, WebP · สูงสุด 10 MB</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Title + Rulebook + Model row */}
      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,240px)_minmax(0,220px)]">
        <label className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-t3">ชื่อเอกสาร / แคมเปญ</span>
          <input
            name="title"
            className="w-full rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1 placeholder:text-t3"
            placeholder="เช่น โฆษณาผลิตภัณฑ์ Q3"
          />
        </label>

        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-t3">กฎระเบียบ</span>
          <select name="selectedRulebookId" className="w-full min-w-0 truncate rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1">
            {selectableRulebooks.map((rb) => (
              <option key={rb.id} value={rb.id} title={rb.title}>
                {rb.title}
              </option>
            ))}
            {selectableRulebooks.length === 0 && <option value="">ยังไม่มี Rulebook — Approve ผล AI ก่อน</option>}
          </select>
        </label>

        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-t3">AI Model</span>
          <select name="model" defaultValue={defaultModel} className="w-full min-w-0 truncate rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1">
            {modelOptions.map((m) => (
              <option key={m} value={m} title={m}>{shortModel(m)}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Focus prompt */}
      <label className="grid gap-1">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-t3">
          <Sparkles size={12} />
          คำสั่งให้ AI โฟกัส (ไม่บังคับ)
        </span>
        <textarea
          name="focusPrompt"
          rows={2}
          className="rounded-md border border-border bg-raised px-3 py-2 text-sm leading-6 text-t1 placeholder:text-t3"
          placeholder="เช่น นำรูปภาพโฆษณานี้มาเทียบกับกฎข้อบังคับใน Rulebook แล้วตรวจสอบว่าเนื้อหาหรือข้อความในภาพเข้าข่ายฝ่าฝืนกฎข้อใดบ้าง โดยเฉพาะในส่วนของการอ้างสรรพคุณและการแสดงฉลาก"
        />
      </label>

      {/* Error feedback */}
      {state?.error ? (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
      ) : null}

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || selectableRulebooks.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {isPending ? 'กำลังวิเคราะห์ด้วย AI…' : 'ตรวจสอบด้วย AI'}
        </button>
        {state?.success ? <span className="text-sm text-green-400">✓ ตรวจสอบเสร็จสิ้น — ดูผลด้านล่าง</span> : null}
      </div>
    </form>
  );
}
