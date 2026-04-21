'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ListOrdered, LogOut, Receipt, ShoppingCart, Users, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Wordmark from '@/components/brand/Wordmark';

const LINKS = [
  { href: '/pos', label: 'POS', icon: ShoppingCart },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ListOrdered },
  { href: '/menu/manage', label: 'Menu', icon: Receipt },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/expenses', label: 'Expenses', icon: Wallet },
];

export default function PosNav() {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="w-full md:w-64 md:fixed md:inset-y-0 md:left-0 bg-charcoal text-cream flex md:flex-col z-30 border-r border-cream/10">
      <div className="flex md:block items-center justify-between px-5 md:px-6 py-5 md:py-6 md:border-b border-cream/10 w-full">
        <Link href="/pos" className="flex items-center gap-2">
          <Wordmark tone="bone" size={30} />
          <span className="sticker !text-[10px] !py-1 text-amber border-amber">Staff</span>
        </Link>
      </div>

      <nav className="hidden md:flex flex-col gap-1 p-3 flex-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
                active ? 'bg-terracotta text-cream' : 'text-cream/70 hover:bg-cream/5 hover:text-cream'
              }`}
            >
              <Icon size={18} />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}

        <button
          onClick={signOut}
          className="mt-auto flex items-center gap-3 px-4 py-3 rounded-2xl text-cream/60 hover:bg-cream/5 hover:text-cream transition"
        >
          <LogOut size={18} /> Sign out
        </button>
      </nav>

      {/* Mobile horizontal nav */}
      <nav className="flex md:hidden flex-1 overflow-x-auto gap-1 px-3 py-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap text-sm ${
                active ? 'bg-terracotta text-cream' : 'text-cream/70'
              }`}
            >
              <Icon size={16} /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
