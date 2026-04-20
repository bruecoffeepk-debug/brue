import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Coffee, FolderOpen, AlertCircle, TrendingUp, Plus, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getStats() {
  const supabase = createClient();
  const [drinks, soldOut, cats, recent] = await Promise.all([
    supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase
      .from('menu_items')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .eq('in_stock', false),
    supabase.from('categories').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase
      .from('menu_items')
      .select('id, name, price, in_stock, updated_at, photo')
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);
  return {
    drinks: drinks.count ?? 0,
    soldOut: soldOut.count ?? 0,
    cats: cats.count ?? 0,
    recent: recent.data ?? [],
  };
}

export default async function AdminDashboard() {
  const s = await getStats();

  return (
    <div className="px-10 py-12 max-w-[1200px]">
      <header className="flex items-end justify-between gap-6 mb-12 flex-wrap">
        <div>
          <span className="eyebrow">Today · BRUE No. 001</span>
          <h1
            className="display mt-3"
            style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4rem)' }}
          >
            Good morning, <span className="ital">brewer</span>.
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/drinks/new" className="btn btn-primary">
            <Plus size={14} /> New drink
          </Link>
        </div>
      </header>

      {/* stat row */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 mb-12"
        style={{
          gap: 1,
          background: 'var(--line)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <StatCard label="Drinks active" num={s.drinks} icon={<Coffee size={16} />} />
        <StatCard
          label="Sold out"
          num={s.soldOut}
          icon={<AlertCircle size={16} />}
          accent={s.soldOut > 0}
        />
        <StatCard label="Categories" num={s.cats} icon={<FolderOpen size={16} />} />
        <StatCard label="Last sync" num="just now" icon={<TrendingUp size={16} />} small />
      </div>

      {/* quick actions */}
      <div
        className="grid md:grid-cols-3"
        style={{ gap: 2, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}
      >
        <ActionCard
          title="Manage drinks"
          body="Add, edit, mark sold out, change price or photo. Public menu refreshes within a minute."
          href="/admin/drinks"
          cta="Open drinks"
        />
        <ActionCard
          title="Manage categories"
          body="Add a new category like Sweets or Pastries. Reorder, rename, or hide entire sections."
          href="/admin/categories"
          cta="Open categories"
        />
        <ActionCard
          title="Open POS"
          body="Take an in-store order, print a receipt, log a payment. Same Supabase, separate flow."
          href="/pos"
          cta="Open POS"
        />
      </div>

      {/* recent edits */}
      <div className="mt-14">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="display" style={{ fontSize: 28 }}>
            Recently <span className="ital">edited</span>
          </h2>
          <Link
            href="/admin/drinks"
            className="text-sm inline-flex items-center gap-1"
            style={{ color: 'var(--ink-soft)' }}
          >
            All drinks <ArrowRight size={12} />
          </Link>
        </div>
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 14,
            background: 'var(--paper)',
            overflow: 'hidden',
          }}
        >
          {s.recent.length === 0 && (
            <div className="px-5 py-8 text-center" style={{ color: 'var(--ink-muted)' }}>
              No drinks yet. <Link href="/admin/drinks/new" style={{ color: 'var(--terra)' }}>Add the first one →</Link>
            </div>
          )}
          {s.recent.map((d, i) => (
            <Link
              href={`/admin/drinks/${d.id}`}
              key={d.id}
              className="flex items-center gap-4 px-5 py-3 hover:bg-black/[0.03]"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}
            >
              <span
                className="serif italic"
                style={{ width: 28, color: 'var(--terra)', fontSize: 18 }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 serif" style={{ fontSize: 18 }}>
                {d.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                PKR {d.price.toLocaleString('en-PK')}
              </span>
              {!d.in_stock && (
                <span
                  className="chip"
                  style={{ background: 'var(--ink)', color: 'var(--bone)', borderColor: 'transparent' }}
                >
                  Sold out
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  num,
  icon,
  accent,
  small,
}: {
  label: string;
  num: number | string;
  icon: React.ReactNode;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--paper)',
        padding: '24px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span
        className="eyebrow flex items-center gap-2"
        style={{ color: accent ? 'var(--terra)' : 'var(--ink-muted)' }}
      >
        {icon} {label}
      </span>
      <span
        className="serif"
        style={{
          fontSize: small ? 22 : 40,
          letterSpacing: '-0.02em',
          color: accent ? 'var(--terra)' : 'var(--ink)',
          lineHeight: 1,
        }}
      >
        {num}
      </span>
    </div>
  );
}

function ActionCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group block"
      style={{ background: 'var(--paper)', padding: '28px 26px' }}
    >
      <h3 className="display" style={{ fontSize: 24 }}>
        {title}
      </h3>
      <p className="mt-3" style={{ color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.6 }}>
        {body}
      </p>
      <span
        className="mt-5 inline-flex items-center gap-1 text-sm"
        style={{ color: 'var(--terra)' }}
      >
        {cta} <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
