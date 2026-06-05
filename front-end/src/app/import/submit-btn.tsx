'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export function SubmitBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-fit items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : icon}
      {pending ? 'Processing…' : label}
    </button>
  );
}
