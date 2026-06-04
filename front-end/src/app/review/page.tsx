import { Archive, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { apiBaseUrl } from '@/lib/api-client';
import { approveReviewItem, confirmReviewNotRelevant, listReviewItems, reReviewItem, requestReviewChanges } from '@/lib/api/review';
import { AutoRefresh } from './auto-refresh';
import { ReviewApprovedSection } from './review-approved-section';
import { ReviewPendingSection } from './review-pending-section';
import { ReviewedSection } from './review-reviewed-section';
import { NotRelevantSection } from './review-not-relevant-section';

export const dynamic = 'force-dynamic';

async function approveReviewAction(formData: FormData) {
  'use server';
  const reviewItemId = formData.get('reviewItemId')?.toString();
  if (!reviewItemId) return;
  await approveReviewItem(reviewItemId, formData.get('comment')?.toString() || undefined);
  revalidateReviewPaths();
}

async function requestChangesAction(formData: FormData) {
  'use server';
  const reviewItemId = formData.get('reviewItemId')?.toString();
  const comment = formData.get('comment')?.toString().trim();
  if (!reviewItemId || !comment) return;
  await requestReviewChanges(reviewItemId, comment);
  revalidateReviewPaths();
}

async function confirmNotRelevantAction(formData: FormData) {
  'use server';
  const reviewItemId = formData.get('reviewItemId')?.toString();
  if (!reviewItemId) return;
  await confirmReviewNotRelevant(reviewItemId, formData.get('comment')?.toString() || undefined);
  revalidateReviewPaths();
}

async function reReviewAction(formData: FormData) {
  'use server';
  const reviewItemId = formData.get('reviewItemId')?.toString();
  if (!reviewItemId) return;
  await reReviewItem(reviewItemId);
  revalidateReviewPaths();
}

function revalidateReviewPaths() {
  revalidatePath('/review');
  revalidatePath('/documents');
  revalidatePath('/dashboard');
  revalidatePath('/rulebook');
}

export default async function ReviewPage() {
  let reviewItems: Awaited<ReturnType<typeof listReviewItems>>;
  try {
    reviewItems = await listReviewItems({ limit: 500 });
  } catch (error) {
    console.error('[review] failed to load review items', error);
    return <ReviewError error={error} />;
  }
  const all = reviewItems.items;

  // Section 1 — รอ Review
  const pending = all
    .filter((i) => i.status === 'PENDING')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Section 2 — รีวิวเรียบร้อยแล้ว (APPROVED)
  const approved = all
    .filter((i) => i.outcome === 'APPROVED')
    .sort(
      (a, b) =>
        new Date(b.decidedAt ?? b.createdAt).getTime() -
        new Date(a.decidedAt ?? a.createdAt).getTime(),
    );

  // Section 3 — ขอแก้ไข / ปฏิเสธ
  // Items with status=REJECTED have already had re-review queued — exclude them
  const changesDecided = all
    .filter((i) =>
      i.status !== 'REJECTED' &&
      (
        i.outcome === 'CHANGES_REQUESTED' ||
        i.outcome === 'REJECTED' ||
        i.outcome === 'OVERRIDDEN'
      ),
    )
    .sort(
      (a, b) =>
        new Date(b.decidedAt ?? b.createdAt).getTime() -
        new Date(a.decidedAt ?? a.createdAt).getTime(),
    );

  // Section 4 — ไม่เกี่ยวข้อง
  const notRelevant = all
    .filter((i) => i.outcome === 'CONFIRMED_NOT_RELEVANT')
    .sort(
      (a, b) =>
        new Date(b.decidedAt ?? b.createdAt).getTime() -
        new Date(a.decidedAt ?? a.createdAt).getTime(),
    );

  return (
    <div>
      {/* Auto-refresh every 30 s — renders nothing */}
      <AutoRefresh intervalMs={30_000} />

      <PageHeader
        eyebrow="Review Center"
        title="Review Report"
        description="ผลการ Review แต่ละเอกสาร — สถานะ, ผล AI, และการตัดสินใจของ Reviewer"
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <section
          className={`rounded-lg border p-4 shadow-panel ${pending.length > 0 ? 'border-accent/30 bg-[var(--accent-lo)]' : 'border-border bg-panel'}`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-t3">รอ Review</p>
            <Clock size={16} className={pending.length > 0 ? 'text-accent' : 'text-t3'} aria-hidden="true" />
          </div>
          <p className={`mt-2 text-2xl font-semibold ${pending.length > 0 ? 'text-accent' : 'text-t1'}`}>
            {pending.length}
          </p>
          <p className="mt-1 text-xs text-t3">จาก {all.length} รายการทั้งหมด</p>
        </section>

        <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-t3">อนุมัติแล้ว</p>
            <CheckCircle2 size={16} className="text-green" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-t1">{approved.length}</p>
          <p className="mt-1 text-xs text-t3">เข้า rulebook pipeline</p>
        </section>

        <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-t3">ขอแก้ไข / ปฏิเสธ</p>
            <XCircle size={16} className="text-amber" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-t1">{changesDecided.length}</p>
          <p className="mt-1 text-xs text-t3">ต้องวิเคราะห์ใหม่</p>
        </section>

        <section className="rounded-lg border border-border bg-panel p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-t3">ไม่เกี่ยวข้อง</p>
            <Archive size={16} className="text-t3" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-t1">{notRelevant.length}</p>
          <p className="mt-1 text-xs text-t3">ยืนยันแล้ว</p>
        </section>
      </div>

      {/* 2×2 Section Grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <ReviewPendingSection
          items={pending}
          onApprove={approveReviewAction}
          onRequestChanges={requestChangesAction}
          onConfirmNotRelevant={confirmNotRelevantAction}
        />

        <ReviewApprovedSection items={approved} allItems={all} />

        <ReviewedSection
          items={changesDecided}
          title="ขอแก้ไข / ปฏิเสธ"
          description="เอกสารที่ Reviewer ขอแก้ไข หรือปฏิเสธ — ต้องวิเคราะห์ใหม่"
          onReReview={reReviewAction}
        />

        <NotRelevantSection items={notRelevant} />
      </div>
    </div>
  );
}

function ReviewError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = (error as { status?: number } | null)?.status;
  return (
    <div>
      <PageHeader
        eyebrow="Review Center"
        title="Review Report"
        description="ไม่สามารถโหลดรายการ Review ได้"
      />
      <section className="rounded-lg border border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.06)] p-4 text-sm text-red">
        <p className="font-semibold">โหลดข้อมูลล้มเหลว</p>
        <p className="mt-1 text-t2">
          Backend API ({apiBaseUrl}) ตอบกลับด้วยข้อผิดพลาด{status ? ` (HTTP ${status})` : ''}
        </p>
        <p className="mt-2 break-all text-xs text-t3">{message}</p>
        <p className="mt-3 text-xs text-t3">
          ลองรีเฟรชหน้า — หากปัญหายังเกิดอยู่ ให้ตรวจสอบสถานะ backend และ logs ใน production
        </p>
      </section>
    </div>
  );
}
