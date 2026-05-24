'use server';

import { revalidatePath } from 'next/cache';
import { batchQueueForAnalysis } from '@/lib/api/analysis';

export async function submitForAnalysisAction(
  documentVersionIds: string[],
): Promise<{ queued: number; skipped: number }> {
  const result = await batchQueueForAnalysis(documentVersionIds);
  revalidatePath('/documents');
  revalidatePath('/review');
  return result;
}
