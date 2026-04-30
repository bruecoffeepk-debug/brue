'use client';

// ─────────────────────────────────────────────────────────────
// Mounts the global cart UI on every public page:
//   - DrinkDetailModal — opened from any DrinkCard
//   - CheckoutDrawer    — opened by the floating pill or any "open cart" call
//   - Floating cart pill — sticky bottom-center, only visible when cart > 0
//
// Lives at (public)/layout.tsx so it works on /home, /menu, /find-us, etc.
// All three read from cart-context.
// ─────────────────────────────────────────────────────────────

import { ShoppingBag } from 'lucide-react';
import { pkr } from '@/lib/utils';
import { useCart } from '@/lib/cart-context';
import DrinkDetailModal from './DrinkDetailModal';
import CheckoutDrawer from './CheckoutDrawer';

export default function PublicShell() {
  const { cartCount, subtotal, cartOpen, openCart } = useCart();

  return (
    <>
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={openCart}
          className="fixed z-40 inline-flex items-center gap-3 rounded-full pl-3 pr-4 py-2"
          style={{
            left: '50%',
            bottom: 28,
            transform: 'translateX(-50%)',
            background: 'var(--ink)',
            color: 'var(--bone)',
            boxShadow: '0 16px 40px -12px rgba(28,23,18,0.5)',
          }}
        >
          <span
            className="serif italic flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--terra)',
              fontSize: 18,
            }}
          >
            {cartCount}
          </span>
          <span style={{ fontSize: 13, letterSpacing: '0.04em' }}>Your cart</span>
          <span
            className="serif"
            style={{ fontSize: 16, letterSpacing: '-0.02em' }}
          >
            {pkr(subtotal)}
          </span>
          <span
            className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--terra)', fontSize: 12, fontWeight: 500 }}
          >
            Open <ShoppingBag size={12} />
          </span>
        </button>
      )}

      <DrinkDetailModal />
      <CheckoutDrawer />
    </>
  );
}
