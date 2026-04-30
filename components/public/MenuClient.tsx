'use client';

// ─────────────────────────────────────────────────────────────
// /menu page client.
//
// All cart + modal + checkout-drawer state now lives in cart-context
// (lib/cart-context.tsx) and is rendered globally via PublicShell.
// This component only owns the catalog: hero, search, category pills,
// and the grid. Each card opens the global DrinkDetailModal.
// ─────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { pkr } from '@/lib/utils';
import type { Category, DrinkWithCategory } from '@/lib/utils';
import { SHOP, deliverySummary } from '@/lib/shop';
import { useZone } from '@/lib/zone-context';
import DrinkCard from './DrinkCard';

export default function MenuClient({
  initialDrinks,
  categories,
}: {
  initialDrinks: DrinkWithCategory[];
  categories: Category[];
}) {
  const [activeCat, setActiveCat] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');
  const zone = useZone();
  const canOrder = zone.canOrder;

  const startingFrom = useMemo(
    () =>
      initialDrinks.length
        ? initialDrinks.reduce((m, d) => Math.min(m, d.price), Infinity)
        : 540,
    [initialDrinks]
  );

  // Filter + group by category for the grid.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = initialDrinks.filter((d) => {
      if (activeCat !== 'all' && d.category_id !== activeCat) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.description || '').toLowerCase().includes(q))
        return false;
      return true;
    });
    const byCat = new Map<string, DrinkWithCategory[]>();
    for (const d of filtered) {
      const key = d.category_id || 'misc';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(d);
    }
    return Array.from(byCat.entries()).map(([catId, items]) => ({
      catId,
      cat: categories.find((c) => c.id === catId) || null,
      items,
    }));
  }, [initialDrinks, activeCat, query, categories]);

  const areaCount = SHOP.delivery.areas.length;
  const clusterCount = new Set(SHOP.delivery.areas.map((a) => a.cluster)).size;

  return (
    <>
      {/* ─── HEADER ─────────────────────────────────────── */}
      <section
        className="grain"
        style={{ background: 'var(--bone)', paddingTop: 140, paddingBottom: 40 }}
      >
        <div className="relative z-[2] max-w-[1400px] mx-auto px-7 lg:px-10">
          <div className="flex items-center gap-3 mb-7">
            <span style={{ height: 1, width: 44, background: 'var(--line-strong)' }} />
            <span
              style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--terra)' }}
            />
            <span className="eyebrow">The full menu · updated weekly</span>
          </div>
          <h1
            className="display"
            style={{ fontSize: 'clamp(3rem, 7vw, 7rem)', maxWidth: 1100 }}
          >
            Pick a <span className="ital">drink,</span>
            <br />
            we&apos;ll make it <span className="ital">slow</span>.
          </h1>
          <p
            className="mt-6"
            style={{
              maxWidth: 540,
              color: 'var(--ink-soft)',
              fontSize: 15,
              lineHeight: 1.65,
            }}
          >
            Espresso classics, cold-brewed coffee, blended frappés and fresh lemonades.
            Delivering to{' '}
            <span style={{ color: 'var(--terra)' }}>{deliverySummary()}</span> — Bykea, inDrive
            or WhatsApp.
          </p>

          <div
            className="grid mt-10 pt-7"
            style={{
              borderTop: '1px solid var(--line)',
              gridTemplateColumns: 'auto auto auto 1fr auto',
              gap: 44,
              alignItems: 'center',
            }}
          >
            <Stat num={initialDrinks.length} label="drinks" italic />
            <Stat num={String(startingFrom)} label="starting pkr" />
            <Stat num={`${areaCount} blocks`} label={`${clusterCount} neighbourhoods`} />
            <span />
            <span className="chip">
              <span className="dot" />
              {SHOP.hoursSummary}
            </span>
          </div>
        </div>
      </section>

      {!canOrder && zone.resolved && (
        <BrowseModeBanner status={zone.status} onRecheck={zone.openGate} />
      )}

      {/* ─── STICKY TOOLBAR ─────────────────────────────── */}
      <div
        className="sticky z-30"
        style={{
          top: 88,
          background: 'rgba(252,247,235,0.92)',
          backdropFilter: 'blur(14px) saturate(140%)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-7 lg:px-10 py-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute top-1/2 -translate-y-1/2 left-3"
              style={{ color: 'var(--ink-muted)' }}
            />
            <input
              type="search"
              placeholder="Search drinks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: 36 }}
            />
          </div>
          <div
            className="flex items-center gap-1 overflow-x-auto"
            style={{ flex: '1 1 0', minWidth: 0 }}
          >
            <CatPill active={activeCat === 'all'} onClick={() => setActiveCat('all')}>
              All
            </CatPill>
            {categories.map((c) => (
              <CatPill
                key={c.id}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
              >
                {c.emoji ? `${c.emoji} ` : ''}
                {c.name}
              </CatPill>
            ))}
          </div>
        </div>
      </div>

      {/* ─── DRINKS GRID (grouped by category) ──────────── */}
      <section style={{ background: 'var(--paper)', padding: '50px 0 110px' }}>
        <div className="max-w-[1400px] mx-auto px-7 lg:px-10 space-y-16">
          {grouped.length === 0 && (
            <div className="text-center py-20">
              <p className="serif italic" style={{ fontSize: 20, color: 'var(--ink-soft)' }}>
                Nothing matches that.
              </p>
              <button
                onClick={() => {
                  setQuery('');
                  setActiveCat('all');
                }}
                className="mt-4 underline"
                style={{ color: 'var(--terra)', fontSize: 13 }}
              >
                Clear filters
              </button>
            </div>
          )}

          {grouped.map(({ catId, cat, items }) => (
            <div key={catId}>
              <div className="flex items-end justify-between mb-7 flex-wrap gap-3">
                <h2
                  className="display"
                  style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)' }}
                >
                  {cat?.name ?? 'More'}{' '}
                  {cat?.emoji && <span style={{ fontSize: '0.6em' }}>{cat.emoji}</span>}
                </h2>
                <span
                  className="serif italic"
                  style={{ color: 'var(--ink-muted)', fontSize: 18 }}
                >
                  {items.length} drink{items.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid gap-x-6 gap-y-10 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {items.map((d) => (
                  <DrinkCard key={d.id} drink={d} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function CatPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-2 rounded-full text-[13px] transition-colors"
      style={
        active
          ? { background: 'var(--ink)', color: 'var(--bone)' }
          : { background: 'transparent', color: 'var(--ink-soft)' }
      }
    >
      {children}
    </button>
  );
}

function Stat({
  num,
  label,
  italic,
}: {
  num: number | string;
  label: string;
  italic?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="serif"
        style={{
          fontSize: 26,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          fontStyle: italic ? 'italic' : 'normal',
          color: italic ? 'var(--terra)' : 'var(--ink)',
        }}
      >
        {num}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── Browse-mode banner ─── */
function BrowseModeBanner({
  status,
  onRecheck,
}: {
  status: 'unknown' | 'browsing' | 'in';
  onRecheck: () => void;
}) {
  const browsing = status === 'browsing';
  return (
    <div
      style={{
        background: 'rgba(28,23,18,0.05)',
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div className="max-w-[1400px] mx-auto px-7 lg:px-10 py-3 flex items-center gap-4 flex-wrap">
        <span
          className="inline-flex items-center gap-2"
          style={{ fontSize: 12, color: 'var(--ink-soft)' }}
        >
          <MapPin size={13} style={{ color: 'var(--ink-muted)' }} />
          {browsing ? (
            <>
              Browse mode — your area isn&apos;t on our delivery list yet. Pickup at the bar
              is open to everyone.
            </>
          ) : (
            <>Pick your delivery area to unlock ordering — FB Area + North Nazimabad.</>
          )}
        </span>
        <button
          onClick={onRecheck}
          className="inline-flex items-center gap-1 rounded-full"
          style={{
            fontSize: 12,
            color: 'var(--ink)',
            border: '1px solid var(--line-strong)',
            padding: '6px 12px',
          }}
        >
          <MapPin size={11} /> {browsing ? 'Pick an area' : 'Set area'}
        </button>
      </div>
    </div>
  );
}
