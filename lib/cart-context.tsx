'use client';

// ─────────────────────────────────────────────────────────────
// Cart context — global cart state shared across every public page.
// Lives at (public)/layout.tsx via <CartProvider>. Components anywhere
// underneath can call useCart() to read the cart, open a drink in the
// detail modal, or open the checkout drawer.
//
// Persistence:
//  - cart lines persist to localStorage so a refresh doesn't lose the cart
//  - openDrink + cartOpen are transient UI state (NOT persisted)
//
// Why this isn't just useState in MenuClient:
//   the home page now also has DrinkCards (specials / desserts / new
//   recipes). Adding from there has to put items in the same cart
//   that /menu reads. Local state can't span page navigations.
// ─────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DrinkWithCategory } from '@/lib/utils';

export type CartLine = {
  id: string;
  name: string;
  price: number;
  qty: number;
  photo: string | null;
};

type CartContextValue = {
  // cart state
  cart: CartLine[];
  cartCount: number;
  subtotal: number;
  addToCart: (drink: DrinkWithCategory, qty?: number) => void;
  changeQty: (id: string, delta: number) => void;
  removeLine: (id: string) => void;
  clearCart: () => void;

  // modal — drink detail view (carousel + qty + add)
  openDrink: DrinkWithCategory | null;
  openDrinkModal: (drink: DrinkWithCategory) => void;
  closeDrinkModal: () => void;

  // checkout drawer
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'brue.cart.v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [openDrink, setOpenDrink] = useState<DrinkWithCategory | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount. We delay setting `hydrated` until
  // after the read so SSR + first client render match (avoids flash of an
  // empty cart followed by a populated one).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCart(
            parsed
              .filter((l) => l && typeof l.id === 'string' && typeof l.qty === 'number')
              .map((l) => ({
                id: String(l.id),
                name: String(l.name ?? ''),
                price: Number(l.price) || 0,
                qty: Math.max(1, Math.min(99, Math.round(Number(l.qty) || 1))),
                photo: l.photo ?? null,
              }))
          );
        }
      }
    } catch {
      /* corrupted localStorage — ignore, start empty */
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist on every cart change (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* quota exceeded / private mode — silently drop */
    }
  }, [cart, hydrated]);

  const addToCart = useCallback((drink: DrinkWithCategory, addQty = 1) => {
    if (!drink.in_stock) return;
    const qty = Math.max(1, Math.min(99, Math.round(addQty)));
    setCart((c) => {
      const exists = c.find((l) => l.id === drink.id);
      if (exists) {
        return c.map((l) =>
          l.id === drink.id ? { ...l, qty: Math.min(99, l.qty + qty) } : l
        );
      }
      return [
        ...c,
        { id: drink.id, name: drink.name, price: drink.price, qty, photo: drink.photo },
      ];
    });
  }, []);

  const changeQty = useCallback((id: string, delta: number) => {
    setCart((c) =>
      c
        .map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setCart((c) => c.filter((l) => l.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const openDrinkModal = useCallback((drink: DrinkWithCategory) => {
    setOpenDrink(drink);
  }, []);
  const closeDrinkModal = useCallback(() => setOpenDrink(null), []);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.price * l.qty, 0),
    [cart]
  );

  const value: CartContextValue = {
    cart,
    cartCount,
    subtotal,
    addToCart,
    changeQty,
    removeLine,
    clearCart,
    openDrink,
    openDrinkModal,
    closeDrinkModal,
    cartOpen,
    openCart,
    closeCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart() must be used inside <CartProvider>');
  }
  return ctx;
}
