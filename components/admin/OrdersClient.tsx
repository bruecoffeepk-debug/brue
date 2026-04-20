'use client';

import { useTransition, useState } from 'react';
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
} from 'lucide-react';
import { pkr } from '@/lib/utils';
import { setStatus, setPayment } from '@/app/(admin)/admin/orders/actions';

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

  function advance(o: Order) {
    const flow = STATUS_FLOW[o.status];
    if (!flow) return;
    start(async () => {
      try {
        await setStatus(o.id, flow.next);
        router.refresh();
      } catch (e: any) {
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

  if (orders.length === 0) {
    return (
      <div
        className="text-center py-20 rounded-xl"
        style={{ background: 'var(--paper)', border: '1px dashed var(--line-strong)' }}
      >
        <p className="serif italic" style={{ fontSize: 22, color: 'var(--ink-soft)' }}>
          No orders here yet.
        </p>
        <p className="mt-2" style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
          When a customer places an order on /menu, it lands here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const meta = STATUS_META[o.status] ?? STATUS_META.pending;
        const Icon = meta.icon;
        const flow = STATUS_FLOW[o.status];
        const items = itemsByOrder[o.id] ?? [];
        const isOpen = expanded === o.id;
        const placedAt = new Date(o.created_at);
        const age = minutesAgo(placedAt);

        return (
          <div
            key={o.id}
            className="relative overflow-hidden"
            style={{
              background: 'var(--bone)',
              border: '1px solid var(--line)',
              borderLeft: `4px solid ${meta.color}`,
              borderRadius: 14,
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
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

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
