'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Search, Plus, Minus, X, ShoppingBag, MapPin, Loader2, Check, Lock } from 'lucide-react';
import { pkr } from '@/lib/utils';
import type { Category, DrinkWithCategory } from '@/lib/utils';
import { SHOP, deliverySummary } from '@/lib/shop';
import { useZone } from '@/lib/zone-context';
import { Turnstile } from './Turnstile';

type CartLine = { id: string; name: string; price: number; cost: number; qty: number; photo: string | null };
type Step = 'cart' | 'details' | 'placed';

export default function MenuClient({
  initialDrinks,
  categories,
}: {
  initialDrinks: DrinkWithCategory[];
  categories: Category[];
}) {
  const [activeCat, setActiveCat] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const zone = useZone();
  const canOrder = zone.canOrder;

  const startingFrom = useMemo(
    () =>
      initialDrinks.length
        ? Math.min(...initialDrinks.map((d) => d.price))
        : 540,
    [initialDrinks]
  );

  const filtered = useMemo(() => {
    return initialDrinks.filter((d) => {
      if (activeCat !== 'all' && d.category_id !== activeCat) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [initialDrinks, activeCat, query]);

  const buckets = useMemo(() => {
    const m = new Map<string, { cat: Category | null; items: DrinkWithCategory[] }>();
    categories.forEach((c) => m.set(c.id, { cat: c, items: [] }));
    m.set('uncategorised', { cat: null, items: [] });
    filtered.forEach((d) => {
      const key = d.category_id ?? 'uncategorised';
      if (!m.has(key)) m.set(key, { cat: d.categories as any, items: [] });
      m.get(key)!.items.push(d);
    });
    return Array.from(m.values()).filter((b) => b.items.length > 0);
  }, [filtered, categories]);

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  function addToCart(d: DrinkWithCategory) {
    if (!d.in_stock) return;
    if (!canOrder) {
      zone.openGate();
      return;
    }
    setCart((c) => {
      const exists = c.find((l) => l.id === d.id);
      if (exists) return c.map((l) => (l.id === d.id ? { ...l, qty: l.qty + 1 } : l));
      // Note: cost is NOT carried client-side. The /api/orders route looks
      // up the canonical cost from menu_items.id server-side. See migration 006.
      return [
        ...c,
        { id: d.id, name: d.name, price: d.price, cost: 0, qty: 1, photo: d.photo },
      ];
    });
  }
  function changeQty(id: string, delta: number) {
    setCart((c) =>
      c
        .map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  }

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
            <span style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--terra)' }} />
            <span className="eyebrow">The full menu · updated weekly</span>
          </div>
          <h1
            className="display"
            style={{ fontSize: 'clamp(3rem, 7vw, 7rem)', maxWidth: 1100 }}
          >
            Pick a <span className="ital">drink,</span><br />
            we&apos;ll make it <span className="ital">slow</span>.
          </h1>
          <p
            className="mt-6"
            style={{ maxWidth: 540, color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.65 }}
          >
            Espresso classics, cold-brewed coffee, blended frappés and fresh lemonades. Delivering
            to{' '}
            <span style={{ color: 'var(--terra)' }}>{deliverySummary()}</span> — Bykea, inDrive or
            WhatsApp.
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
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-7 lg:px-10 py-3 flex items-center gap-5 flex-wrap">
          <label
            className="flex items-center gap-2 px-3 py-2 rounded-full"
            style={{ background: 'rgba(28,23,18,0.04)', minWidth: 220 }}
          >
            <Search size={14} style={{ color: 'var(--ink-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drinks…"
              className="bg-transparent outline-none text-sm flex-1"
              style={{ color: 'var(--ink)' }}
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear">
                <X size={14} style={{ color: 'var(--ink-muted)' }} />
              </button>
            )}
          </label>

          <div className="flex items-center gap-1 flex-wrap">
            <CatPill active={activeCat === 'all'} onClick={() => setActiveCat('all')}>
              All · {initialDrinks.length}
            </CatPill>
            {categories.map((c) => {
              const count = initialDrinks.filter((d) => d.category_id === c.id).length;
              if (count === 0) return null;
              return (
                <CatPill
                  key={c.id}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                >
                  {c.name}
                </CatPill>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="eyebrow">From</span>
            <span className="serif" style={{ fontSize: 16 }}>
              {pkr(startingFrom)}
            </span>
          </div>
        </div>
      </div>

      {/* ─── DRINKS ─────────────────────────────────────── */}
      <section
        className="grain"
        style={{ background: 'var(--paper)', paddingTop: 50, paddingBottom: 120 }}
      >
        <div className="relative z-[2] max-w-[1400px] mx-auto px-7 lg:px-10">
          {buckets.length === 0 && (
            <div
              className="text-center py-24"
              style={{ color: 'var(--ink-muted)', fontSize: 16 }}
            >
              No drinks match — try another search.
            </div>
          )}

          {buckets.map(({ cat, items }) => (
            <div key={cat?.id ?? 'uncat'} className="mb-16">
              <div
                className="flex items-baseline justify-between mb-7 pb-3"
                style={{ borderBottom: '1px solid var(--line-strong)' }}
              >
                <h2
                  className="display"
                  style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)' }}
                >
                  {cat?.name ?? 'More'}{' '}
                  {cat?.emoji && (
                    <span style={{ fontSize: '0.6em' }}>{cat.emoji}</span>
                  )}
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
                  <DrinkCard
                    key={d.id}
                    drink={d}
                    onAdd={() => addToCart(d)}
                    canOrder={canOrder}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FLOATING CART ───────────────────────────────── */}
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
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
          <span className="serif" style={{ fontSize: 16, letterSpacing: '-0.02em' }}>
            {pkr(subtotal)}
          </span>
          <span className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--terra)', fontSize: 12, fontWeight: 500 }}>
            Open <ShoppingBag size={12} />
          </span>
        </button>
      )}

      {cartOpen && (
        <CheckoutDrawer
          cart={cart}
          subtotal={subtotal}
          onClose={() => setCartOpen(false)}
          onChangeQty={changeQty}
        />
      )}
    </>
  );
}

/* ─────────────────────────── checkout drawer ─────────────────────────── */

function CheckoutDrawer({
  cart,
  subtotal,
  onClose,
  onChangeQty,
}: {
  cart: CartLine[];
  subtotal: number;
  onClose: () => void;
  onChangeQty: (id: string, delta: number) => void;
}) {
  const zone = useZone();
  const [step, setStep] = useState<Step>('cart');

  // form state. Delivery address is pre-tagged with the visitor's
  // already-picked area — we only need the street/house detail from them.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'pickup' | 'delivery'>(zone.canOrder ? 'delivery' : 'pickup');
  const [method, setMethod] = useState<string>(SHOP.delivery.methods[0].id);
  const [street, setStreet] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [cfToken, setCfToken] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{
    id: string;
    order_number: number;
    receiptUrl: string;
  } | null>(null);

  // Hard rule: delivery requires a picked area. If the visitor somehow got
  // here without one, we steer them back to the gate.
  const needsArea = type === 'delivery' && !zone.area;

  async function placeOrder() {
    setSubmitErr(null);
    if (!name.trim()) return setSubmitErr('Add your name');
    if (!phone.trim()) return setSubmitErr('Add your WhatsApp number');
    if (type === 'delivery') {
      if (!zone.area) return setSubmitErr('Pick a delivery area first');
      if (!street.trim()) return setSubmitErr('Add your street / house detail');
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer: { name, phone },
          type,
          delivery:
            type === 'delivery' && zone.area
              ? { method, area_id: zone.area.id, street }
              : undefined,
          notes,
          // Cloudflare Turnstile token. Server-side fail-open if Turnstile
          // isn't configured (no NEXT_PUBLIC_TURNSTILE_SITE_KEY → no widget,
          // no token, server skips verification).
          cf_token: cfToken,
          items: cart.map((l) => ({
            id: l.id, name: l.name, price: l.price, quantity: l.qty,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not place order');
      setPlaced(json);
      setStep('placed');
    } catch (e: any) {
      setSubmitErr(e?.message || 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  }

  function whatsAppUrlForCustomer() {
    if (!placed) return '#';
    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
    const lines = cart.map((l) => `• ${l.qty} × ${l.name} — ${pkr(l.price * l.qty)}`).join('%0A');
    const addressLine =
      type === 'delivery' && zone.area
        ? `${zone.area.cluster} · ${zone.area.label} — ${street}`
        : '';
    const body =
      `Hi BRUE 👋 — Order *#${placed.order_number}* for *${name}*` +
      `%0A%0A${lines}` +
      `%0A%0ATotal: ${pkr(subtotal)}` +
      `%0AType: ${type}` +
      (type === 'delivery'
        ? `%0AMethod: ${SHOP.delivery.methods.find((m) => m.id === method)?.label}` +
          `%0AAddress: ${encodeURIComponent(addressLine)}`
        : '') +
      `%0A%0AReceipt: ${placed.receiptUrl}`;
    return number ? `https://wa.me/${number}?text=${body}` : placed.receiptUrl;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(28,23,18,0.5)' }} />
      <div
        className="relative h-full w-full max-w-md flex flex-col"
        style={{ background: 'var(--bone)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <h3 className="display" style={{ fontSize: 32 }}>
            {step === 'cart' && (<>Your <span className="ital">cart</span></>)}
            {step === 'details' && (<>Almost <span className="ital">there</span></>)}
            {step === 'placed' && (<>Order <span className="ital">in</span></>)}
          </h3>
          <button onClick={onClose} className="p-2" aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        {/* ─── STEP: CART ─────────────────────────────── */}
        {step === 'cart' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {cart.length === 0 && (
                <p style={{ color: 'var(--ink-muted)' }}>Empty for now.</p>
              )}
              {cart.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: '1px solid var(--line)' }}
                >
                  <div
                    className="relative overflow-hidden shrink-0"
                    style={{
                      width: 56, height: 56, borderRadius: 10, background: 'var(--cream)',
                    }}
                  >
                    {l.photo && (
                      <Image src={l.photo} alt={l.name} fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="serif" style={{ fontSize: 17 }}>{l.name}</div>
                    <div style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
                      {pkr(l.price)} each
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{
                      border: '1px solid var(--line-strong)',
                      borderRadius: 999,
                      padding: '4px 6px',
                    }}
                  >
                    <button onClick={() => onChangeQty(l.id, -1)} className="p-1" aria-label="Less">
                      <Minus size={12} />
                    </button>
                    <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>{l.qty}</span>
                    <button onClick={() => onChangeQty(l.id, 1)} className="p-1" aria-label="More">
                      <Plus size={12} />
                    </button>
                  </div>
                  <span
                    className="serif"
                    style={{ fontSize: 15, width: 80, textAlign: 'right' }}
                  >
                    {pkr(l.price * l.qty)}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="px-6 py-5 space-y-4"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Subtotal</span>
                <span className="serif" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>
                  {pkr(subtotal)}
                </span>
              </div>
              <button
                disabled={cart.length === 0}
                onClick={() => setStep('details')}
                className="btn btn-terra w-full"
                style={{ opacity: cart.length === 0 ? 0.5 : 1 }}
              >
                Continue <span className="arrow">→</span>
              </button>
              <p
                className="text-center"
                style={{ color: 'var(--ink-muted)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}
              >
                Pickup or delivery on the next step
              </p>
            </div>
          </>
        )}

        {/* ─── STEP: DETAILS ──────────────────────────── */}
        {step === 'details' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="field-group">
                <label htmlFor="ck-name">Name</label>
                <input
                  id="ck-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="So we know who's at the door"
                />
              </div>
              <div className="field-group">
                <label htmlFor="ck-phone">WhatsApp number</label>
                <input
                  id="ck-phone"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03xx xxxxxxx"
                  inputMode="tel"
                />
              </div>

              <div className="field-group">
                <label>Pickup or delivery?</label>
                <div className="flex gap-2">
                  <SegBtn active={type === 'pickup'} onClick={() => setType('pickup')}>
                    🚶 Pickup
                  </SegBtn>
                  <SegBtn active={type === 'delivery'} onClick={() => setType('delivery')}>
                    🛵 Delivery
                  </SegBtn>
                </div>
              </div>

              {type === 'delivery' && (
                <>
                  {/* Area pill — immutable here; change via the gate. */}
                  <div className="field-group">
                    <label>Your area</label>
                    {zone.area ? (
                      <div
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{
                          background: 'rgba(107,122,83,0.1)',
                          border: '1px solid rgba(107,122,83,0.25)',
                        }}
                      >
                        <span
                          className="inline-flex items-center justify-center"
                          style={{
                            width: 30, height: 30, borderRadius: 999,
                            background: 'rgba(107,122,83,0.25)', color: 'var(--sage)',
                          }}
                        >
                          <Check size={14} />
                        </span>
                        <div className="flex-1">
                          <div className="serif" style={{ fontSize: 16 }}>
                            {zone.area.label}
                          </div>
                          <div style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
                            {zone.area.cluster} · covered
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={zone.openGate}
                          className="text-[11px] underline"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={zone.openGate}
                        className="rounded-xl px-4 py-3 w-full text-left"
                        style={{
                          background: 'rgba(196,69,38,0.08)',
                          border: '1px solid rgba(196,69,38,0.25)',
                          color: 'var(--terra-deep)',
                          fontSize: 13,
                        }}
                      >
                        <strong>Pick your area →</strong> we only deliver inside FB Area +
                        North Nazimabad blocks.
                      </button>
                    )}
                  </div>

                  <div className="field-group">
                    <label>Delivery method</label>
                    <div className="grid gap-2">
                      {SHOP.delivery.methods.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                          style={{
                            border: '1px solid',
                            borderColor: method === m.id ? 'var(--ink)' : 'var(--line)',
                            background: method === m.id ? 'rgba(28,23,18,0.03)' : 'transparent',
                          }}
                        >
                          <input
                            type="radio"
                            name="method"
                            value={m.id}
                            checked={method === m.id}
                            onChange={() => setMethod(m.id)}
                            className="sr-only"
                          />
                          <span
                            className="inline-block"
                            style={{
                              width: 14, height: 14, borderRadius: 999,
                              border: '1px solid var(--line-strong)',
                              background: method === m.id ? 'var(--terra)' : 'transparent',
                              boxShadow: method === m.id ? 'inset 0 0 0 3px var(--bone)' : 'none',
                            }}
                          />
                          <span className="flex-1">
                            <span className="serif block" style={{ fontSize: 16 }}>{m.label}</span>
                            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{m.note}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="field-group">
                    <label htmlFor="ck-street">Street / house detail</label>
                    <textarea
                      id="ck-street"
                      className="textarea"
                      rows={2}
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="House #, street, landmark — so the rider can find you"
                    />
                    <p
                      style={{ color: 'var(--ink-muted)', fontSize: 11, marginTop: 6 }}
                    >
                      Area is locked to <strong>{zone.area?.label ?? '—'}</strong>. Change it from
                      the pill above if you moved.
                    </p>
                  </div>
                </>
              )}

              <div className="field-group">
                <label htmlFor="ck-notes">Notes (optional)</label>
                <textarea
                  id="ck-notes"
                  className="textarea"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="No sugar? Extra ice? Tell us."
                />
              </div>

              {submitErr && (
                <div
                  className="px-3 py-2.5 rounded-lg text-sm"
                  style={{
                    background: 'rgba(196,69,38,0.08)',
                    color: 'var(--terra-deep)',
                    border: '1px solid rgba(196,69,38,0.2)',
                  }}
                >
                  {submitErr}
                </div>
              )}
            </div>

            <div
              className="px-6 py-5 space-y-3"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Total</span>
                <span className="serif" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>
                  {pkr(subtotal)}
                </span>
              </div>

              {/* Invisible Turnstile widget — only renders if NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
                  Cloudflare runs the challenge silently; user only sees a checkbox when scored as bot. */}
              <Turnstile onToken={setCfToken} />

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('cart')}
                  className="btn btn-outline"
                  style={{ flex: '0 0 auto' }}
                >
                  ← Cart
                </button>
                <button
                  onClick={placeOrder}
                  disabled={submitting || needsArea}
                  className="btn btn-terra"
                  style={{ flex: 1, opacity: submitting || needsArea ? 0.6 : 1 }}
                >
                  {submitting
                    ? (<><Loader2 size={14} className="animate-spin" /> Placing…</>)
                    : (<>Place order <span className="arrow">→</span></>)}
                </button>
              </div>
              <p
                className="text-center"
                style={{ color: 'var(--ink-muted)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}
              >
                Cash · JazzCash · Easypaisa · NayaPay
              </p>
            </div>
          </>
        )}

        {/* ─── STEP: PLACED ───────────────────────────── */}
        {step === 'placed' && placed && (
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-5 text-center">
            <div
              className="mx-auto inline-flex items-center justify-center"
              style={{
                width: 64, height: 64, borderRadius: 999,
                background: 'rgba(107,122,83,0.16)', color: 'var(--sage)',
              }}
            >
              <Check size={28} />
            </div>
            <h4 className="display" style={{ fontSize: 38 }}>
              Order #{placed.order_number} <span className="ital">in</span>.
            </h4>
            <p style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}>
              We've saved your order and texted the bar. Tap WhatsApp below — that confirms it
              with us instantly and you'll get a status update when we accept it.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={whatsAppUrlForCustomer()}
                target="_blank"
                rel="noreferrer"
                className="btn btn-terra w-full"
              >
                Confirm on WhatsApp <span className="arrow">→</span>
              </a>
              <a
                href={placed.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline w-full"
              >
                View / print receipt
              </a>
              <button onClick={onClose} className="btn btn-ghost w-full">
                Keep browsing
              </button>
            </div>
            <p
              className="script"
              style={{ color: 'var(--terra)', fontSize: 22, transform: 'rotate(-2deg)' }}
            >
              thanks ✿
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function CatPill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
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

function SegBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 px-4 py-2.5 rounded-xl transition-colors text-[14px]"
      style={{
        background: active ? 'var(--ink)' : 'transparent',
        color: active ? 'var(--bone)' : 'var(--ink)',
        border: `1px solid ${active ? 'var(--ink)' : 'var(--line-strong)'}`,
      }}
    >
      {children}
    </button>
  );
}

function Stat({ num, label, italic }: {
  num: number | string; label: string; italic?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="serif"
        style={{
          fontSize: 26, lineHeight: 1, letterSpacing: '-0.02em',
          fontStyle: italic ? 'italic' : 'normal',
          color: italic ? 'var(--terra)' : 'var(--ink)',
        }}
      >
        {num}
      </span>
      <span
        style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'var(--ink-muted)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function DrinkCard({ drink, onAdd, canOrder }: {
  drink: DrinkWithCategory; onAdd: () => void; canOrder: boolean;
}) {
  const sold = !drink.in_stock;
  const photo = drink.photo || '/Brue_DP_Orange.png';
  return (
    <div id={drink.id} className="group" style={{ opacity: sold ? 0.6 : 1 }}>
      <div
        className="relative overflow-hidden grain"
        style={{
          aspectRatio: '1 / 1', borderRadius: 14, background: 'var(--cream)',
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
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              background: 'var(--ink)', color: 'var(--bone)',
              padding: '5px 10px', borderRadius: 999, fontWeight: 500,
            }}
          >
            Sold out
          </span>
        )}
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

      <button
        disabled={sold}
        onClick={onAdd}
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium"
        style={{
          color: sold
            ? 'var(--ink-muted)'
            : canOrder
            ? 'var(--ink)'
            : 'var(--ink-muted)',
          letterSpacing: '0.04em',
          cursor: sold ? 'not-allowed' : 'pointer',
        }}
      >
        {sold ? (
          '— sold out —'
        ) : canOrder ? (
          <>Add to cart <Plus size={12} /></>
        ) : (
          <>Pick your area <Lock size={11} /></>
        )}
      </button>
    </div>
  );
}

/* ─── Browse-mode banner (shown when visitor hasn't picked a covered area) ─── */
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
              Browse mode — your area isn't on our delivery list yet. Pickup at the bar is open
              to everyone.
            </>
          ) : (
            <>Pick your delivery area to unlock ordering — FB Area + North Nazimabad.</>
          )}
        </span>
        <button
          onClick={onRecheck}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full"
          style={{
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--ink)',
            background: 'var(--bone)',
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
