'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  Clock,
  Coffee,
  Truck,
  MessageCircle,
  X,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Bell,
  BellOff,
} from 'lucide-react';
import { pkr } from '@/lib/utils';
import { setStatus, setPayment } from '@/app/(admin)/admin/orders/actions';
import { createClient } from '@/lib/supabase/client';

type Order = {
  id: string;
  order_number: number;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  order_type: string;
  delivery_address: string | null;
  delivery_method: string | null;
  delivery_distance_km: number | null;
  payment_method: string;
  subtotal: number;
  total: number;
  notes: string | null;
  status: string;
  channel: string;
  created_at: string;
};

type Item = {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  price: number;
  line_total: number;
};

const STATUS_FLOW: Record<string, { next: string; label: string }> = {
  pending: { next: 'accepted', label: 'Accept' },
  accepted: { next: 'preparing', label: 'Start making' },
  preparing: { next: 'out', label: 'Mark out for delivery' },
  out: { next: 'completed', label: 'Mark delivered' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:   { label: 'New',        color: 'var(--terra-deep)', bg: 'rgba(196,69,38,0.12)', icon: Clock },
  accepted:  { label: 'Accepted',   color: 'var(--sage)',       bg: 'rgba(107,122,83,0.16)', icon: Check },
  preparing: { label: 'Brewing',    color: '#7a560f',            bg: 'rgba(212,151,46,0.18)', icon: Coffee },
  out:       { label: 'Out',        color: 'var(--terra)',       bg: 'rgba(196,69,38,0.14)',  icon: Truck },
  completed: { label: 'Done',       color: 'var(--ink-soft)',    bg: 'rgba(28,23,18,0.06)',   icon: Check },
  cancelled: { label: 'Cancelled',  color: 'var(--terra-deep)', bg: 'rgba(196,69,38,0.12)',  icon: X },
};

export default function OrdersClient({
  orders,
  itemsByOrder,
}: {
  orders: Order[];
  itemsByOrder: Record<string, Item[]>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Sound preference — persisted in localStorage so it survives reloads.
  // Default ON: this is a kitchen / counter screen, you want the ping.
  const [soundOn, setSoundOn] = useState<boolean>(true);
  // Audio is "unlocked" only after the user has interacted with the page
  // (browser autoplay policy). We track this so we can show "Test" / "Tap to
  // unlock" in the UI and also avoid silently dropping pings before unlock.
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('brue.orders.soundOn');
      if (saved === '0') setSoundOn(false);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('brue.orders.soundOn', soundOn ? '1' : '0'); } catch {}
  }, [soundOn]);

  /** Lazily create the shared AudioContext and resume it. MUST be called
   *  from inside a user gesture (click / keypress / touch) the first time
   *  or the browser keeps the context suspended and every ding plays
   *  silently. After the first resume, future plays work without a gesture. */
  function ensureAudioUnlocked(): AudioContext | null {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (ctx.state === 'running') {
        if (!audioUnlocked) setAudioUnlocked(true);
      }
      return ctx;
    } catch {
      return null;
    }
  }

  /** Play a loud, attention-grabbing 3-note rising chime. Higher freqs +
   *  square wave + bigger gain than the original ding so it cuts through
   *  cafe noise. Plays it TWICE in quick succession for extra emphasis. */
  function playDing() {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    try {
      const notes = [
        { freq: 1200, start: 0.00, dur: 0.14, peak: 0.5  },
        { freq: 1600, start: 0.13, dur: 0.14, peak: 0.55 },
        { freq: 2200, start: 0.26, dur: 0.32, peak: 0.6  },
        // Pause, then repeat — a "ding-ding" not a single ding
        { freq: 1200, start: 0.75, dur: 0.14, peak: 0.5  },
        { freq: 1600, start: 0.88, dur: 0.14, peak: 0.55 },
        { freq: 2200, start: 1.01, dur: 0.32, peak: 0.6  },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = n.freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = ctx.currentTime + n.start;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(n.peak, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
        osc.start(t0);
        osc.stop(t0 + n.dur + 0.05);
      }
    } catch {
      /* ignore — context might have closed */
    }
  }

  // Belt-and-suspenders: any click anywhere on the page also tries to
  // unlock audio. So even if the staff doesn't touch the bell button, the
  // first time they click anything (a row, the search input) the context
  // resumes and future dings work.
  useEffect(() => {
    const onAnyClick = () => ensureAudioUnlocked();
    window.addEventListener('click', onAnyClick);
    window.addEventListener('keydown', onAnyClick);
    window.addEventListener('touchstart', onAnyClick, { passive: true });
    return () => {
      window.removeEventListener('click', onAnyClick);
      window.removeEventListener('keydown', onAnyClick);
      window.removeEventListener('touchstart', onAnyClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which order ids we've already seen so we know what's "new".
  // Initial baseline = the orders rendered on first server render.
  const knownIdsRef = useRef<Set<string>>(new Set(orders.map((o) => o.id)));
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // Re-baseline when orders prop changes (server refresh / status update from
  // the same staff session). Don't drop newIds — those still need attention.
  useEffect(() => {
    for (const o of orders) knownIdsRef.current.add(o.id);
  }, [orders]);

  // Poll for new pending web orders every 12s. RLS allows authenticated full
  // SELECT, so the staff session can read. If the staff is on a stable
  // network this is well within Supabase's free tier limits (5 reads / min).
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function tick() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, channel, status, created_at')
          .eq('channel', 'web')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20);
        if (cancelled || error || !data) return;

        const fresh = data.filter((o) => !knownIdsRef.current.has(o.id));
        if (fresh.length === 0) return;

        // Mark them known + new, then ask the server component for fresh data
        // so the row actually appears in the list.
        for (const o of fresh) knownIdsRef.current.add(o.id);
        setNewIds((prev) => {
          const next = new Set(prev);
          for (const o of fresh) next.add(o.id);
          return next;
        });
        if (soundOn) playDing();
        // Best-effort browser notification (silent if user hasn't allowed it).
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('BRUE — new order', {
            body: `${fresh.length} new web order${fresh.length > 1 ? 's' : ''}`,
            icon: '/Brue_DP_Orange.png',
            tag: 'brue-new-order', // collapses repeats
          });
        }
        router.refresh();
      } catch {
        /* ignore — keep polling */
      }
    }

    // Fire once immediately so the page picks up anything that landed while
    // the staff was away from this tab.
    tick();
    const interval = setInterval(tick, 12_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router, soundOn]);

  // Ask for browser-notification permission on first user interaction (a
  // click anywhere). Some browsers block prompting from inside an effect.
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    const ask = () => {
      Notification.requestPermission().catch(() => {});
      window.removeEventListener('click', ask);
    };
    window.addEventListener('click', ask, { once: true });
    return () => window.removeEventListener('click', ask);
  }, []);

  function dismissNew(id: string) {
    setNewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
  function dismissAllNew() {
    setNewIds(new Set());
  }
  function scrollToFirstNew() {
    const firstId = orders.find((o) => newIds.has(o.id))?.id;
    if (!firstId) return;
    const el = document.getElementById(`order-${firstId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // After 2s, give it the dismissed flicker so staff knows it's been seen.
      setTimeout(() => dismissNew(firstId), 2000);
    }
  }

  const newCount = newIds.size;

  function advance(o: Order) {
    const flow = STATUS_FLOW[o.status];
    if (!flow) return;

    // When the staff confirms an order (pending → accepted) we automatically
    // open a WhatsApp tab pre-filled with the same status message + receipt
    // link the manual "Send update" button uses. The popup is opened during
    // the click handler so browsers don't block it; we point at about:blank
    // and rewrite the URL after the server action returns. If there's no
    // customer phone (cashier didn't capture one), we skip silently.
    const shouldNotify = flow.next === 'accepted' && Boolean(o.customer_phone);
    const popup = shouldNotify ? window.open('about:blank', '_blank') : null;

    start(async () => {
      try {
        await setStatus(o.id, flow.next);
        router.refresh();

        if (popup && o.customer_phone) {
          const receiptUrl = `${window.location.origin}/r/${o.id}`;
          const msg = buildStatusMessage(
            { ...o, status: flow.next },
            receiptUrl
          );
          popup.location.href = `https://wa.me/${sanitizePhone(o.customer_phone)}?text=${encodeURIComponent(msg)}`;
        }
      } catch (e: any) {
        if (popup) {
          try { popup.close(); } catch {}
        }
        alert(e?.message ?? 'Could not update status');
      }
    });
  }

  function cancel(o: Order) {
    if (!confirm(`Cancel order #${o.order_number}?`)) return;
    start(async () => {
      try {
        await setStatus(o.id, 'cancelled');
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? 'Could not cancel');
      }
    });
  }

  // Bell toggle + Test button. The Test button does double duty: it gives
  // staff instant feedback that audio works AND unlocks the AudioContext
  // (browser autoplay policy needs a user gesture). Clicking the bell to
  // turn sound ON also unlocks.
  const SoundToggle = (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={() => {
          ensureAudioUnlocked();
          setSoundOn((v) => !v);
        }}
        title={soundOn ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{
          background: soundOn ? 'rgba(107,122,83,0.12)' : 'rgba(28,23,18,0.06)',
          color: soundOn ? 'var(--sage)' : 'var(--ink-muted)',
          border: `1px solid ${soundOn ? 'rgba(107,122,83,0.32)' : 'var(--line)'}`,
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        {soundOn ? <Bell size={11} /> : <BellOff size={11} />}
        Sound {soundOn ? 'on' : 'off'}
      </button>
      <button
        onClick={() => {
          const ctx = ensureAudioUnlocked();
          // After a tick (the resume Promise), play. Use a small delay so
          // a freshly-resumed context is in 'running' state by then.
          setTimeout(() => {
            if (ctx && ctx.state === 'running') playDing();
          }, 50);
        }}
        title={
          audioUnlocked
            ? 'Test ding'
            : 'Tap to unlock audio (browser blocks sound until you click)'
        }
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{
          background: 'transparent',
          color: audioUnlocked ? 'var(--ink-soft)' : 'var(--terra-deep)',
          border: `1px solid ${audioUnlocked ? 'var(--line)' : 'rgba(196,69,38,0.35)'}`,
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        {audioUnlocked ? 'Test' : 'Tap to unlock'}
      </button>
    </div>
  );

  // Floating "N new" bubble — sticky at the top, click to scroll to first new.
  const NewBubble = newCount > 0 && (
    <div
      className="sticky z-30 flex justify-center mb-3"
      style={{ top: 12, pointerEvents: 'none' }}
    >
      <div
        className="inline-flex items-center gap-3 pl-4 pr-2 py-2 rounded-full"
        style={{
          background: 'var(--terra)',
          color: 'var(--bone)',
          boxShadow: '0 14px 36px -14px rgba(196,69,38,0.55)',
          pointerEvents: 'auto',
          animation: 'brue-pulse 1.4s ease-in-out infinite',
        }}
      >
        <span className="relative inline-flex" style={{ width: 14, height: 14 }}>
          <span
            style={{
              position: 'absolute', inset: 0, borderRadius: 999,
              background: 'rgba(252,247,235,0.4)',
              animation: 'brue-ring 1.6s ease-out infinite',
            }}
          />
          <span
            style={{
              position: 'absolute', top: 4, left: 4, width: 6, height: 6,
              borderRadius: 999, background: 'var(--bone)',
            }}
          />
        </span>
        <button
          onClick={scrollToFirstNew}
          className="text-[12px] font-semibold tracking-wide"
          style={{ color: 'inherit' }}
        >
          {newCount} new web order{newCount > 1 ? 's' : ''} · jump
        </button>
        <button
          onClick={dismissAllNew}
          aria-label="Dismiss"
          className="inline-flex items-center justify-center"
          style={{
            width: 26, height: 26, borderRadius: 999,
            background: 'rgba(252,247,235,0.18)',
          }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );

  if (orders.length === 0) {
    return (
      <>
        <style>{BUBBLE_KEYFRAMES}</style>
        <div className="flex justify-end mb-3">{SoundToggle}</div>
        <div
          className="text-center py-20 rounded-xl"
          style={{ background: 'var(--paper)', border: '1px dashed var(--line-strong)' }}
        >
          <p className="serif italic" style={{ fontSize: 22, color: 'var(--ink-soft)' }}>
            No orders here yet.
          </p>
          <p className="mt-2" style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
            When a customer places an order on /menu, it lands here. You&apos;ll
            hear a ding when one arrives.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{BUBBLE_KEYFRAMES}</style>
      <div className="flex justify-end mb-3">{SoundToggle}</div>
      {NewBubble}
      <div className="space-y-3">
      {orders.map((o) => {
        const meta = STATUS_META[o.status] ?? STATUS_META.pending;
        const Icon = meta.icon;
        const flow = STATUS_FLOW[o.status];
        const items = itemsByOrder[o.id] ?? [];
        const isOpen = expanded === o.id;
        const placedAt = new Date(o.created_at);
        const age = minutesAgo(placedAt);
        const isNew = newIds.has(o.id);

        return (
          <div
            key={o.id}
            id={`order-${o.id}`}
            onClick={() => isNew && dismissNew(o.id)}
            className="relative overflow-hidden"
            style={{
              background: 'var(--bone)',
              border: isNew ? '2px solid var(--terra)' : '1px solid var(--line)',
              borderLeft: `4px solid ${meta.color}`,
              borderRadius: 14,
              boxShadow: isNew ? '0 0 0 4px rgba(196,69,38,0.18)' : undefined,
              animation: isNew ? 'brue-new-row 1.6s ease-in-out infinite' : undefined,
            }}
          >
            {/* Main row */}
            <div
              className="grid items-center gap-4 px-5 py-4"
              style={{
                gridTemplateColumns: '84px 1fr auto auto auto',
              }}
            >
              {/* order number */}
              <div>
                <span
                  className="serif italic"
                  style={{ fontSize: 28, color: 'var(--terra)', letterSpacing: '-0.04em' }}
                >
                  №{o.order_number}
                </span>
                <div
                  className="mt-0.5"
                  style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}
                >
                  {age}
                </div>
              </div>

              {/* customer + items summary */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="serif" style={{ fontSize: 18 }}>
                    {o.customer_name || 'Walk-in'}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                    style={{ background: meta.bg, color: meta.color, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}
                  >
                    <Icon size={10} />
                    {meta.label}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(28,23,18,0.05)', color: 'var(--ink-soft)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}
                  >
                    {o.order_type === 'delivery' ? '🛵' : '🚶'} {o.order_type}
                    {o.delivery_method ? ` · ${o.delivery_method}` : ''}
                    {o.delivery_distance_km != null ? ` · ${o.delivery_distance_km}km` : ''}
                  </span>
                </div>
                <p
                  className="mt-1 text-ellipsis overflow-hidden whitespace-nowrap"
                  style={{ color: 'var(--ink-soft)', fontSize: 13 }}
                >
                  {items.length
                    ? items.map((i) => `${i.quantity}× ${i.name}`).join(' · ')
                    : '—'}
                </p>
              </div>

              {/* total */}
              <div className="text-right">
                <span className="serif" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
                  {pkr(o.total)}
                </span>
                <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                  {o.payment_method === 'unpaid' ? 'on delivery' : o.payment_method}
                </div>
              </div>

              {/* primary action */}
              <div className="flex items-center gap-1.5">
                {flow && (
                  <button
                    onClick={() => advance(o)}
                    disabled={pending}
                    className="btn btn-terra btn-sm"
                  >
                    <Check size={12} /> {flow.label}
                  </button>
                )}
                <SendUpdateButton order={o} />
              </div>

              {/* expand */}
              <button
                onClick={() => setExpanded(isOpen ? null : o.id)}
                className="p-2 rounded-full"
                style={{ border: '1px solid var(--line)', color: 'var(--ink-soft)' }}
                aria-label={isOpen ? 'Collapse' : 'Expand'}
              >
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div
                className="px-5 py-5 grid gap-6"
                style={{
                  gridTemplateColumns: '1.4fr 1fr',
                  background: 'var(--paper)',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div>
                  <p className="eyebrow mb-2">Items</p>
                  <ul style={{ fontSize: 14 }}>
                    {items.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-center justify-between py-2"
                        style={{ borderBottom: '1px dashed var(--line)' }}
                      >
                        <span>
                          <span className="serif" style={{ fontSize: 15 }}>{it.quantity} × {it.name}</span>
                          <span style={{ color: 'var(--ink-muted)', marginLeft: 8, fontSize: 12 }}>
                            {pkr(it.price)} ea
                          </span>
                        </span>
                        <span className="serif" style={{ fontSize: 15 }}>{pkr(it.line_total)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between pt-3 mt-1">
                    <span className="eyebrow">Total</span>
                    <span className="serif" style={{ fontSize: 22, color: 'var(--terra)' }}>
                      {pkr(o.total)}
                    </span>
                  </div>
                </div>

                <aside className="space-y-3" style={{ fontSize: 13 }}>
                  {o.customer_phone && (
                    <InfoLine
                      label="Phone"
                      value={`+${String(o.customer_phone).replace(/^\+/, '')}`}
                      copy
                    />
                  )}
                  {o.delivery_address && (
                    <InfoLine label="Address" value={o.delivery_address} copy />
                  )}
                  {o.notes && <InfoLine label="Notes" value={o.notes} />}
                  <InfoLine
                    label="Channel"
                    value={o.channel === 'web' ? 'Website' : o.channel}
                  />
                  <InfoLine
                    label="Placed"
                    value={placedAt.toLocaleString('en-PK', {
                      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  />

                  <div className="pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                    <p className="eyebrow mb-2">Payment</p>
                    <PaymentPicker orderId={o.id} current={o.payment_method} />
                  </div>

                  <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                    <Link
                      href={`/r/${o.id}`}
                      target="_blank"
                      className="btn btn-outline btn-sm"
                    >
                      <ExternalLink size={12} /> Receipt
                    </Link>
                    {o.status !== 'cancelled' && o.status !== 'completed' && (
                      <button
                        onClick={() => cancel(o)}
                        disabled={pending}
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--terra-deep)', borderColor: 'rgba(196,69,38,0.3)' }}
                      >
                        <X size={12} /> Cancel
                      </button>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */
// playOrderDing was moved INTO OrdersClient as playDing() so it can share
// a single, lazily-resumed AudioContext per session. Browsers won't play
// from a freshly-created AudioContext until the user has interacted with
// the page — see ensureAudioUnlocked() in the component for the gesture
// hook that calls ctx.resume() on first click / keypress / touch.

const BUBBLE_KEYFRAMES = `
@keyframes brue-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 14px 36px -14px rgba(196,69,38,0.55); }
  50% { transform: scale(1.02); box-shadow: 0 18px 44px -14px rgba(196,69,38,0.7); }
}
@keyframes brue-ring {
  0% { transform: scale(0.6); opacity: 0.9; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes brue-new-row {
  0%, 100% { box-shadow: 0 0 0 4px rgba(196,69,38,0.18); }
  50% { box-shadow: 0 0 0 8px rgba(196,69,38,0.28); }
}
`;


function InfoLine({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {}
  }
  return (
    <div className="flex items-start gap-2">
      <span
        className="shrink-0"
        style={{
          width: 90, fontSize: 10, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'var(--ink-muted)', paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span className="serif flex-1" style={{ fontSize: 15 }}>{value}</span>
      {copy && (
        <button onClick={doCopy} className="p-1" aria-label={`Copy ${label}`}>
          <Copy size={12} style={{ color: 'var(--ink-muted)' }} />
        </button>
      )}
    </div>
  );
}

function PaymentPicker({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = ['unpaid', 'Cash', 'JazzCash', 'Easypaisa', 'NayaPay', 'Card'];
  function set(m: string) {
    start(async () => {
      try {
        await setPayment(orderId, m);
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? 'Could not update payment');
      }
    });
  }
  return (
    <select
      className="select"
      value={current}
      onChange={(e) => set(e.target.value)}
      disabled={pending}
      style={{ padding: '8px 12px', fontSize: 13 }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o === 'unpaid' ? 'Unpaid · on delivery' : o}
        </option>
      ))}
    </select>
  );
}

function SendUpdateButton({ order }: { order: Order }) {
  // Build a WhatsApp deep link the staff taps to send the customer a status update
  // + the receipt URL. No Cloud API required.
  if (!order.customer_phone) {
    return null;
  }
  const receiptUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/r/${order.id}`
    : `/r/${order.id}`;
  const msg = buildStatusMessage(order, receiptUrl);
  const href = `https://wa.me/${sanitizePhone(order.customer_phone)}?text=${encodeURIComponent(msg)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="btn btn-outline btn-sm"
      title="Open WhatsApp with a pre-filled status message"
    >
      <MessageCircle size={12} /> Send update
    </a>
  );
}

function buildStatusMessage(o: Order, receiptUrl: string): string {
  const greet = `Hi ${o.customer_name?.split(' ')[0] || 'there'} 👋`;
  const status =
    o.status === 'accepted'
      ? "We've accepted your order — brewing in a few minutes."
      : o.status === 'preparing'
      ? "Your drinks are being made right now."
      : o.status === 'out'
      ? 'Your order is on its way 🛵'
      : o.status === 'completed'
      ? 'Your order is done — hope you loved it ✿'
      : o.status === 'cancelled'
      ? "We couldn't complete your order. We'll message you to sort it out."
      : 'Small update on your order:';

  return [
    greet,
    '',
    `Order #${o.order_number} · ${status}`,
    '',
    `Receipt: ${receiptUrl}`,
    '',
    '— BRUE',
  ].join('\n');
}

function sanitizePhone(p: string): string {
  return p.replace(/\D+/g, '').replace(/^0+/, '');
}

function minutesAgo(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}
