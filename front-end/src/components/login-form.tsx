'use client';

import { LogIn } from 'lucide-react';
import { useFormStatus } from 'react-dom';

interface LoginFormProps {
  errorMessage?: string | null;
  nextPath?: string;
}

export function LoginForm({ errorMessage, nextPath = '/dashboard' }: LoginFormProps) {
  return (
    <form action="/api/auth/login" method="POST" className="space-y-4">
      <input type="hidden" name="nextPath" value={nextPath} />

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium text-t1">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-t1 outline-none transition placeholder:text-t3 focus:border-accent focus:ring-4 focus:ring-[rgba(79,70,229,0.12)]"
          placeholder="Username"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-t1">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-t1 outline-none transition placeholder:text-t3 focus:border-accent focus:ring-4 focus:ring-[rgba(79,70,229,0.12)]"
          placeholder="Password"
        />
      </div>

      {errorMessage ? <p className="rounded-md border border-[rgba(207,46,53,0.16)] bg-[rgba(207,46,53,0.06)] px-3 py-2 text-sm text-red">{errorMessage}</p> : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <LogIn size={16} aria-hidden="true" />
      {pending ? 'Signing in...' : 'Login'}
    </button>
  );
}