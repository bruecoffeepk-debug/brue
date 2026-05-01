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
import { ArrowRight, Check, Clock, Copy, Crosshair, Loader2, Minus, Plus, X } from 'lucide-react';
import { pkr } from '@/lib/utils';
import { SHOP, PAYMENT_OPTIONS, applyPromo, findPaymentOption, type PaymentOption } from '@/lib/shop';
import { useCart } from '@/lib/cart-context';
import { useZone } from '@/lib/zone-context';
import { isOpenNow, statusLabel } from '@/lib/hours';
import { autoFillAddress, validatePkPhone, formatPkPhone } from '@/lib/geo-fill';
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

type Step = 'cart' | 'details' | 'payment' | 'placed';

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
  // Address split into 3 explicit components so it matches what the gate
  // captures + so geolocation auto-fill can populate each cleanly.
  // - House no: typed by visitor (rider needs the door)
  // - Block no: pre-filled from zone.area.label, editable
  // - Area name: pre-filled from zone.area.cluster, editable
  const [houseNo, setHouseNo] = useState('');
  const [blockNo, setBlockNo] = useState('');
  const [areaName, setAreaName] = useState('');
  const [notes, setNotes] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [cfToken, setCfToken] = useState<string | null>(null);

  // Pre-fill block/area from the zone the visitor picked at the gate.
  // Re-runs if they change the zone — so a "Change" button in the address
  // section repopulates correctly.
  useEffect(() => {
    if (zone.area) {
      setBlockNo((curr) => curr || zone.area!.label);
      setAreaName((curr) => curr || zone.area!.cluster);
    }
  }, [zone.area]);

  async function detectAddress() {
    setLocating(true);
    setLocMsg(null);
    try {
      const res = await autoFillAddress();
      if (res.parts.houseNo) setHouseNo(res.parts.houseNo);
      else if (res.parts.road) setHouseNo((curr) => curr || res.parts.road);
      if (res.parts.blockNo) setBlockNo(res.parts.blockNo);
      if (res.parts.areaName) setAreaName(res.parts.areaName);
      // Validate the auto-filled area is on our covered list
      if (res.matchedArea) {
        setLocMsg({
          tone: 'ok',
          text: `Filled from your location · ${res.matchedArea.cluster} · ${res.matchedArea.label}`,
        });
      } else {
        setLocMsg({
          tone: 'err',
          text: 'Filled from location, but your area isn\'t on our delivery list. Edit the fields if needed.',
        });
      }
    } catch (e: any) {
      setLocMsg({ tone: 'err', text: e?.message || 'Location unavailable' });
    } finally {
      setLocating(false);
    }
  }

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
    const normalisedPhone = validatePkPhone(phone);
    if (!normalisedPhone) {
      return setSubmitErr('Phone must be a valid PK mobile (e.g. 0300 1234567)');
    }
    if (type === 'delivery') {
      if (!zone.area) return setSubmitErr('Pick a delivery area first');
      if (!houseNo.trim()) return setSubmitErr('Add your house no.');
      if (!blockNo.trim()) return setSubmitErr('Add your block no.');
      if (!areaName.trim()) return setSubmitErr('Add your area name');
    }
    if (!paymentId) return setSubmitErr('Pick a payment method');

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer: { name, phone: normalisedPhone },
          type,
          delivery:
            type === 'delivery' && zone.area
              ? {
                  method,
                  area_id: zone.area.id,
                  house_no: houseNo.trim(),
                  block_no: blockNo.trim(),
                  area_name: areaName.trim(),
                  // Composed string kept for back-compat with anything still
                  // reading `street` server-side.
                  street: `${houseNo.trim()}, ${blockNo.trim()}, ${areaName.trim()}`,
                }
              : undefined,
          notes,
          promo_code: promoInput.trim() || null,
          payment_method: paymentId,
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
      type === 'delivery'
        ? `${houseNo}, ${blockNo}, ${areaName}`
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
                Your <span className="ital">details</span>
              </>
            )}
            {step === 'payment' && (
              <>
                <span className="ital">Pay</span> & confirm
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
                  placeholder="0300 1234567"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={20}
                />
                {phone.trim() && (
                  <p
                    className="mt-1.5"
                    style={{
                      fontSize: 11,
                      color: validatePkPhone(phone) ? 'var(--sage)' : 'var(--ink-muted)',
                    }}
                  >
                    {validatePkPhone(phone)
                      ? `✓ ${formatPkPhone(validatePkPhone(phone)!)}`
                      : 'Enter a PK mobile (11 digits, e.g. 0300 1234567)'}
                  </p>
                )}
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
                    <label>Delivery address</label>

                    <button
                      type="button"
                      onClick={detectAddress}
                      disabled={locating}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full mb-3"
                      style={{
                        background: 'var(--ink)',
                        color: 'var(--bone)',
                        fontSize: 11,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        fontWeight: 500,
                        opacity: locating ? 0.6 : 1,
                      }}
                    >
                      {locating ? <Loader2 size={11} className="animate-spin" /> : <Crosshair size={11} />}
                      {locating ? 'Locating…' : 'Use my location'}
                    </button>

                    <div className="space-y-2">
                      <input
                        className="input"
                        placeholder="House no. (e.g. House 12-C)"
                        value={houseNo}
                        onChange={(e) => setHouseNo(e.target.value.slice(0, 100))}
                        autoComplete="address-line1"
                        aria-label="House number"
                      />
                      <input
                        className="input"
                        placeholder="Block no. (e.g. Block 7)"
                        value={blockNo}
                        onChange={(e) => setBlockNo(e.target.value.slice(0, 60))}
                        autoComplete="address-line2"
                        aria-label="Block number"
                      />
                      <input
                        className="input"
                        placeholder="Area name (e.g. FB Area)"
                        value={areaName}
                        onChange={(e) => setAreaName(e.target.value.slice(0, 80))}
                        autoComplete="address-level2"
                        aria-label="Area name"
                      />
                    </div>
                    {locMsg && (
                      <p
                        className="mt-2"
                        style={{
                          fontSize: 12,
                          color: locMsg.tone === 'ok' ? 'var(--sage)' : 'var(--terra-deep)',
                        }}
                      >
                        {locMsg.text}
                      </p>
                    )}
                    <p style={{ color: 'var(--ink-muted)', fontSize: 11, marginTop: 8 }}>
                      Block + area are pre-filled from{' '}
                      <strong>{zone.area?.label ?? '—'}</strong>. Edit if you moved or
                      change the zone via the pill above.
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
                  onClick={() => {
                    // Validate details before going to the payment step
                    setSubmitErr(null);
                    if (!name.trim()) return setSubmitErr('Add your name');
                    if (!phone.trim()) return setSubmitErr('Add your WhatsApp number');
                    if (type === 'delivery') {
                      if (!zone.area) return setSubmitErr('Pick a delivery area first');
                      if (!street.trim()) return setSubmitErr('Add your street / house detail');
                    }
                    setStep('payment');
                  }}
                  disabled={needsArea || !shop.open}
                  className="btn btn-terra"
                  style={{
                    flex: 1,
                    opacity: needsArea || !shop.open ? 0.6 : 1,
                  }}
                >
                  {!shop.open ? (
                    <>
                      <Clock size={14} /> Closed · {shop.label.short.replace(/^Closed · /, '')}
                    </>
                  ) : (
                    <>
                      Continue to payment <span className="arrow">→</span>
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
                Online payment only · no COD
              </p>
            </div>
          </>
        )}

        {/* ─── STEP: PAYMENT ────────────────────────────── */}
        {step === 'payment' && (
          <PaymentStep
            total={total}
            paymentId={paymentId}
            setPaymentId={setPaymentId}
            onBack={() => setStep('details')}
            onConfirmPaid={placeOrder}
            submitting={submitting}
            submitErr={submitErr}
            shopOpen={shop.open}
            shopShort={shop.label.short}
            cfToken={cfToken}
            setCfToken={setCfToken}
          />
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
              We&apos;ve received your order and we&apos;re verifying your payment now.
              Tap WhatsApp below to confirm with the bar — you&apos;ll get a status
              update once we&apos;ve accepted it.
            </p>
            {paymentId && findPaymentOption(paymentId) && (
              <div
                className="rounded-xl px-3 py-2 inline-flex items-center gap-2 mx-auto"
                style={{
                  background: 'rgba(107,122,83,0.12)',
                  color: 'var(--sage)',
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                <Check size={12} />
                Paid via {findPaymentOption(paymentId)?.label}
              </div>
            )}
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
                    setHouseNo('');
                    setBlockNo('');
                    setAreaName('');
                    setSubmitErr(null);
                    setPaymentId(null);
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

/* ─────────────────────── payment step ─────────────────────── */

function PaymentStep({
  total,
  paymentId,
  setPaymentId,
  onBack,
  onConfirmPaid,
  submitting,
  submitErr,
  shopOpen,
  shopShort,
  cfToken,
  setCfToken,
}: {
  total: number;
  paymentId: string | null;
  setPaymentId: (id: string) => void;
  onBack: () => void;
  onConfirmPaid: () => void;
  submitting: boolean;
  submitErr: string | null;
  shopOpen: boolean;
  shopShort: string;
  cfToken: string | null;
  setCfToken: (t: string | null) => void;
}) {
  const selected = paymentId ? findPaymentOption(paymentId) : null;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Total banner */}
        <div
          className="rounded-2xl p-4 text-center"
          style={{
            background: 'var(--ink)',
            color: 'var(--bone)',
          }}
        >
          <div
            className="eyebrow"
            style={{ color: 'rgba(252,247,235,0.7)', marginBottom: 4 }}
          >
            Pay this amount
          </div>
          <div
            className="serif"
            style={{ fontSize: 38, color: 'var(--mustard)', letterSpacing: '-0.02em' }}
          >
            {pkr(total)}
          </div>
          <div
            className="mt-2"
            style={{ fontSize: 11, color: 'rgba(252,247,235,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase' }}
          >
            Online payment only · no cash on delivery
          </div>
        </div>

        {/* Payment method picker */}
        <div className="space-y-2">
          <p className="eyebrow" style={{ color: 'var(--ink-muted)' }}>
            Choose how you&apos;ll pay
          </p>
          {PAYMENT_OPTIONS.map((p) => {
            const active = paymentId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaymentId(p.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left"
                style={{
                  border: '1px solid',
                  borderColor: active ? 'var(--terra)' : 'var(--line-strong)',
                  background: active ? 'rgba(196,69,38,0.06)' : 'var(--bone)',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: active ? 'var(--terra)' : 'var(--cream)',
                    color: active ? 'var(--bone)' : 'var(--ink)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  {p.emoji ?? '💳'}
                </span>
                <span className="flex-1">
                  <span className="serif block" style={{ fontSize: 16 }}>
                    {p.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {p.kind === 'bank' ? 'IBFT · scan or transfer' : 'Send via the app'}
                  </span>
                </span>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: '1px solid var(--line-strong)',
                    background: active ? 'var(--terra)' : 'transparent',
                    boxShadow: active ? 'inset 0 0 0 3px var(--bone)' : 'none',
                    flexShrink: 0,
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Payment instructions for the selected method */}
        {selected && (
          <PaymentInstructions option={selected} amount={total} />
        )}

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
        <Turnstile onToken={setCfToken} />

        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="btn btn-outline"
            style={{ flex: '0 0 auto' }}
            disabled={submitting}
          >
            ← Back
          </button>
          <button
            onClick={onConfirmPaid}
            disabled={submitting || !paymentId || !shopOpen}
            className="btn btn-terra"
            style={{
              flex: 1,
              opacity: submitting || !paymentId || !shopOpen ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Confirming…
              </>
            ) : !shopOpen ? (
              <>
                <Clock size={14} /> Closed · {shopShort.replace(/^Closed · /, '')}
              </>
            ) : !paymentId ? (
              <>Pick a method first</>
            ) : (
              <>
                I&apos;ve paid — confirm <span className="arrow">↗</span>
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
          We verify before brewing — no charge for failed transfers
        </p>
      </div>
    </>
  );
}

/** Selected-method details: account name, account number (with copy),
 *  optional QR image, instructions. */
function PaymentInstructions({
  option,
  amount,
}: {
  option: PaymentOption;
  amount: number;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      /* ignore — clipboard might not be available on http */
    }
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-4"
      style={{
        background: 'var(--cream)',
        border: '1px solid var(--line-strong)',
      }}
    >
      {option.note && (
        <p
          style={{
            color: 'var(--ink-soft)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {option.note}
        </p>
      )}

      {option.qrImage && (
        <div
          className="mx-auto"
          style={{
            background: 'var(--bone)',
            borderRadius: 14,
            padding: 12,
            border: '1px solid var(--line)',
            width: 'fit-content',
          }}
        >
          <Image
            src={option.qrImage}
            alt={`${option.label} QR code`}
            width={220}
            height={220}
            className="rounded-lg"
            style={{ display: 'block' }}
            unoptimized
          />
        </div>
      )}

      <div className="space-y-2">
        <CopyRow
          label={option.accountNumberLabel || 'Account'}
          value={option.accountNumber}
          mono
          copied={copied === 'account'}
          onCopy={() => copy('account', option.accountNumber)}
        />
        <CopyRow
          label="Name"
          value={option.accountName}
          copied={copied === 'name'}
          onCopy={() => copy('name', option.accountName)}
        />
        {option.bankName && (
          <CopyRow
            label="Bank"
            value={option.branch ? `${option.bankName} · ${option.branch}` : option.bankName}
            copied={copied === 'bank'}
            onCopy={() =>
              copy('bank', option.branch ? `${option.bankName} · ${option.branch}` : option.bankName!)
            }
          />
        )}
        <CopyRow
          label="Amount"
          value={pkr(amount)}
          mono
          copied={copied === 'amount'}
          onCopy={() => copy('amount', String(amount))}
        />
      </div>

      <div
        className="rounded-lg p-3 flex items-start gap-2"
        style={{
          background: 'rgba(212,151,46,0.12)',
          border: '1px solid rgba(212,151,46,0.3)',
          color: 'var(--ink-soft)',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <ArrowRight size={12} style={{ marginTop: 3, flexShrink: 0, color: '#7a560f' }} />
        <span>
          Send <strong>{pkr(amount)}</strong> via {option.label}, then tap{' '}
          <strong>I&apos;ve paid</strong> below. We&apos;ll verify in our app and start
          brewing right after.
        </span>
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2"
      style={{
        background: 'var(--bone)',
        border: '1px solid var(--line)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        <div
          className="truncate"
          style={{
            fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
            fontSize: 14,
            color: 'var(--ink)',
            letterSpacing: mono ? '0.02em' : 'normal',
          }}
        >
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        title="Copy"
        className="inline-flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: copied ? 'var(--sage)' : 'var(--cream)',
          color: copied ? 'var(--bone)' : 'var(--ink)',
          border: '1px solid var(--line-strong)',
          flexShrink: 0,
          transition: 'all 200ms ease',
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
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
