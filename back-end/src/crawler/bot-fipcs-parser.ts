import { basename, extname } from 'node:path';

export interface BotFipcsDocumentLink {
  listPage: number;
  packId: string;
  pdfUrl: string;
  title: string;
  documentType: string | null;
  sourceDocumentDate: Date | null;
  sourceDocumentDateText: string | null;
  statusText: string | null;
  language: string | null;
  relatedDocumentUrl: string | null;
}

export function extractBotFipcsPdfLinks(html: string, listPage: number): BotFipcsDocumentLink[] {
  const linksFromRows = extractRows(html).flatMap((rowHtml) => extractPdfLinksFromRow(rowHtml, listPage));
  if (linksFromRows.length) {
    return linksFromRows;
  }

  return extractFallbackPdfLinks(html, listPage);
}

export function parseThaiDocumentDate(value: string): Date | null {
  const normalizedValue = normalizeWhitespace(value);
  const match = normalizedValue.match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})$/u);
  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const monthIndex = thaiMonthIndex(match[2]);
  const rawYear = Number.parseInt(match[3], 10);
  const year = rawYear > 2400 ? rawYear - 543 : rawYear;

  if (!Number.isInteger(day) || monthIndex === null || !Number.isInteger(year)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, monthIndex, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== monthIndex || parsed.getUTCDate() !== day) {
    return null;
  }

  return parsed;
}

function extractRows(html: string) {
  const rowStartPattern = /<tr\b[^>]*class=["'][^"']*nonebgnews[^"']*["'][^>]*>/gi;
  const starts = Array.from(html.matchAll(rowStartPattern));

  return starts.map((match, index) => {
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? html.indexOf('</table>', start);
    return html.slice(start, end > start ? end : undefined);
  });
}

function extractPdfLinksFromRow(rowHtml: string, listPage: number) {
  const cells = extractCells(rowHtml);
  const documentType = normalizeWhitespace(stripTags(cells[0] ?? '')) || null;
  const sourceDocumentDateText = normalizeWhitespace(stripTags(cells[1] ?? '')) || null;
  const sourceDocumentDate = sourceDocumentDateText ? parseThaiDocumentDate(sourceDocumentDateText) : null;
  const rowTitle = normalizeWhitespace(stripTags(cells[3] ?? ''));
  const statusText = (extractAttribute(cells[4] ?? '', 'title') ?? extractAttribute(cells[4] ?? '', 'alt') ?? normalizeWhitespace(stripTags(cells[4] ?? ''))) || null;
  const relatedDocumentUrl = extractRelatedDocumentUrl(cells[4] ?? '');
  const pdfAnchors = extractPdfAnchors(cells[5] ?? rowHtml);

  return pdfAnchors.map((anchor) => {
    const pdfUrl = absoluteUrl(anchor.href);
    const packId = extractPackId(pdfUrl);
    return {
      listPage,
      packId,
      pdfUrl,
      title: rowTitle || `BOT FIPCS ${packId || basename(new URL(pdfUrl).pathname, extname(new URL(pdfUrl).pathname))}`,
      documentType,
      sourceDocumentDate,
      sourceDocumentDateText,
      statusText,
      language: normalizeWhitespace(stripTags(anchor.label)) || null,
      relatedDocumentUrl,
    };
  });
}

function extractFallbackPdfLinks(html: string, listPage: number): BotFipcsDocumentLink[] {
  return extractPdfAnchors(html).map((anchor) => {
    const pdfUrl = absoluteUrl(anchor.href);
    const packId = extractPackId(pdfUrl);
    return {
      listPage,
      packId,
      pdfUrl,
      title: `BOT FIPCS ${packId || basename(new URL(pdfUrl).pathname, extname(new URL(pdfUrl).pathname))}`,
      documentType: null,
      sourceDocumentDate: null,
      sourceDocumentDateText: null,
      statusText: null,
      language: normalizeWhitespace(stripTags(anchor.label)) || null,
      relatedDocumentUrl: null,
    };
  });
}

function extractCells(rowHtml: string) {
  const cells: string[] = [];
  const cellPattern = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let cellMatch: RegExpExecArray | null;

  while ((cellMatch = cellPattern.exec(rowHtml))) {
    cells.push(cellMatch[1]);
  }

  return cells;
}

function extractPdfAnchors(html: string) {
  const anchors: Array<{ href: string; label: string }> = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*['"]([^'"]+\.pdf(?:\?[^'"]*)?)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let anchorMatch: RegExpExecArray | null;

  while ((anchorMatch = anchorPattern.exec(html))) {
    anchors.push({ href: decodeHtml(anchorMatch[1]), label: decodeHtml(anchorMatch[2]) });
  }

  return anchors;
}

function extractRelatedDocumentUrl(html: string) {
  const match = html.match(/OpenWindow\('([^']+)','Related'\)/);
  return match?.[1] ? absoluteUrl(decodeHtml(match[1])) : null;
}

function extractAttribute(input: string, attribute: string) {
  const pattern = new RegExp(`${attribute}=["']([^"']*)["']`, 'i');
  const value = input.match(pattern)?.[1];
  return value ? normalizeWhitespace(decodeHtml(value)) : null;
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' '));
}

function normalizeWhitespace(value: string) {
  return value.replace(/&nbsp;/gi, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function thaiMonthIndex(value: string) {
  const key = value.replace(/\./g, '').replace(/\s/g, '');
  const months: Record<string, number> = {
    มค: 0,
    มกราคม: 0,
    กพ: 1,
    กุมภาพันธ์: 1,
    มีค: 2,
    มีนาคม: 2,
    เมย: 3,
    เมษายน: 3,
    พค: 4,
    พฤษภาคม: 4,
    มิย: 5,
    มิถุนายน: 5,
    กค: 6,
    กรกฎาคม: 6,
    สค: 7,
    สิงหาคม: 7,
    กย: 8,
    กันยายน: 8,
    ตค: 9,
    ตุลาคม: 9,
    พย: 10,
    พฤศจิกายน: 10,
    ธค: 11,
    ธันวาคม: 11,
  };
  return months[key] ?? null;
}

function absoluteUrl(value: string) {
  return new URL(value, 'https://app.bot.or.th/FIPCS/Thai/').toString();
}

function extractPackId(pdfUrl: string) {
  const fileName = basename(new URL(pdfUrl).pathname);
  return fileName.replace(/\.pdf$/i, '');
}

function decodeHtml(value: string) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}