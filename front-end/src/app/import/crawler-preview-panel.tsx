'use client';

import { CheckSquare2, Download, Eye, Loader2, Square, X } from 'lucide-react';
import { useCallback, useState, useTransition } from 'react';
import type { CrawledPdfLink, ImportSelectedResponse, SourcePreviewResponse } from '@/lib/api/source-types';

interface Props {
  sourceId: string;
  sourceName: string;
  /** Server action: crawl the source and return a preview of discoverable PDFs. */
  onPreview: (params: { startPage?: number; maxDocuments?: number }) => Promise<SourcePreviewResponse>;
  /** Server action: trigger download + OCR for the selected PDF links. */
  onImport: (links: CrawledPdfLink[]) => Promise<ImportSelectedResponse>;
}

type PanelState = 'idle' | 'loading' | 'ready' | 'importing' | 'done' | 'error';

export function CrawlerPreviewPanel({ sourceId: _sourceId, sourceName, onPreview, onImport }: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [state, setState] = useState<PanelState>('idle');
  const [links, setLinks] = useState<CrawledPdfLink[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ selectedCount: number } | null>(null);
  const [, startTransition] = useTransition();

  const openPreview = useCallback(async () => {
    setPanelOpen(true);
    setState('loading');
    setErrorMessage(null);
    setLinks([]);
    setSelected(new Set());
    setImportResult(null);
    try {
      const result = await onPreview({ startPage: 1, maxDocuments: 50 });
      setLinks(result.links);
      setState('ready');
      // Select all by default
      setSelected(new Set(result.links.map((l) => l.pdfUrl)));
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch preview.');
    }
  }, [onPreview]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setState('idle');
    setLinks([]);
    setSelected(new Set());
    setImportResult(null);
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === links.length ? new Set() : new Set(links.map((l) => l.pdfUrl)),
    );
  }, [links]);

  const toggleLink = useCallback((pdfUrl: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pdfUrl)) {
        next.delete(pdfUrl);
      } else {
        next.add(pdfUrl);
      }
      return next;
    });
  }, []);

  const importSelected = useCallback(() => {
    const selectedLinks = links.filter((l) => selected.has(l.pdfUrl));
    if (selectedLinks.length === 0) return;

    startTransition(async () => {
      setState('importing');
      try {
        const result = await onImport(selectedLinks);
        setImportResult({ selectedCount: result.selectedCount });
        setState('done');
      } catch (err) {
        setState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Import failed.');
      }
    });
  }, [onImport, links, selected]);

  const allSelected = links.length > 0 && selected.size === links.length;
  const someSelected = selected.size > 0 && selected.size < links.length;
  const selectedLinks = links.filter((l) => selected.has(l.pdfUrl));

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-sm font-medium text-t2 hover:bg-panel"
        title={`Preview documents available at ${sourceName}`}
      >
        <Eye size={14} aria-hidden="true" />
        Preview
      </button>

      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview documents from ${sourceName}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
        >
          <div className="relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-border bg-panel shadow-xl sm:rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold text-t1">Preview: {sourceName}</h2>
                {state === 'ready' && (
                  <p className="mt-0.5 text-xs text-t3">
                    {links.length} document{links.length !== 1 ? 's' : ''} found &middot; {selected.size} selected
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded p-1 text-t3 hover:bg-raised hover:text-t1"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* Loading */}
              {state === 'loading' && (
                <div className="flex flex-col items-center gap-3 py-16 text-sm text-t2">
                  <Loader2 size={24} className="animate-spin text-accent" />
                  <span>Fetching documents from source&hellip;</span>
                </div>
              )}

              {/* Error */}
              {state === 'error' && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm font-medium text-red-500">Failed to load preview</p>
                  {errorMessage && <p className="mt-1 text-xs text-t3">{errorMessage}</p>}
                  <button
                    type="button"
                    onClick={openPreview}
                    className="mt-4 rounded-md border border-border bg-raised px-3 py-1.5 text-sm text-t2"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Done */}
              {state === 'done' && importResult && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <CheckSquare2 size={32} className="text-green-500" aria-hidden="true" />
                  <p className="font-semibold text-t1">Import triggered</p>
                  <p className="text-sm text-t2">
                    {importResult.selectedCount} document{importResult.selectedCount !== 1 ? 's' : ''} queued for download and OCR.
                  </p>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="mt-2 rounded-md border border-border bg-raised px-4 py-2 text-sm font-medium text-t2"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Document list */}
              {(state === 'ready' || state === 'importing') && (
                <>
                  {/* Select-all row */}
                  <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-panel px-5 py-2.5">
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="flex items-center gap-2 text-sm text-t2 hover:text-t1"
                      aria-pressed={allSelected}
                    >
                      {allSelected ? (
                        <CheckSquare2 size={16} className="text-accent" />
                      ) : someSelected ? (
                        <CheckSquare2 size={16} className="text-t3" />
                      ) : (
                        <Square size={16} className="text-t3" />
                      )}
                      {allSelected ? 'Deselect all' : 'Select all'}
                    </button>
                    <span className="ml-auto text-xs text-t3">
                      {selected.size} / {links.length} selected
                    </span>
                  </div>

                  {/* Link rows */}
                  <ul className="divide-y divide-border">
                    {links.map((link) => {
                      const isSelected = selected.has(link.pdfUrl);
                      return (
                        <li key={link.pdfUrl}>
                          <label className="flex cursor-pointer gap-3 px-5 py-3 hover:bg-raised">
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-accent"
                              checked={isSelected}
                              onChange={() => toggleLink(link.pdfUrl)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-t1">{link.title || '(Untitled)'}</p>
                              <p className="mt-0.5 truncate text-xs text-t3">
                                <a
                                  href={link.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {link.pdfUrl}
                                </a>
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {link.documentType && (
                                  <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-t3">
                                    {link.documentType}
                                  </span>
                                )}
                                {link.sourceDocumentDateText && (
                                  <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-t3">
                                    {link.sourceDocumentDateText}
                                  </span>
                                )}
                                {link.statusText && (
                                  <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-t3">
                                    {link.statusText}
                                  </span>
                                )}
                                {link.language && (
                                  <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-t3 uppercase">
                                    {link.language}
                                  </span>
                                )}
                                <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-t3">
                                  page {link.listPage}
                                </span>
                              </div>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {/* Footer */}
            {(state === 'ready' || state === 'importing') && (
              <div className="flex items-center justify-between border-t border-border bg-panel px-5 py-3">
                <span className="text-xs text-t3">
                  {selectedLinks.length} document{selectedLinks.length !== 1 ? 's' : ''} will be downloaded and OCR-processed
                </span>
                <button
                  type="button"
                  onClick={importSelected}
                  disabled={selectedLinks.length === 0 || state === 'importing'}
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {state === 'importing' ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Importing&hellip;
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Download &amp; OCR ({selectedLinks.length})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
