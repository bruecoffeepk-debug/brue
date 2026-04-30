'use client';

// ─────────────────────────────────────────────────────────────
// Checkout drawer — slides in from the right, three-step flow:
//   1. cart    — review lines, change qty
//   2. details — name / phone / pickup-or-delivery / promo / area
//   3. placed  — success + WhatsApp + receipt links
//
// Mounted ONCE at the public layout level (via PublicShell), shows
// when cart-context's `cartOpen` is true. State lives entirely
// inside this component except cart lines (from cart context).
// ─────────────────────────────────────────────────────────────

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Loader2, Minus, Plus, X } from 'lucide-react';
import { pkr } from '@/lib/utils';
import { SHOP, applyPromo } from '@/lib/shop';
import { useCart } from '@/lib/cart-context';
import { useZone } from '@/lib/zone-context';
import { isOpenNow, statusLabel } from '@/lib/hours';
import { Turnstile } from './Turnstile';

/** Re-evaluates `isOpenNow()` every 30s so a checkout drawer left open
 *  across the closing-time boundary refuses to submit. */
function useShopOpen() {
  const [open, setOpen] = useState<boolean>(() => isOpenNow());
  const [label, setLabel] = useState(() => statusLabel());
  useEffect(() => {
    const tick = () => {
      setOpen(isOpenNow());
      setLabel(statusLabel());
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return { open, label };
}

type Step = 'cart' | 'details' | 'placed';

export default function CheckoutDrawer() {
  const { cart, cartOpen, closeCart, changeQty, subtotal, clearCart } = useCart();
  const zone = useZone();
  const shop = useShopOpen();
  const [step, setStep] = useState<Step>('cart');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'pickup' | 'delivery'>(
    zone.canOrder ? 'delivery' : 'pickup'
  );
  const [method, setMethod] = useState<string>(SHOP.delivery.methods[0].id);
  const [street, setStreet] = useState('');
  const [notes, setNotes] = useState('');
  const [promoInput, setPromoInput] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [cfToken, setCfToken] = useState<string | null>(null);

  const promoPreview = useMemo(
    () => applyPromo(subtotal, promoInput, 'web'),
    [subtotal, promoInput]
  );
  const total = Math.max(0, subtotal - promoPreview.discount);
  const [placed, setPlaced] = useState<{
    id: string;
    order_number: number;
    receiptUrl: string;
  } | null>(null);

  const needsArea = type === 'delivery' && !zone.area;

  // If the drawer is closed, render nothing — don't keep the form mounted.
  if (!cartOpen) return null;

  async function placeOrder() {
    setSubmitErr(null);
    if (!shop.open) {
      return setSubmitErr(
        `We're closed right now. ${shop.label.detail.replace(/\.$/, '')}.`
      );
    }
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
          promo_code: promoInput.trim() || null,
          cf_token: cfToken,
          items: cart.map((l) => ({
            id: l.id,
            name: l.name,
            price: l.price,
            quantity: l.qty,
          })),
        }),
      });

      const raw = await res.text();
      let json: any = null;
      if (raw) {
        try {
          json = JSON.parse(raw);
        } catch {
          /* not JSON */
        }
      }

      if (!res.ok) {
        const fallback =
          res.status === 500
            ? 'Server hiccup — please try again, or WhatsApp us if it keeps failing.'
            : res.status === 429
            ? 'Slow down — too many orders from this device. Try again in a moment.'
            : `Could not place order (HTTP ${res.status})`;
        throw new Error(json?.error || fallback);
      }
      if (!json || !json.id) {
        throw new Error(
          'Order placed but no confirmation received — please WhatsApp us to verify.'
        );
      }
      setPlaced(json);
      setStep('placed');
      // Clear the cart now that we have a confirmed order — staff have it
      // in the DB, customer is on the success step. Keeps the cart empty
      // for the next session.
      clearCart();
    } catch (e: any) {
      const msg =
        e?.name === 'TypeError'
          ? 'No connection — check your internet and try again.'
          : e?.message || 'Could not place order';
      setSubmitErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function whatsAppUrlForCustomer() {
    if (!placed) return '#';
    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
    const lines = cart
      .map((l) => `• ${l.qty} × ${l.name} — ${pkr(l.price * l.qty)}`)
      .join('%0A');
    const addressLine =
      type === 'delivery' && zone.area
        ? `${zone.area.cluster} · ${zone.area.label} — ${street}`
        : '';
    const promoLine = promoPreview.promo
      ? `%0A${encodeURIComponent(promoPreview.promo.label)}: − ${pkr(promoPreview.discount)}`
      : '';
    const body =
      `Hi BRUE 👋 — Order *#${placed.order_number}* for *${name}*` +
      `%0A%0A${lines}` +
      `%0A%0ASubtotal: ${pkr(subtotal)}` +
      promoLine +
      `%0ATotal: ${pkr(total)}` +
      `%0AType: ${type}` +
      (type === 'delivery'
        ? `%0AMethod: ${SHOP.delivery.methods.find((m) => m.id === method)?.label}` +
          `%0AAddress: ${encodeURIComponent(addressLine)}`
        : '') +
      `%0A%0AReceipt: ${placed.receiptUrl}`;
    return number ? `https://wa.me/${number}?text=${body}` : placed.receiptUrl;
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex justify-end"
      onClick={closeCart}
    >
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
            {step === 'cart' && (
              <>
                Your <span className="ital">cart</span>
              </>
            )}
            {step === 'details' && (
              <>
                Almost <span className="ital">there</span>
              </>
            )}
            {step === 'placed' && (
              <>
                Order <span className="ital">in</span>
              </>
            )}
          </h3>
          <button onClick={closeCart} className="p-2" aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

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
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      background: 'var(--cream)',
                    }}
                  >
                    {l.photo && (
                      <Image
                        src={l.photo}
                        alt={l.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="serif" style={{ fontSize: 17 }}>
                      {l.name}
                    </div>
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
                    <button
                      onClick={() => changeQty(l.id, -1)}
                      className="p-1"
                      aria-label="Less"
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>
                      {l.qty}
                    </span>
                    <button
                      onClick={() => changeQty(l.id, 1)}
                      className="p-1"
                      aria-label="More"
                    >
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
                <span
                  className="serif"
                  style={{ fontSize: 28, letterSpacing: '-0.02em' }}
                >
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
                style={{
                  color: 'var(--ink-muted)',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Pickup or delivery on the next step
              </p>
            </div>
          </>
        )}

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
                            width: 30,
                            height: 30,
                            borderRadius: 999,
                            background: 'rgba(107,122,83,0.25)',
                            color: 'var(--sage)',
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
                            background:
                              method === m.id ? 'rgba(28,23,18,0.03)' : 'transparent',
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
                              width: 14,
                              height: 14,
                              borderRadius: 999,
                              border: '1px solid var(--line-strong)',
                              background:
                                method === m.id ? 'var(--terra)' : 'transparent',
                              boxShadow:
                                method === m.id ? 'inset 0 0 0 3px var(--bone)' : 'none',
                            }}
                          />
                          <span className="flex-1">
                            <span className="serif block" style={{ fontSize: 16 }}>
                              {m.label}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                              {m.note}
                            </span>
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
                    <p style={{ color: 'var(--ink-muted)', fontSize: 11, marginTop: 6 }}>
                      Area is locked to{' '}
                      <strong>{zone.area?.label ?? '—'}</strong>. Change it from the pill
                      above if you moved.
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
              <div>
                <label
                  htmlFor="ck-promo"
                  className="eyebrow"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    color: 'var(--ink-muted)',
                  }}
                >
                  Promo code (optional)
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    id="ck-promo"
                    className="field"
                    style={{
                      flex: 1,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                    placeholder="e.g. BRUE15"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                {promoInput.trim() && (
                  <p
                    className="mt-1.5"
                    style={{
                      fontSize: 12,
                      color: promoPreview.promo ? 'var(--sage)' : 'var(--ink-muted)',
                    }}
                  >
                    {promoPreview.promo
                      ? `✓ ${promoPreview.promo.label} — ${pkr(promoPreview.discount)} off`
                      : 'Code not recognised'}
                  </p>
                )}
              </div>

              <div
                className="space-y-1 pt-2"
                style={{ borderTop: '1px dashed var(--line)' }}
              >
                <div
                  className="flex items-baseline justify-between"
                  style={{ fontSize: 13 }}
                >
                  <span style={{ color: 'var(--ink-muted)' }}>Subtotal</span>
                  <span className="serif" style={{ color: 'var(--ink-soft)' }}>
                    {pkr(subtotal)}
                  </span>
                </div>
                {promoPreview.discount > 0 && (
                  <div
                    className="flex items-baseline justify-between"
                    style={{ fontSize: 13 }}
                  >
                    <span style={{ color: 'var(--sage)' }}>
                      {promoPreview.promo?.label}
                    </span>
                    <span className="serif" style={{ color: 'var(--sage)' }}>
                      − {pkr(promoPreview.discount)}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-2">
                  <span className="eyebrow">Total</span>
                  <span
                    className="serif"
                    style={{ fontSize: 28, letterSpacing: '-0.02em' }}
                  >
                    {pkr(total)}
                  </span>
                </div>
              </div>

              <Turnstile onToken={setCfToken} />

              {!shop.open && (
                <div
                  className="rounded-xl p-3 flex items-start gap-2.5"
                  style={{
                    background: 'rgba(28,23,18,0.06)',
                    border: '1px solid var(--line-strong)',
                    color: 'var(--ink-soft)',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <Clock size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--terra-deep)' }} />
                  <div>
                    <strong style={{ color: 'var(--ink)' }}>We&apos;re closed right now.</strong>{' '}
                    {shop.label.detail} Your cart will keep until we open.
                  </div>
                </div>
              )}

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
                  disabled={submitting || needsArea || !shop.open}
                  className="btn btn-terra"
                  style={{
                    flex: 1,
                    opacity: submitting || needsArea || !shop.open ? 0.6 : 1,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Placing…
                    </>
                  ) : !shop.open ? (
                    <>
                      <Clock size={14} /> Closed · {shop.label.short.replace(/^Closed · /, '')}
                    </>
                  ) : (
                    <>
                      Place order <span className="arrow">→</span>
                    </>
                  )}
                </button>
              </div>
              <p
                className="text-center"
                style={{
                  color: 'var(--ink-muted)',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Cash · JazzCash · Easypaisa · NayaPay
              </p>
            </div>
          </>
        )}

        {step === 'placed' && placed && (
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-5 text-center">
            <div
              className="mx-auto inline-flex items-center justify-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: 'rgba(107,122,83,0.16)',
                color: 'var(--sage)',
              }}
            >
              <Check size={28} />
            </div>
            <h4 className="display" style={{ fontSize: 38 }}>
              Order #{placed.order_number} <span className="ital">in</span>.
            </h4>
            <p style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}>
              We&apos;ve saved your order and texted the bar. Tap WhatsApp below — that
              confirms it with us instantly and you&apos;ll get a status update when we
              accept it.
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
              <button
                onClick={() => {
                  closeCart();
                  // Reset for the next order session
                  setTimeout(() => {
                    setStep('cart');
                    setPlaced(null);
                    setPromoInput('');
                    setNotes('');
                    setStreet('');
                    setSubmitErr(null);
                  }, 300);
                }}
                className="btn btn-ghost w-full"
              >
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

function SegBtn({
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
