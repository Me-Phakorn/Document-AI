'use server';

import { importSelectedLinks, previewWebsiteSource } from '@/lib/api/sources';
import type { CrawledPdfLink } from '@/lib/api/source-types';

export async function previewSourceAction(
  sourceId: string,
  params: { startPage?: number; maxDocuments?: number },
) {
  return previewWebsiteSource(sourceId, params);
}

export async function importSelectedAction(sourceId: string, links: CrawledPdfLink[]) {
  return importSelectedLinks(sourceId, links);
}
