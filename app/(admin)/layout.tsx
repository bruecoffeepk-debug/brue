import AdminNav from '@/components/admin/AdminNav';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defence-in-depth: middleware also gates /admin, but we re-verify here so any direct
  // RSC fetch with no session bounces to /login as well.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bone)' }}>
      <AdminNav email={user.email ?? ''} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
