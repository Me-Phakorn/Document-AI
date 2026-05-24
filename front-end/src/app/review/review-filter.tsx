'use client';

import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

const OUTCOME_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'ทุก Outcome' },
  { value: 'APPROVED', label: 'อนุมัติ' },
  { value: 'CHANGES_REQUESTED', label: 'ขอแก้ไข' },
  { value: 'REJECTED', label: 'ปฏิเสธ' },
  { value: 'OVERRIDDEN', label: 'Override' },
];

interface Props {
  currentSearch: string;
  currentOutcome: string;
}

export function ReviewFilter({ currentSearch, currentOutcome }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const [outcome, setOutcome] = useState(currentOutcome);

  useEffect(() => {
    setSearch(currentSearch);
    setOutcome(currentOutcome);
  }, [currentSearch, currentOutcome]);

  function push(nextSearch: string, nextOutcome: string) {
    const qs = new URLSearchParams();
    if (nextSearch.trim()) qs.set('search', nextSearch.trim());
    if (nextOutcome) qs.set('outcome', nextOutcome);
    startTransition(() => {
      router.push(`?${qs}`);
    });
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    push(val, outcome);
  }

  function handleOutcome(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setOutcome(val);
    push(search, val);
  }

  function handleClear() {
    setSearch('');
    setOutcome('');
    startTransition(() => {
      router.push('?');
    });
  }

  const hasFilter = !!(search || outcome);

  return (
    <div className="flex flex-wrap items-center gap-2">
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
          className="h-8 w-52 rounded-md border border-border bg-raised pl-8 pr-3 text-xs text-t1 placeholder:text-t3 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <select
        value={outcome}
        onChange={handleOutcome}
        className="h-8 rounded-md border border-border bg-raised px-2.5 text-xs text-t1 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {OUTCOME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

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
