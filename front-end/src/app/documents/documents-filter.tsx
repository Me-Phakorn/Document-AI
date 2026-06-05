'use client';

import { ChevronDown, EyeOff, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { WorkflowStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: WorkflowStatus | ''; label: string }[] = [
  { value: '', label: 'ทุก Status' },
  { value: 'UPLOADED', label: 'Uploaded' },
  { value: 'OCR_PROCESSING', label: 'OCR Processing' },
  { value: 'OCR_COMPLETED', label: 'OCR Completed' },
  { value: 'OCR_PARTIAL', label: 'OCR Partial' },
  { value: 'OCR_FAILED', label: 'OCR Failed' },
  { value: 'MANUAL_EDIT' as WorkflowStatus, label: 'Manual Edit' },
  { value: 'AI_PENDING', label: 'AI Pending' },
  { value: 'AI_PROCESSING', label: 'AI Processing' },
  { value: 'AI_COMPLETED', label: 'AI Completed' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'NOT_RELEVANT', label: 'Not Relevant' },
  { value: 'FAILED', label: 'Failed' },
];

const IGNORE_OPTIONS = STATUS_OPTIONS.filter((o) => o.value !== '');

interface Props {
  currentSearch: string;
  currentStatus: string;
  currentIgnore: string;
}

export function DocumentsFilter({ currentSearch, currentStatus, currentIgnore }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);
  const [ignoredSet, setIgnoredSet] = useState<Set<string>>(
    () => new Set(currentIgnore.split(',').filter(Boolean)),
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync when server re-renders with new URL params
  useEffect(() => {
    setSearch(currentSearch);
    setStatus(currentStatus);
    setIgnoredSet(new Set(currentIgnore.split(',').filter(Boolean)));
  }, [currentSearch, currentStatus, currentIgnore]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  function push(nextSearch: string, nextStatus: string, nextIgnored: Set<string>) {
    const qs = new URLSearchParams();
    if (nextSearch.trim()) qs.set('search', nextSearch.trim());
    if (nextStatus) qs.set('status', nextStatus);
    const ignoreStr = [...nextIgnored].join(',');
    if (ignoreStr) qs.set('ignore', ignoreStr);
    // Preserve the active source tab
    const currentSource = searchParams.get('source');
    if (currentSource) qs.set('source', currentSource);
    startTransition(() => {
      router.push(`?${qs}`);
    });
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    push(val, status, ignoredSet);
  }

  function handleStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setStatus(val);
    push(search, val, ignoredSet);
  }

  function handleIgnoreToggle(value: string) {
    const next = new Set(ignoredSet);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    setIgnoredSet(next);
    push(search, status, next);
  }

  function handleClear() {
    setSearch('');
    setStatus('');
    setIgnoredSet(new Set());
    setDropdownOpen(false);
    startTransition(() => {
      router.push('?');
    });
  }

  const hasFilter = !!(search || status || ignoredSet.size > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-t3"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={handleSearch}
          placeholder="ค้นหาชื่อเอกสาร..."
          className="h-8 w-56 rounded-md border border-border bg-raised pl-8 pr-3 text-xs text-t1 placeholder:text-t3 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Filter: show only one status */}
      <select
        value={status}
        onChange={handleStatus}
        className="h-8 rounded-md border border-border bg-raised px-2.5 text-xs text-t1 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Ignore: hide statuses */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          onClick={() => setDropdownOpen((o) => !o)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
            ignoredSet.size > 0
              ? 'border-amber/40 bg-amber/10 text-amber'
              : 'border-border bg-raised text-t2 hover:bg-panel'
          }`}
        >
          <EyeOff size={12} aria-hidden="true" />
          ซ่อนสถานะ{ignoredSet.size > 0 ? ` (${ignoredSet.size})` : ''}
          <ChevronDown
            size={11}
            className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {dropdownOpen && (
          <div
            role="listbox"
            aria-label="เลือกสถานะที่ต้องการซ่อน"
            className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-border bg-panel shadow-panel"
          >
            <p className="border-b border-border px-3 py-2 text-xs font-medium text-t3">
              ซ่อนสถานะ (เลือกได้หลายข้อ)
            </p>
            <div className="max-h-72 overflow-y-auto p-1">
              {IGNORE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-raised"
                >
                  <input
                    type="checkbox"
                    checked={ignoredSet.has(opt.value)}
                    onChange={() => handleIgnoreToggle(opt.value)}
                    className="accent-accent"
                  />
                  <span className={ignoredSet.has(opt.value) ? 'text-t3 line-through' : 'text-t1'}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            {ignoredSet.size > 0 && (
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIgnoredSet(new Set());
                    push(search, status, new Set());
                  }}
                  className="w-full rounded px-2 py-1.5 text-left text-xs text-t3 hover:bg-raised"
                >
                  ล้างที่ซ่อน
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear all filters */}
      {hasFilter ? (
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-t3 hover:bg-raised"
        >
          <X size={12} />
          ล้าง
        </button>
      ) : null}
    </div>
  );
}
