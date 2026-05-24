import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { authTokenCookieName, verifySessionToken } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'DocAI Admin',
  description: 'Document intelligence, review, rulebook, compliance, and reporting workspace',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(authTokenCookieName)?.value ?? null;
  const session = await verifySessionToken(token);
  const currentUser = session ? { username: session.username, role: session.role } : null;

  return (
    <html lang="th">
      <body>
        <AppShell currentUser={currentUser}>{children}</AppShell>
      </body>
    </html>
  );
}