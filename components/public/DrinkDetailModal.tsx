'use client';

// ─────────────────────────────────────────────────────────────
// Global drink detail modal — opens whenever cart-context's
// `openDrink` is set. Mounted ONCE at the public layout level
// (via PublicShell), so it works on /home, /menu, anywhere.
//
// State sources:
//   - drink object: cart context (openDrink)
//   - photo carousel: lib/utils#drinkPhotos(name, primary)
//   - add-to-cart:    cart context (addToCart)
//   - zone gate:      lib/zone-context (canOrder + openGate)
// ─────────────────────────────────────────────────────────────

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Minus, Plus, X } from 'lucide-react';
import { pkr, drinkPhotos } from '@/lib/utils';
import { useCart } from '@/lib/cart-context';
import { useZone } from '@/lib/zone-context';

export default function DrinkDetailModal() {
  const { openDrink, closeDrinkModal, addToCart, openCart } = useCart();
  const zone = useZone();

  // All hooks below depend on `openDrink`. We can't early-return before
  // them (rules-of-hooks). Use a placeholder when null so internal hooks
  // still run, then bail in the render branch at the bottom.
  const drink = openDrink;
  const photos = useMemo(
    () => (drink ? drinkPhotos(drink.name, drink.photo) : []),
    [drink]
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setPhotoIndex(0);
    setQty(1);
  }, [drink?.id]);

  // Esc to close, ←/→ to switch photo
  useEffect(() => {
    if (!drink) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrinkModal();
      else if (e.key === 'ArrowLeft' && photos.length > 1) {
        setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
      } else if (e.key === 'ArrowRight' && photos.length > 1) {
        setPhotoIndex((i) => (i + 1) % photos.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drink, photos.length, closeDrinkModal]);

  // Lock body scroll while open
  useEffect(() => {
    if (!drink) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [drink]);

  if (!drink) return null;

  const sold = !drink.in_stock;
  const cat = drink.categories;
  const total = drink.price * qty;
  const canOrder = zone.canOrder;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      onClick={closeDrinkModal}
      role="dialog"
      aria-modal="true"
      aria-label={drink.name}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(28,23,18,0.6)', backdropFilter: 'blur(4px)' }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full md:max-w-[440px] flex flex-col"
        style={{
          background: 'var(--bone)',
          borderRadius: 22,
          maxHeight: '92vh',
          boxShadow: '0 -30px 80px -20px rgba(28,23,18,0.45)',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={closeDrinkModal}
          aria-label="Close"
          className="absolute top-3 right-3 z-[2] inline-flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(252,247,235,0.92)',
            color: 'var(--ink)',
            border: '1px solid rgba(28,23,18,0.08)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <X size={18} />
        </button>

        <div
          className="relative grain"
          style={{ aspectRatio: '1 / 1', background: 'var(--cream)', flexShrink: 0 }}
        >
          {photos.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt={`${drink.name} — photo ${i + 1}`}
              fill
              sizes="(max-width: 640px) 100vw, 440px"
              className="object-cover transition-opacity duration-500"
              style={{ opacity: i === photoIndex ? 1 : 0 }}
              priority={i === 0}
            />
          ))}

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

          {photos.length > 1 && (
            <>
              <button
                onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                aria-label="Previous photo"
                className="absolute top-1/2 -translate-y-1/2 left-3 inline-flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: 'rgba(252,247,235,0.92)',
                  color: 'var(--ink)',
                  border: '1px solid rgba(28,23,18,0.08)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                aria-label="Next photo"
                className="absolute top-1/2 -translate-y-1/2 right-3 inline-flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: 'rgba(252,247,235,0.92)',
                  color: 'var(--ink)',
                  border: '1px solid rgba(28,23,18,0.08)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <ChevronRight size={18} />
              </button>

              <div
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1.5 rounded-full"
                style={{ background: 'rgba(28,23,18,0.45)', backdropFilter: 'blur(8px)' }}
              >
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    aria-label={`Photo ${i + 1}`}
                    style={{
                      width: i === photoIndex ? 18 : 6,
                      height: 6,
                      borderRadius: 999,
                      background: i === photoIndex ? 'var(--bone)' : 'rgba(252,247,235,0.55)',
                      transition: 'all 220ms ease',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: '20px 22px 8px' }}>
          {cat && (
            <span
              className="eyebrow inline-flex items-center gap-1.5"
              style={{ color: 'var(--ink-muted)' }}
            >
              {cat.emoji && <span aria-hidden>{cat.emoji}</span>}
              {cat.name}
            </span>
          )}
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <h2
              className="display"
              style={{
                fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              {drink.name}
            </h2>
            <span
              className="serif"
              style={{
                fontSize: 22,
                color: 'var(--terra)',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              {pkr(drink.price)}
            </span>
          </div>
          {drink.description && (
            <p
              className="mt-3"
              style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6 }}
            >
              {drink.description}
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-3"
          style={{
            padding: '16px 22px 22px',
            borderTop: '1px solid var(--line)',
            background: 'var(--bone)',
          }}
        >
          <div
            className="inline-flex items-center"
            style={{
              border: '1px solid var(--line-strong)',
              borderRadius: 999,
              opacity: sold || !canOrder ? 0.5 : 1,
            }}
          >
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={sold || !canOrder || qty <= 1}
              aria-label="Decrease quantity"
              className="inline-flex items-center justify-center"
              style={{ width: 38, height: 38 }}
            >
              <Minus size={14} />
            </button>
            <span
              className="serif"
              style={{ width: 28, textAlign: 'center', fontSize: 16 }}
              aria-live="polite"
            >
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              disabled={sold || !canOrder || qty >= 99}
              aria-label="Increase quantity"
              className="inline-flex items-center justify-center"
              style={{ width: 38, height: 38 }}
            >
              <Plus size={14} />
            </button>
          </div>

          {sold ? (
            <button disabled className="btn btn-outline" style={{ flex: 1, opacity: 0.6 }}>
              Sold out
            </button>
          ) : canOrder ? (
            <button
              onClick={() => {
                addToCart(drink, qty);
                closeDrinkModal();
                // Pop the cart drawer briefly so the user knows it landed.
                openCart();
              }}
              className="btn btn-terra"
              style={{ flex: 1 }}
            >
              <span>Add — {pkr(total)}</span>
              <span className="arrow">↗</span>
            </button>
          ) : (
            <button
              onClick={() => {
                closeDrinkModal();
                zone.openGate();
              }}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              <MapPin size={14} style={{ marginRight: 6 }} />
              Pick your area to order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
