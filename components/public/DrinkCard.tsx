'use client';

// ─────────────────────────────────────────────────────────────
// DrinkCard — the menu / specials grid cell.
//
// Click anywhere on the card → opens the global DrinkDetailModal
// (mounted at the public layout level via PublicShell). Cart actions
// happen inside the modal, not here, so the card is a pure visual
// link plus a "View" hint on hover.
//
// Used by:
//   - components/public/MenuClient.tsx (the /menu grid)
//   - app/(public)/home/page.tsx       (the specials / desserts / new
//                                       recipe rows on /home)
// ─────────────────────────────────────────────────────────────

import Image from 'next/image';
import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { pkr, drinkPhotos } from '@/lib/utils';
import type { DrinkWithCategory } from '@/lib/utils';
import { useCart } from '@/lib/cart-context';
import { useZone } from '@/lib/zone-context';
import { track } from '@/lib/analytics';

export default function DrinkCard({ drink }: { drink: DrinkWithCategory }) {
  const { openDrinkModal } = useCart();
  const { canOrder } = useZone();
  const sold = !drink.in_stock;
  const photo = drink.photo || '/Brue_DP_Orange.png';
  const photoCount = useMemo(
    () => drinkPhotos(drink.name, drink.photo).length,
    [drink.name, drink.photo]
  );

  return (
    <button
      type="button"
      onClick={() => {
        track('drink_view', {
          drink_id: drink.id,
          drink_name: drink.name,
          category: drink.category,
        });
        openDrinkModal(drink);
      }}
      id={drink.id}
      className="group text-left w-full"
      style={{ opacity: sold ? 0.6 : 1, cursor: 'pointer' }}
      aria-label={`View ${drink.name}`}
    >
      <div
        className="relative overflow-hidden grain"
        style={{
          aspectRatio: '1 / 1',
          borderRadius: 14,
          background: 'var(--cream)',
          boxShadow: '0 24px 50px -28px rgba(28,23,18,0.22)',
        }}
      >
        <Image
          src={photo}
          alt={drink.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
        {sold && (
          <span
            className="absolute top-3 left-3 z-[2]"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              background: 'var(--ink)',
              color: 'var(--bone)',
              padding: '5px 10px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            Sold out
          </span>
        )}
        {photoCount > 1 && !sold && (
          <span
            className="absolute top-3 right-3 z-[2] inline-flex items-center gap-1"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              background: 'rgba(252,247,235,0.92)',
              color: 'var(--ink)',
              padding: '4px 8px',
              borderRadius: 999,
              fontWeight: 600,
              backdropFilter: 'blur(6px)',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--terra)' }} />
            {photoCount} pics
          </span>
        )}
        <div
          className="absolute inset-0 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: 'linear-gradient(to top, rgba(28,23,18,0.45), transparent 50%)',
            pointerEvents: 'none',
          }}
        >
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{
              background: 'var(--bone)',
              color: 'var(--ink)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            View
          </span>
        </div>
      </div>

      <div className="flex items-baseline justify-between mt-4 gap-3">
        <h3
          className="serif"
          style={{ fontSize: 19, lineHeight: 1.15, letterSpacing: '-0.02em' }}
        >
          {drink.name}
        </h3>
        <span
          className="serif"
          style={{ fontSize: 16, color: 'var(--ink-soft)', letterSpacing: '-0.02em' }}
        >
          {pkr(drink.price)}
        </span>
      </div>
      {drink.description && (
        <p
          className="mt-1"
          style={{ color: 'var(--ink-muted)', fontSize: 13, lineHeight: 1.5 }}
        >
          {drink.description}
        </p>
      )}

      <span
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium"
        style={{
          color: sold
            ? 'var(--ink-muted)'
            : canOrder
            ? 'var(--terra)'
            : 'var(--ink-muted)',
          letterSpacing: '0.04em',
        }}
      >
        {sold ? (
          '— sold out —'
        ) : canOrder ? (
          <>View &amp; add <span className="arrow">→</span></>
        ) : (
          <>Pick your area <Lock size={11} /></>
        )}
      </span>
    </button>
  );
}
