'use client';

/**
 * WelcomeGate — area picker that greets first-time visitors.
 *
 * Visitors pick a neighbourhood from the curated list in
 * `lib/shop.ts → SHOP.delivery.areas`. Anything not on the list is
 * browse-only — we surface a soft "browse the menu anyway" CTA plus
 * a WhatsApp pivot so out-of-zone customers aren't dead-ended.
 *
 *   welcome  →  pick a block (grouped chips + search)
 *            OR → "my area isn't here" → browse-only
 *   confirm  →  "We deliver to Block 7 FB · ready to order"
 *
 * The decision persists for 30 days via ZoneProvider / localStorage.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, X, Check, Search, ArrowRight, MessageCircle, Loader2, Crosshair } from 'lucide-react';
import { useZone } from '@/lib/zone-context';
import { SHOP, deliveryAreaClusters, type DeliveryArea } from '@/lib/shop';
import { autoFillAddress } from '@/lib/geo-fill';
import Flower from '@/components/brand/Flower';
import Wordmark from '@/components/brand/Wordmark';

type Step = 'pick' | 'confirmed';

export default function WelcomeGate() {
  const zone = useZone();
  const [step, setStep] = useState<Step>('pick');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const clusters = useMemo(() => deliveryAreaClusters(), []);

  // Each time the gate opens, reset internal state
  useEffect(() => {
    if (zone.gateOpen) {
      setStep(zone.status === 'in' ? 'confirmed' : 'pick');
      setQuery('');
      const t = window.setTimeout(() => inputRef.current?.focus(), 100);
      return () => window.clearTimeout(t);
    }
  }, [zone.gateOpen, zone.status]);

  if (!zone.gateOpen) return null;

  const filteredClusters = clusters
    .map((c) => ({
      ...c,
      areas: c.areas.filter(
        (a) =>
          !query.trim() ||
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          c.cluster.toLowerCase().includes(query.toLowerCase()) ||
          `${c.cluster} ${a.label}`.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter((c) => c.areas.length > 0);

  function pick(area: DeliveryArea) {
    const ok = zone.setArea(area.id);
    if (ok) setStep('confirmed');
  }

  function browseAnyway() {
    zone.setBrowsing();
    zone.closeGate();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-5"
      style={{ background: 'rgba(28,23,18,0.74)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative grain overflow-hidden"
        style={{
          background: 'var(--bone)',
          color: 'var(--ink)',
          maxWidth: 560,
          width: '100%',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          borderRadius: 22,
          boxShadow: '0 40px 90px -25px rgba(0,0,0,0.6)',
          border: '1px solid rgba(28,23,18,0.06)',
        }}
      >
        {/* decorative corner flower */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 160,
            height: 160,
            opacity: 0.12,
            pointerEvents: 'none',
          }}
        >
          <Flower size="100%" color="var(--terra)" centerColor="var(--mustard, #d4972e)" spin />
        </div>

        {/* close — only if visitor has already resolved once */}
        {zone.status !== 'unknown' && (
          <button
            onClick={zone.closeGate}
            aria-label="Close"
            className="absolute"
            style={{ top: 14, right: 14, padding: 8, color: 'var(--ink-muted)', zIndex: 5 }}
          >
            <X size={18} />
          </button>
        )}

        <div style={{ padding: '38px 32px 30px', position: 'relative', zIndex: 2 }}>
          <div className="flex items-center justify-between mb-6">
            <Wordmark tone="terra" size={26} />
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
              }}
            >
              № 001 · Karachi
            </span>
          </div>

          {step === 'pick' && (
            <PickStep
              query={query}
              setQuery={setQuery}
              inputRef={inputRef}
              clusters={filteredClusters}
              allClusters={clusters}
              selectedAreaId={zone.areaId}
              onPick={pick}
              onBrowse={browseAnyway}
            />
          )}

          {step === 'confirmed' && zone.area && (
            <ConfirmedStep
              area={zone.area}
              onDone={zone.closeGate}
              onChange={() => setStep('pick')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── STEP · PICK ──────────────────────────────────────────── */
function PickStep({
  query,
  setQuery,
  inputRef,
  clusters,
  allClusters,
  selectedAreaId,
  onPick,
  onBrowse,
}: {
  query: string;
  setQuery: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  clusters: { cluster: string; areas: readonly DeliveryArea[] }[];
  allClusters: { cluster: string; areas: readonly DeliveryArea[] }[];
  selectedAreaId: string | null;
  onPick: (a: DeliveryArea) => void;
  onBrowse: () => void;
}) {
  const totalAreas = allClusters.reduce((s, c) => s + c.areas.length, 0);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function detect() {
    setLocating(true);
    setLocMsg(null);
    try {
      const res = await autoFillAddress();
      if (res.matchedArea) {
        setLocMsg({
          tone: 'ok',
          text: `Picked ${res.matchedArea.cluster} · ${res.matchedArea.label}`,
        });
        // Brief pause so the user sees the success line before the gate closes
        setTimeout(() => onPick(res.matchedArea!), 400);
      } else {
        setLocMsg({
          tone: 'err',
          text:
            res.parts.areaName || res.parts.display
              ? `You look like ${res.parts.areaName || res.parts.display.split(',')[0]} — not on our list yet. Pick the closest block manually.`
              : "Couldn't match your location to a covered block. Pick one manually.",
        });
      }
    } catch (e: any) {
      setLocMsg({ tone: 'err', text: e?.message || 'Location unavailable' });
    } finally {
      setLocating(false);
    }
  }

  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        "Hi BRUE — my area isn't on the delivery list, can you deliver to me?"
      )}`
    : '#';

  return (
    <>
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
        <MapPin size={12} /> Delivering to {totalAreas} blocks
      </span>

      <h2
        className="display mt-5"
        style={{ fontSize: 'clamp(1.9rem, 4.8vw, 2.6rem)', lineHeight: 1.02 }}
      >
        Which <span className="ital">block</span> are you in?
      </h2>

      <p
        className="mt-3"
        style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, maxWidth: 440 }}
      >
        Pick your block and we'll unlock ordering. Not here? You can still browse
        the menu — drop us a WhatsApp if you want us to extend delivery.
      </p>

      {/* search */}
      <label
        className="flex items-center gap-2 mt-5 px-3 py-2 rounded-full"
        style={{ background: 'rgba(28,23,18,0.05)', border: '1px solid var(--line)' }}
      >
        <Search size={14} style={{ color: 'var(--ink-muted)' }} />
        <input
          ref={inputRef}
          className="bg-transparent outline-none text-sm flex-1"
          style={{ color: 'var(--ink)' }}
          placeholder="Search blocks — e.g. FB 7, North Nazimabad M"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Clear">
            <X size={14} style={{ color: 'var(--ink-muted)' }} />
          </button>
        )}
      </label>

      {/* auto-detect via geolocation */}
      <div className="mt-3">
        <button
          type="button"
          onClick={detect}
          disabled={locating}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full"
          style={{
            background: 'var(--ink)',
            color: 'var(--bone)',
            fontSize: 12,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 500,
            opacity: locating ? 0.6 : 1,
          }}
        >
          {locating ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
          {locating ? 'Finding you…' : 'Use my location'}
        </button>
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
      </div>

      {/* clusters */}
      <div className="mt-5 space-y-5">
        {clusters.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 13, padding: '20px 0' }}>
            No match — try a different spelling, or{' '}
            <button
              onClick={onBrowse}
              style={{
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                color: 'var(--terra)',
              }}
            >
              browse the menu anyway
            </button>
            .
          </p>
        ) : (
          clusters.map((c) => (
            <div key={c.cluster}>
              <h3
                className="serif italic"
                style={{
                  fontSize: 13,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                  marginBottom: 10,
                }}
              >
                {c.cluster}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    color: 'var(--ink-muted)',
                    opacity: 0.7,
                  }}
                >
                  · {c.areas.length}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {c.areas.map((a) => {
                  const active = a.id === selectedAreaId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => onPick(a)}
                      className="inline-flex items-center gap-1.5 rounded-full transition-colors"
                      style={{
                        padding: '8px 14px',
                        fontSize: 13,
                        fontWeight: 500,
                        background: active ? 'var(--ink)' : 'var(--bone)',
                        color: active ? 'var(--bone)' : 'var(--ink)',
                        border: `1px solid ${active ? 'var(--ink)' : 'var(--line-strong)'}`,
                      }}
                    >
                      {active && <Check size={12} />}
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* footer actions */}
      <div
        className="mt-6 pt-5 flex flex-col gap-3"
        style={{ borderTop: '1px dashed var(--line-strong)' }}
      >
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button
            onClick={onBrowse}
            style={{
              fontSize: 13,
              color: 'var(--ink-muted)',
              textDecoration: 'underline',
              textDecorationColor: 'var(--line-strong)',
              textUnderlineOffset: 4,
            }}
          >
            My area isn't here — just browsing
          </button>
          {wa && (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 13, color: 'var(--terra)' }}
            >
              <MessageCircle size={13} />
              Ask on WhatsApp
            </a>
          )}
        </div>
        <p
          style={{
            color: 'var(--ink-muted)',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Pickup is always available at the bar.
        </p>
      </div>
    </>
  );
}

/* ─── STEP · CONFIRMED ─────────────────────────────────────── */
function ConfirmedStep({
  area,
  onDone,
  onChange,
}: {
  area: DeliveryArea;
  onDone: () => void;
  onChange: () => void;
}) {
  return (
    <>
      <span
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{
          background: 'rgba(107,122,83,0.16)',
          color: 'var(--sage)',
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        <Check size={12} /> Delivering to your block
      </span>

      <h2
        className="display mt-5"
        style={{ fontSize: 'clamp(2rem, 5vw, 2.6rem)', lineHeight: 1.02 }}
      >
        You're <span className="ital" style={{ color: 'var(--sage)' }}>in</span>.
      </h2>

      <div
        className="mt-5 flex items-baseline gap-3 flex-wrap"
        style={{ fontSize: 16 }}
      >
        <span
          className="fraunces italic"
          style={{ fontSize: 32, lineHeight: 1.05, color: 'var(--sage)' }}
        >
          {area.label}
        </span>
        <span
          style={{
            color: 'var(--ink-muted)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontSize: 11,
          }}
        >
          {area.cluster}
        </span>
      </div>

      <p
        className="mt-5"
        style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}
      >
        We'll ask for a street-level address at checkout. Delivery is by Bykea,
        inDrive, or we coordinate on WhatsApp.
      </p>

      <div className="mt-7 flex gap-2 flex-wrap">
        <button onClick={onDone} className="btn btn-primary">
          Show me the menu <span className="arrow">↗</span>
        </button>
        <button onClick={onChange} className="btn btn-outline" style={{ fontSize: 13 }}>
          Change block
        </button>
      </div>

      <p
        className="script mt-5"
        style={{ color: 'var(--terra)', fontSize: 20, transform: 'rotate(-1.5deg)' }}
      >
        one cold brew, coming up ✿
      </p>
    </>
  );
}
