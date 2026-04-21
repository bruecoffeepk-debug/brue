'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { OpenStatusChip } from './OpenStatus';
import Wordmark from '@/components/brand/Wordmark';

const LINKS = [
  ['/home', 'Home'],
  ['/menu', 'Menu'],
  ['/find-us', 'Find Us'],
  ['/about', 'About'],
] as const;

export default function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="fixed left-0 right-0 z-50 transition-all duration-300"
      style={{ top: scrolled ? 16 : 32 }}
    >
      <div className="mx-auto max-w-[1440px] px-7">
        <nav
          className="flex items-center justify-between gap-6 rounded-full pr-4 pl-6 py-3 transition-shadow"
          style={{
            background: 'rgba(252,247,235,0.78)',
            backdropFilter: 'blur(20px) saturate(140%)',
            WebkitBackdropFilter: 'blur(20px) saturate(140%)',
            border: '1px solid rgba(28,23,18,0.08)',
            boxShadow: scrolled
              ? '0 16px 40px -16px rgba(28,23,18,0.18)'
              : '0 8px 30px -10px rgba(28,23,18,0.08)',
          }}
        >
          <Link href="/home" aria-label="BRUE home" className="flex items-center">
            <Wordmark tone="terra" size={30} />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {LINKS.map(([href, label]) => {
              const active = pathname === href || (href === '/home' && pathname === '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative text-[13px] font-medium tracking-wide transition-colors"
                  style={{ color: active ? 'var(--terra)' : 'var(--ink)' }}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 rounded-full"
                      style={{
                        bottom: -8,
                        width: 4,
                        height: 4,
                        background: 'var(--terra)',
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <OpenStatusChip />
            <Link href="/menu" className="btn btn-primary btn-sm">
              Order <span className="arrow">↗</span>
            </Link>
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            style={{ color: 'var(--ink)' }}
          >
            <Menu size={22} />
          </button>
        </nav>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[60] grain"
          style={{ background: 'var(--ink)', color: 'var(--bone)' }}
        >
          <div className="flex items-center justify-between h-20 px-7">
            <Wordmark tone="bone" size={34} />
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-2">
              <X size={26} />
            </button>
          </div>
          <ul className="px-8 py-10 space-y-6">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="display block text-6xl"
                  style={{ color: 'var(--bone)' }}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li className="pt-4">
              <Link href="/menu" onClick={() => setOpen(false)} className="btn btn-terra">
                Order Now <span className="arrow">↗</span>
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
