import { Plus, Users } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { PageHeader } from '@/components/page-header';
import { createUser, listUsers, type UserRole } from '@/lib/api/users';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const roles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'REVIEWER', 'ANALYST', 'VIEWER'];

async function createUserAction(formData: FormData) {
  'use server';
  const email = formData.get('email')?.toString().trim();
  const displayName = formData.get('displayName')?.toString().trim();
  const role = formData.get('role')?.toString() as UserRole | undefined;
  if (!email || !displayName || !role) return;
  await createUser({ email, displayName, role });
  revalidatePath('/users');
  revalidatePath('/audit');
}

export default async function UsersPage() {
  const users = await listUsers({ limit: 50 });

  return (
    <div>
      <PageHeader
        eyebrow="Users"
        title="Role assignments"
        description="Platform users are persisted for ownership, reviewer attribution, and audit trails. Basic Auth remains the current local access gate."
      />

      <section className="rounded-lg border border-border bg-panel p-5 shadow-panel">
        <div className="flex items-center gap-2 text-accent"><Users size={17} aria-hidden="true" /><h2 className="font-semibold text-t1">Create user</h2></div>
        <form action={createUserAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
          <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Email</span><input required type="email" name="email" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" /></label>
          <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Display name</span><input required name="displayName" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1" /></label>
          <label className="grid gap-1 text-sm text-t2"><span className="text-xs font-medium uppercase tracking-wide text-t3">Role</span><select name="role" className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-t1">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <button className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"><Plus size={15} />Create</button>
        </form>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel shadow-panel">
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-t1">Users</h2></div>
        <div className="divide-y divide-border">
          {users.items.map((user) => (
            <article key={user.id} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_160px_180px] md:items-center">
              <div><p className="font-medium text-t1">{user.displayName}</p><p className="mt-1 text-sm text-t2">{user.email}</p></div>
              <span className="w-fit rounded bg-raised px-2 py-1 text-xs text-t2">{user.role}</span>
              <span className="text-sm text-t3">{formatDateTime(user.createdAt)}</span>
            </article>
          ))}
          {!users.items.length ? <div className="px-4 py-12 text-center text-sm text-t2">No users have been created yet.</div> : null}
        </div>
      </section>
    </div>
  );
}