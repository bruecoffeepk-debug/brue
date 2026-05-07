'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Coffee, FolderOpen, Home, LayoutGrid, LogOut, ExternalLink, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Wordmark from '@/components/brand/Wordmark';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutGrid, exact: true },
  { href: '/admin/orders', label: 'Orders', icon: Receipt },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/drinks', label: 'Drinks', icon: Coffee },
  { href: '/admin/categories', label: 'Categories', icon: FolderOpen },
];

export default function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside
      className="sticky top-0 self-start h-screen flex flex-col grain"
      style={{
        width: 260,
        background: 'var(--paper)',
        borderRight: '1px solid var(--line)',
      }}
    >
      <div className="px-6 pt-7 pb-5 relative z-[2]">
        <Link href="/" className="inline-flex items-center gap-2">
          <Wordmark tone="terra" size={28} />
        </Link>
        <div
          className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full"
          style={{
            background: 'var(--bone)',
            border: '1px solid var(--line)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--terra)' }} />
          Admin · No. 001
        </div>
      </div>

      <nav className="px-3 mt-2 relative z-[2]">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-colors"
              style={{
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? 'var(--bone)' : 'var(--ink)',
              }}
            >
              <Icon size={16} style={active ? { color: 'var(--mustard)' } : { color: 'var(--ink-muted)' }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pb-5 relative z-[2]">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2 px-3 py-2 mb-1 rounded-xl"
          style={{ color: 'var(--ink-soft)', fontSize: 13 }}
        >
          <ExternalLink size={14} /> View site
        </Link>
        <Link
          href="/pos"
          className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl"
          style={{ color: 'var(--ink-soft)', fontSize: 13 }}
        >
          <Home size={14} /> POS terminal
        </Link>
        <div
          className="px-3 pt-4"
          style={{ borderTop: '1px dashed var(--line-strong)', color: 'var(--ink-muted)', fontSize: 12 }}
        >
          <div className="truncate" style={{ color: 'var(--ink-soft)' }}>{email}</div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 mt-2"
            style={{ fontSize: 12, color: 'var(--terra)' }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
