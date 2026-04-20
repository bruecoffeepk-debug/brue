'use client';

import { useEffect, useState } from 'react';
import { X, Clock } from 'lucide-react';
import { isOpenNow, statusLabel, nowInKarachi } from '@/lib/hours';
import { SHOP } from '@/lib/shop';

const DISMISS_KEY = 'brue-closed-modal-dismissed';

/**
 * Pill chip used inside the public Nav. Shows "Open until 12 am" or
 * "Closed · opens 8 am" based on Karachi time.
 *
 * Re-renders every minute so the time stays fresh.
 */
export function OpenStatusChip() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const status = statusLabel(nowInKarachi());
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{
        background: status.open ? 'rgba(107,122,83,0.16)' : 'rgba(196,69,38,0.12)',
        color: status.open ? 'var(--sage)' : 'var(--terra-deep)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        // re-render hint
        opacity: 1 - 0 * tick,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: status.open ? 'var(--sage)' : 'var(--terra)',
          boxShadow: status.open ? '0 0 0 3px rgba(107,122,83,0.25)' : '0 0 0 3px rgba(196,69,38,0.18)',
        }}
      />
      {status.short}
    </span>
  );
}

/**
 * Full-screen modal that appears once per browser session when BRUE is closed.
 * Friendly tone, shows hours + Instagram fallback. Dismissed via localStorage.
 */
export function ClosedShopModal() {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) return;
    if (!isOpenNow()) {
      // small delay so the page paints first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [tick]);

  // Re-check every 5 minutes so a modal opened at 7:55 am can close itself at 8.
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (isOpenNow() && open) setOpen(false);
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;
  const status = statusLabel(nowInKarachi());
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    }
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-5"
      style={{ background: 'rgba(28,23,18,0.6)' }}
      onClick={dismiss}
    >
      <div
        className="relative grain"
        style={{
          background: 'var(--bone)',
          color: 'var(--ink)',
          maxWidth: 460,
          width: '100%',
          borderRadius: 18,
          padding: '40px 36px 36px',
          boxShadow: '0 30px 80px -20px rgba(28,23,18,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute"
          style={{ top: 14, right: 14, padding: 6, color: 'var(--ink-muted)' }}
        >
          <X size={18} />
        </button>

        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(196,69,38,0.1)',
            color: 'var(--terra-deep)',
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--terra)' }} />
          We're closed right now
        </span>

        <h3 className="display mt-5" style={{ fontSize: 38, lineHeight: 1.05 }}>
          The bar is <span className="ital">resting</span>.
        </h3>

        <p className="mt-4" style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}>
          {status.detail} You can still browse the menu — orders just won't be confirmed
          until we're back behind the bar.
        </p>

        <div
          className="mt-6 pt-5 grid gap-2"
          style={{ borderTop: '1px solid var(--line)', fontSize: 13 }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ink-muted)' }} className="inline-flex items-center gap-2">
              <Clock size={13} /> Hours
            </span>
            <span className="serif">{SHOP.hoursSummary}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-6 flex-wrap">
          <button onClick={dismiss} className="btn btn-primary">
            Browse the menu
          </button>
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=Hi%20BRUE%20%E2%80%94%20I%27d%20like%20to%20pre-order%20for%20when%20you%20open.`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
            >
              Pre-order on WhatsApp
            </a>
          )}
        </div>

        <p
          className="script mt-5 text-center"
          style={{ color: 'var(--terra)', fontSize: 18, transform: 'rotate(-1.5deg)' }}
        >
          see you soon ✿
        </p>
      </div>
    </div>
  );
}
