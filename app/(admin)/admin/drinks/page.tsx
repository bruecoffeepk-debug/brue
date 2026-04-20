import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Plus, Search } from 'lucide-react';
import StockToggle from '@/components/admin/StockToggle';
import DeleteButton from '@/components/admin/DeleteButton';
import { pkr } from '@/lib/utils';
import type { Category, DrinkWithCategory } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function getData(): Promise<{ drinks: DrinkWithCategory[]; categories: Category[] }> {
  const supabase = createClient();
  const [d, c] = await Promise.all([
    supabase
      .from('menu_items')
      .select('*, categories ( id, name, slug, emoji )')
      .order('sort_order', { ascending: true }),
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
  ]);
  return { drinks: (d.data ?? []) as any, categories: (c.data ?? []) as any };
}

export default async function DrinksAdminPage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string; deleted?: string };
}) {
  const { drinks, categories } = await getData();
  const q = (searchParams.q ?? '').toLowerCase();
  const catId = searchParams.cat;

  const filtered = drinks.filter((d) => {
    if (catId && d.category_id !== catId) return false;
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="px-10 py-12 max-w-[1300px]">
      <header className="flex items-end justify-between gap-6 mb-10 flex-wrap">
        <div>
          <span className="eyebrow">Catalogue · {drinks.length} drinks</span>
          <h1 className="display mt-3" style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4rem)' }}>
            <span className="ital">Drinks</span>.
          </h1>
          <p className="mt-2" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            Toggle <span style={{ color: 'var(--terra)' }}>in stock</span> to instantly mark a drink
            sold out on the public menu.
          </p>
        </div>
        <Link href="/admin/drinks/new" className="btn btn-primary">
          <Plus size={14} /> New drink
        </Link>
      </header>

      {searchParams.deleted && (
        <div
          className="mb-6 px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'var(--cream)',
            border: '1px solid var(--line)',
            color: 'var(--ink-soft)',
          }}
        >
          Drink deleted.
        </div>
      )}

      {/* search + filter row */}
      <form
        method="get"
        className="flex items-center gap-3 mb-6 flex-wrap"
      >
        <label
          className="flex items-center gap-2 px-3 py-2 rounded-full"
          style={{ background: 'var(--paper)', border: '1px solid var(--line)', minWidth: 240 }}
        >
          <Search size={14} style={{ color: 'var(--ink-muted)' }} />
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Search drinks…"
            className="bg-transparent outline-none text-sm flex-1"
          />
        </label>
        <select
          name="cat"
          defaultValue={catId ?? ''}
          className="select"
          style={{ width: 'auto', minWidth: 180 }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji}  ` : ''}{c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-outline btn-sm" type="submit">Filter</button>
        {(searchParams.q || catId) && (
          <Link href="/admin/drinks" className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Clear
          </Link>
        )}
      </form>

      {/* drinks table */}
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <div
          className="grid items-center px-5 py-3"
          style={{
            gridTemplateColumns: '60px 2fr 1.2fr 1fr 1fr 110px 80px',
            gap: 16,
            borderBottom: '1px solid var(--line-strong)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          <span />
          <span>Drink</span>
          <span>Category</span>
          <span>Price</span>
          <span>Stock</span>
          <span>Active</span>
          <span />
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center" style={{ color: 'var(--ink-muted)' }}>
            No drinks match your filter.
          </div>
        )}

        {filtered.map((d) => (
          <div
            key={d.id}
            className="grid items-center px-5 py-3"
            style={{
              gridTemplateColumns: '60px 2fr 1.2fr 1fr 1fr 110px 80px',
              gap: 16,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: 'var(--cream)',
              }}
            >
              {d.photo ? (
                <Image src={d.photo} alt={d.name} fill sizes="44px" className="object-cover" />
              ) : (
                <span
                  className="absolute inset-0 flex items-center justify-center serif italic"
                  style={{ color: 'var(--ink-muted)', fontSize: 18 }}
                >
                  ø
                </span>
              )}
            </div>
            <div>
              <Link
                href={`/admin/drinks/${d.id}`}
                className="serif"
                style={{ fontSize: 18, letterSpacing: '-0.01em' }}
              >
                {d.name}
              </Link>
              {d.description && (
                <div
                  className="truncate"
                  style={{ color: 'var(--ink-muted)', fontSize: 12, maxWidth: 360 }}
                >
                  {d.description}
                </div>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {d.categories?.name || d.category || <span style={{ color: 'var(--ink-muted)' }}>—</span>}
            </div>
            <div className="serif" style={{ fontSize: 16 }}>
              {pkr(d.price)}
            </div>
            <StockToggle id={d.id} initial={d.in_stock} />
            <ActiveBadge active={d.active} />
            <div className="flex items-center gap-1 justify-end">
              <Link
                href={`/admin/drinks/${d.id}`}
                className="px-3 py-1.5 text-xs rounded-full"
                style={{ border: '1px solid var(--line-strong)', color: 'var(--ink-soft)' }}
              >
                Edit
              </Link>
              <DeleteButton id={d.id} name={d.name} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: 'var(--cream)',
        fontSize: 11,
        letterSpacing: '0.04em',
        color: 'var(--ink-soft)',
        width: 'fit-content',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--sage)' }} /> Live
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: 'rgba(28,23,18,0.06)',
        fontSize: 11,
        letterSpacing: '0.04em',
        color: 'var(--ink-muted)',
        width: 'fit-content',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ink-muted)' }} /> Hidden
    </span>
  );
}
