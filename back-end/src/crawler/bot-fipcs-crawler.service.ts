import { Injectable } from '@nestjs/common';
import { extractBotFipcsPdfLinks, type BotFipcsDocumentLink } from './bot-fipcs-parser';

interface PageState {
  cookies: Map<string, string>;
  hiddenFields: Map<string, string>;
  html: string;
}

export interface PreviewOptions {
  startPage?: number;
  endPage?: number;
  maxDocuments?: number;
}

@Injectable()
export class BotFipcsCrawlerService {
  /**
   * Crawl a BOT FIPCS source URL and return discovered PDF links WITHOUT
   * writing anything to the database or object storage.
   */
  async previewLinks(sourceUrl: string, options: PreviewOptions = {}): Promise<BotFipcsDocumentLink[]> {
    const startPage = options.startPage ?? 1;
    const endPage = options.endPage;
    const maxDocuments = options.maxDocuments;
    const maxPagesCap = 50; // Safety cap for on-demand previews

    const state = await this.fetchInitialPage(sourceUrl);
    const links: BotFipcsDocumentLink[] = [];

    for (let page = 1; page <= maxPagesCap; page++) {
      if (page >= startPage && (!endPage || page <= endPage)) {
        links.push(...extractBotFipcsPdfLinks(state.html, page));
      }
      // Stop early once we have enough unique documents
      if (maxDocuments && dedupeLinks(links).length >= maxDocuments) break;
      if (endPage && page >= endPage) break;

      const nextTarget = this.extractNextPostbackTarget(state.html);
      if (!nextTarget) break;

      const nextState = await this.fetchPostbackPage(sourceUrl, state, nextTarget);
      state.html = nextState.html;
      state.hiddenFields = nextState.hiddenFields;
      mergeCookies(state.cookies, nextState.cookies);
    }

    const uniqueLinks = dedupeLinks(links);
    return maxDocuments ? uniqueLinks.slice(0, maxDocuments) : uniqueLinks;
  }

  private async fetchInitialPage(sourceUrl: string): Promise<PageState> {
    const cookies = new Map<string, string>();
    const response = await fetch(sourceUrl, { headers: crawlerHeaders() });
    if (!response.ok) {
      throw new Error(`Failed to fetch source URL: HTTP ${response.status}`);
    }
    mergeSetCookieHeaders(cookies, response.headers);
    const html = await response.text();
    return { cookies, hiddenFields: extractHiddenFields(html), html };
  }

  private async fetchPostbackPage(sourceUrl: string, state: PageState, eventTarget: string): Promise<PageState> {
    const form = new URLSearchParams();
    for (const [name, value] of state.hiddenFields) {
      form.set(name, value);
    }
    form.set('__EVENTTARGET', eventTarget);
    form.set('__EVENTARGUMENT', '');

    const cookies = new Map<string, string>();
    const response = await fetch(sourceUrl, {
      method: 'POST',
      headers: {
        ...crawlerHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: renderCookieHeader(state.cookies),
        Referer: sourceUrl,
      },
      body: form,
    });
    mergeSetCookieHeaders(cookies, response.headers);
    const html = await response.text();
    return { cookies, hiddenFields: extractHiddenFields(html), html };
  }

  private extractNextPostbackTarget(html: string): string | undefined {
    const decoded = decodeHtml(html);
    const match = decoded.match(/__doPostBack\('([^']*btnNext[^']*)',''\)/);
    return match?.[1];
  }
}

function crawlerHeaders() {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'th,en;q=0.8',
    'User-Agent': 'DocAI local crawler/0.1 (+https://localhost)',
  };
}

function mergeSetCookieHeaders(cookies: Map<string, string>, headers: Headers): void {
  const setCookies =
    typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : splitSetCookieHeader(headers.get('set-cookie'));

  for (const setCookie of setCookies) {
    const [pair] = setCookie.split(';');
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;
    cookies.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
  }
}

function splitSetCookieHeader(value: string | null): string[] {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,]+=)/g);
}

function mergeCookies(target: Map<string, string>, source: Map<string, string>): void {
  for (const [name, value] of source) {
    target.set(name, value);
  }
}

function renderCookieHeader(cookies: Map<string, string>): string {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function dedupeLinks(links: BotFipcsDocumentLink[]): BotFipcsDocumentLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.pdfUrl)) return false;
    seen.add(link.pdfUrl);
    return true;
  });
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractHiddenFields(html: string): Map<string, string> {
  const fields = new Map<string, string>();
  const inputPattern = /<input\b[^>]*type=["']hidden["'][^>]*>/gi;
  let inputMatch: RegExpExecArray | null;

  while ((inputMatch = inputPattern.exec(html))) {
    const input = inputMatch[0];
    const name = extractAttribute(input, 'name');
    if (!name) continue;
    fields.set(decodeHtml(name), decodeHtml(extractAttribute(input, 'value') ?? ''));
  }

  return fields;
}

function extractAttribute(input: string, attribute: string): string | undefined {
  const pattern = new RegExp(`${attribute}=["']([^"']*)["']`, 'i');
  return input.match(pattern)?.[1];
}
