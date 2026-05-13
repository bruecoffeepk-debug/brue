'use client';

/**
 * WelcomeGate — radius-based delivery check.
 *
 *   detect    → tap "Use my location" → GPS → in/out branch
 *     in      → "✓ You're 2.3km away — let's get you fed" → close + unlock
 *     out     → "8.1km away — bit too far" → browse / WhatsApp / type address
 *   manual    → "I'll just type my address" → close + unlock (trust the address)
 *
 * Persists for 30 days via ZoneProvider / localStorage.
 */

import { useEffect, useState } from 'react';
import { Loader2, MapPin, MessageCircle, X, Crosshair, ArrowRight, Check } from 'lucide-react';
import { useZone } from '@/lib/zone-context';
import { SHOP } from '@/lib/shop';
import { getDeviceLocation } from '@/lib/geo-fill';
import Wordmark from '@/components/brand/Wordmark';

type View = 'ask' | 'in-range' | 'out-of-range';

export default function WelcomeGate() {
  const zone = useZone();
  const [view, setView] = useState<View>('ask');
  const [locating, setLocating] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Reset internal state every time the gate re-opens
  useEffect(() => {
    if (zone.gateOpen) {
      setView('ask');
      setErrMsg(null);
      setLocating(false);
    }
  }, [zone.gateOpen]);

  if (!zone.gateOpen) return null;

  async function detect() {
    setLocating(true);
    setErrMsg(null);
    try {
      const loc = await getDeviceLocation();
      zone.setCoords(loc);
      // Re-read what setCoords decided — easier than reading state synchronously
      const km = haversineEstimate(loc); // local cheap calc for the immediate UI
      setView(km <= SHOP.delivery.radiusKm ? 'in-range' : 'out-of-range');
    } catch (e: any) {
      setErrMsg(e?.message || 'Location unavailable');
    } finally {
      setLocating(false);
    }
  }

  function manual() {
    zone.setManual();
    zone.closeGate();
  }

  function continueIn() {
    zone.closeGate();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(28,23,18,0.6)', backdropFilter: 'blur(6px)' }}
      />
      <div
        className="relative w-full md:max-w-[460px] flex flex-col grain"
        style={{
          background: 'var(--bone)',
          borderRadius: 22,
          maxHeight: '92vh',
          overflow: 'hidden',
          boxShadow: '0 -30px 80px -20px rgba(28,23,18,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* close — only shown when they have a previous decision (so first-time
            visitors can't dismiss without picking) */}
        {zone.status !== 'unknown' && (
          <button
            onClick={zone.closeGate}
            aria-label="Close"
            className="absolute top-3 right-3 z-[2] inline-flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: 'rgba(252,247,235,0.92)',
              color: 'var(--ink)',
              border: '1px solid rgba(28,23,18,0.08)',
            }}
          >
            <X size={18} />
          </button>
        )}

        <div style={{ padding: '36px 30px 30px' }}>
          <Wordmark tone="terra" size={28} />

          {view === 'ask' && (
            <AskView
              locating={locating}
              errMsg={errMsg}
              onDetect={detect}
              onManual={manual}
            />
          )}

          {view === 'in-range' && (
            <InRangeView
              distanceKm={zone.distanceKm}
              onContinue={continueIn}
            />
          )}

          {view === 'out-of-range' && (
            <OutOfRangeView
              distanceKm={zone.distanceKm}
              onManual={manual}
              onClose={zone.closeGate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── views ───────────────────────────────────────────────── */

function AskView({
  locating,
  errMsg,
  onDetect,
  onManual,
}: {
  locating: boolean;
  errMsg: string | null;
  onDetect: () => void;
  onManual: () => void;
}) {
  return (
    <>
      <span
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-6"
        style={{
          background: 'rgba(196,69,38,0.1)',
          color: 'var(--terra-deep)',
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        <MapPin size={12} /> Delivering within {SHOP.delivery.radiusKm} km
      </span>
      <h2
        className="display mt-5"
        style={{ fontSize: 'clamp(1.9rem, 4.8vw, 2.6rem)', lineHeight: 1.02 }}
      >
        Quick — <span className="ital">where</span> are you?
      </h2>
      <p
        className="mt-3"
        style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, maxWidth: 440 }}
      >
        We deliver within {SHOP.delivery.radiusKm} km of the bar (FB Area, North
        Nazimabad and around). Tap below — we&apos;ll check in one second.
      </p>

      <button
        onClick={onDetect}
        disabled={locating}
        className="btn btn-terra w-full mt-6"
        style={{ opacity: locating ? 0.6 : 1 }}
      >
        {locating ? (
          <><Loader2 size={14} className="animate-spin" /> Finding you…</>
        ) : (
          <><Crosshair size={14} /> Use my location</>
        )}
      </button>

      {errMsg && (
        <p
          className="mt-3"
          style={{
            fontSize: 12,
            color: 'var(--terra-deep)',
            background: 'rgba(196,69,38,0.06)',
            border: '1px solid rgba(196,69,38,0.2)',
            padding: '8px 12px',
            borderRadius: 10,
          }}
        >
          {errMsg}
        </p>
      )}

      <div className="flex items-center gap-3 my-5" style={{ color: 'var(--ink-muted)' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          or
        </span>
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>

      <button
        onClick={onManual}
        className="btn btn-outline w-full"
      >
        I&apos;ll type my address <ArrowRight size={14} />
      </button>

      <p
        className="mt-5"
        style={{ color: 'var(--ink-muted)', fontSize: 11, lineHeight: 1.5 }}
      >
        Either way you can browse the menu and we&apos;ll figure delivery out at
        checkout.
      </p>
    </>
  );
}

function InRangeView({
  distanceKm,
  onContinue,
}: {
  distanceKm: number | null;
  onContinue: () => void;
}) {
  return (
    <>
      <div
        className="inline-flex items-center justify-center mt-6"
        style={{
          width: 56, height: 56, borderRadius: 999,
          background: 'rgba(107,122,83,0.18)', color: 'var(--sage)',
        }}
      >
        <Check size={26} />
      </div>
      <h2
        className="display mt-5"
        style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', lineHeight: 1.02 }}
      >
        You&apos;re <span className="ital">in range</span>.
      </h2>
      <p className="mt-3" style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6 }}>
        About <strong style={{ color: 'var(--terra)' }}>
          {distanceKm != null ? distanceKm.toFixed(1) : '—'} km
        </strong> from the bar — well inside our delivery range. Bykea, inDrive
        or WhatsApp from checkout.
      </p>

      <button onClick={onContinue} className="btn btn-terra w-full mt-6">
        Let&apos;s order <ArrowRight size={14} />
      </button>
    </>
  );
}

function OutOfRangeView({
  distanceKm,
  onManual,
  onClose,
}: {
  distanceKm: number | null;
  onManual: () => void;
  onClose: () => void;
}) {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        `Hi BRUE — I'm a bit outside your ${SHOP.delivery.radiusKm} km zone (~${distanceKm?.toFixed(1)} km away). Can you make an exception this time?`
      )}`
    : '#';

  return (
    <>
      <div
        className="inline-flex items-center justify-center mt-6"
        style={{
          width: 56, height: 56, borderRadius: 999,
          background: 'rgba(196,69,38,0.12)', color: 'var(--terra-deep)',
        }}
      >
        <MapPin size={26} />
      </div>
      <h2
        className="display mt-5"
        style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', lineHeight: 1.02 }}
      >
        A bit too <span className="ital">far</span>.
      </h2>
      <p className="mt-3" style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6 }}>
        You&apos;re about <strong>{distanceKm?.toFixed(1)} km</strong> from the
        bar — outside our {SHOP.delivery.radiusKm} km delivery zone. WhatsApp us
        if you&apos;re close to the edge — we sometimes stretch.
      </p>

      <div className="flex flex-col gap-2 mt-5">
        {wa && (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="btn btn-terra"
          >
            <MessageCircle size={14} /> WhatsApp us
          </a>
        )}
        <button onClick={onManual} className="btn btn-outline">
          I&apos;ll type my address anyway <ArrowRight size={14} />
        </button>
        <button onClick={onClose} className="btn btn-ghost">
          Just let me browse the menu
        </button>
      </div>
    </>
  );
}

/* Same haversine math as lib/shop.ts but inlined here so we don't have to
 * await a state update before deciding which view to show. */
function haversineEstimate(c: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(c.lat - SHOP.lat);
  const dLng = toRad(c.lng - SHOP.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(SHOP.lat)) * Math.cos(toRad(c.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
