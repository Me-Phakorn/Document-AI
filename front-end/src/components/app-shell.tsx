'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/import', label: 'Import', icon: UploadCloud },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/prompts', label: 'Prompts', icon: BrainCircuit },
  { href: '/review', label: 'Review', icon: ClipboardCheck },
  { href: '/rulebook', label: 'Rulebook', icon: BookOpen },
  { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/audit', label: 'Audit', icon: History },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children, currentUser }: { children: React.ReactNode; currentUser?: { username: string; role: string } | null }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';
  const isPrintPage = pathname.startsWith('/rulebook/print') || pathname.startsWith('/compliance/print');
  const initials = currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : 'U';

  if (isPrintPage) {
    return <>{children}</>;
  }

  if (isAuthPage) {
    return <div className="min-h-screen bg-bg text-t1">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-bg text-t1">
      <header className="sticky top-0 z-20 flex h-12 items-center border-b border-border bg-panel px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-t1" aria-label="DocAI dashboard">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
            <FileText size={15} aria-hidden="true" />
          </span>
          DocAI
        </Link>
        <div className="ml-8 hidden items-center gap-1 lg:flex">
          {navItems.slice(0, 7).map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  active ? 'bg-raised text-t1' : 'text-t2 hover:bg-raised hover:text-t1'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <Link href="/logout" className="rounded-md border border-border bg-raised px-3 py-1.5 text-sm text-t2 transition hover:bg-white hover:text-t1">
            Log out
          </Link>
          <div
            title={currentUser ? `${currentUser.username} (${currentUser.role})` : undefined}
            className="flex h-8 min-w-8 items-center justify-center rounded-full bg-accent px-2 text-xs font-bold text-white"
          >
            {initials}
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-3rem)] grid-cols-[56px_1fr]">
        <nav className="border-r border-border bg-panel py-3" aria-label="Workspace navigation">
          <div className="flex flex-col items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                    active ? 'bg-[var(--accent-lo)] text-accent' : 'text-t2 hover:bg-raised hover:text-t1'
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        <main className="min-w-0 p-6">{children}</main>
      </div>
    </div>
  );
}