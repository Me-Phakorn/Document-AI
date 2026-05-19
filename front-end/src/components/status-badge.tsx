import type { WorkflowStatus } from '@/lib/types';

const statusStyles: Partial<Record<WorkflowStatus, string>> = {
  UPLOADED: 'border-border bg-raised text-t2',
  DOWNLOADED: 'border-border bg-raised text-t2',
  PROCESSING: 'border-[rgba(181,106,9,0.2)] bg-[rgba(181,106,9,0.1)] text-amber',
  OCR_PROCESSING: 'border-[rgba(181,106,9,0.2)] bg-[rgba(181,106,9,0.1)] text-amber',
  OCR_COMPLETED: 'border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.1)] text-blue',
  OCR_PARTIAL: 'border-[rgba(181,106,9,0.2)] bg-[rgba(181,106,9,0.1)] text-amber',
  OCR_FAILED: 'border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.1)] text-red',
  AI_PENDING: 'border-border bg-raised text-t2',
  AI_PROCESSING: 'border-[rgba(181,106,9,0.2)] bg-[rgba(181,106,9,0.1)] text-amber',
  AI_COMPLETED: 'border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.1)] text-blue',
  PENDING_REVIEW: 'border-[rgba(181,106,9,0.2)] bg-[rgba(181,106,9,0.1)] text-amber',
  APPROVED: 'border-[rgba(22,138,74,0.2)] bg-[rgba(22,138,74,0.1)] text-green',
  REJECTED: 'border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.1)] text-red',
  NOT_RELEVANT: 'border-border bg-raised text-t2',
  NEED_HUMAN_REVIEW: 'border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.1)] text-red',
  PUBLISHED: 'border-[rgba(22,138,74,0.2)] bg-[rgba(22,138,74,0.1)] text-green',
  FAILED: 'border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.1)] text-red',
  ARCHIVED: 'border-border bg-raised text-t2',
};

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  return <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${statusStyles[status] ?? 'border-border bg-raised text-t2'}`}>{status.replaceAll('_', ' ')}</span>;
}