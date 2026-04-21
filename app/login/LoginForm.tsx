'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Wordmark from '@/components/brand/Wordmark';
import Flower from '@/components/brand/Flower';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(error.message);
      } else {
        router.push(next);
        router.refresh();
      }
    } catch (e: any) {
      setErr(e.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="min-h-screen grain flex"
      style={{ background: 'var(--ink)', color: 'var(--bone)' }}
    >
      {/* left: visual */}
      <div className="hidden md:flex flex-1 items-center justify-center p-12 relative">
        <div className="absolute inset-0 grain pointer-events-none" style={{ opacity: 0.4 }} />
        <div className="relative z-[2] max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 mb-12">
            <Wordmark tone="bone" size={36} />
          </Link>
          <span className="eyebrow" style={{ color: 'var(--mustard)' }}>
            Staff & Admin · No. 001
          </span>
          <h1
            className="display mt-5"
            style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4.4rem)', color: 'var(--bone)' }}
          >
            Sign in to <span className="ital" style={{ color: 'var(--mustard)' }}>BRUE</span>.
          </h1>
          <p
            className="mt-5 max-w-sm"
            style={{ color: 'rgba(244,234,218,0.7)', fontSize: 15, lineHeight: 1.6 }}
          >
            Admin manages the menu, categories and stock. POS handles in-store orders. Same login
            for both — your role decides what you see.
          </p>
          <p
            className="script mt-8 inline-flex items-center gap-2"
            style={{ color: 'var(--terra-soft)', fontSize: 22, transform: 'rotate(-2deg)' }}
          >
            see you behind the bar
            <Flower size={20} color="var(--terra-soft)" centerColor="var(--mustard, #d4972e)" spin />
          </p>
        </div>
      </div>

      {/* right: form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'var(--bone)', color: 'var(--ink)' }}
      >
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8">
            <Wordmark tone="terra" size={32} />
          </div>

          <span className="eyebrow">Welcome back</span>
          <h2 className="display mt-3" style={{ fontSize: 38 }}>
            Sign <span className="ital">in</span>.
          </h2>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="hello@bruecoffee.pk"
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {err && (
              <div
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'rgba(196,69,38,0.08)',
                  color: 'var(--terra-deep)',
                  border: '1px solid rgba(196,69,38,0.2)',
                }}
              >
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary w-full"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              {busy ? 'Signing in…' : (
                <>
                  Sign in <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <p
            className="mt-7 text-center"
            style={{ fontSize: 11, color: 'var(--ink-muted)', letterSpacing: '0.18em', textTransform: 'uppercase' }}
          >
            Add staff in Supabase → Auth → Users
          </p>

          <div className="mt-7 text-center">
            <Link
              href="/"
              style={{ fontSize: 13, color: 'var(--ink-soft)' }}
              className="hover:underline"
            >
              ← Back to BRUE
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
