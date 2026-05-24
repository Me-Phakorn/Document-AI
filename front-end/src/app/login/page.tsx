import { LoginForm } from '@/components/login-form';
import { normalizeNextPath } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const errorMessage = typeof params.error === 'string' ? params.error : null;
  const nextPath = normalizeNextPath(params.next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef3f9_100%)] px-4 py-10">
      <section className="w-full max-w-sm rounded-lg border border-border bg-panel p-6 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-base font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.28)]">
            D
          </div>
          <h1 className="text-2xl font-semibold text-t1">Login</h1>
        </div>
        <LoginForm errorMessage={errorMessage} nextPath={nextPath} />
      </section>
    </main>
  );
}