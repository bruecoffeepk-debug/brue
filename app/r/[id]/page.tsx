import { notFound } from 'next/navigation';
import { Printer, MessageCircle, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { pkr } from '@/lib/utils';
import { SHOP } from '@/lib/shop';
import PrintButton from './PrintButton';
import Wordmark from '@/components/brand/Wordmark';
import Flower from '@/components/brand/Flower';

export const dynamic = 'force-dynamic';

// Metadata: keep receipts out of search engines.
export const metadata = {
  title: 'BRUE · Receipt',
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  pending:    { text: 'Order received',   color: 'var(--terra-deep)', bg: 'rgba(196,69,38,0.12)' },
  accepted:   { text: 'Accepted · brewing', color: 'var(--sage)',       bg: 'rgba(107,122,83,0.16)' },
  preparing:  { text: 'Making your drinks', color: 'var(--sage)',       bg: 'rgba(107,122,83,0.16)' },
  out:        { text: 'Out for delivery',   color: '#7a560f',            bg: 'rgba(212,151,46,0.18)' },
  completed:  { text: 'Delivered · enjoy!', color: 'var(--sage)',       bg: 'rgba(107,122,83,0.16)' },
  cancelled:  { text: 'Cancelled',          color: 'var(--terra-deep)', bg: 'rgba(196,69,38,0.12)' },
};

export default async function Receipt({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', params.id);

  const status = STATUS_LABEL[order.status as string] ?? STATUS_LABEL.pending;
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const placedAt = new Date(order.created_at);

  return (
    <>
      {/* print-only CSS — hides the header/footer chrome when saving as PDF */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { margin: 14mm; size: A4; }
              body { background: #fff !important; }
              .no-print { display: none !important; }
              .print-paper { box-shadow: none !important; border-radius: 0 !important; }
            }
          `,
        }}
      />

      <main
        className="grain min-h-screen flex items-center justify-center px-5 py-10"
        style={{ background: 'var(--paper)' }}
      >
        <div className="max-w-[640px] w-full">
          {/* Top bar with actions — hidden on print */}
          <div className="no-print flex items-center justify-between mb-5">
            <a
              href="/home"
              className="inline-flex items-center gap-2"
              style={{ fontSize: 13, color: 'var(--ink-soft)' }}
            >
              <Wordmark tone="terra" size={22} />
            </a>
            <div className="flex items-center gap-2">
              <PrintButton />
              {wa && (
                <a
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(
                    `Hi BRUE — checking on order #${order.order_number}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <MessageCircle size={12} /> WhatsApp
                </a>
              )}
            </div>
          </div>

          <div
            className="print-paper relative overflow-hidden"
            style={{
              background: 'var(--bone)',
              borderRadius: 18,
              boxShadow: '0 36px 80px -30px rgba(28,23,18,0.28)',
              padding: 'clamp(28px, 5vw, 48px)',
              border: '1px solid var(--line)',
            }}
          >
            {/* Status chip */}
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: status.bg,
                color: status.color,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: status.color }} />
              {status.text}
            </span>

            {/* Heading */}
            <div className="mt-5 flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 5.2vw, 4rem)' }}>
                  Order <span className="ital">№ {order.order_number}</span>
                </h1>
                <p
                  className="mt-1 serif italic"
                  style={{ fontSize: 16, color: 'var(--ink-soft)' }}
                >
                  for {order.customer_name || 'Walk-in'}
                </p>
              </div>
              <div className="text-right">
                <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                  Placed
                </p>
                <p className="serif" style={{ fontSize: 16 }}>
                  {placedAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="serif" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
                  {placedAt.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div
              className="my-7"
              style={{ borderTop: '1.5px dashed var(--line-strong)' }}
            />

            {/* Items table */}
            <table className="w-full" style={{ fontSize: 14 }}>
              <thead>
                <tr style={{ color: 'var(--ink-muted)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  <th className="text-left pb-3">Item</th>
                  <th className="text-right pb-3">Qty</th>
                  <th className="text-right pb-3">Price</th>
                  <th className="text-right pb-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map((it: any) => (
                  <tr key={it.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="py-3 serif" style={{ fontSize: 15 }}>{it.name}</td>
                    <td className="py-3 text-right">{it.quantity}</td>
                    <td className="py-3 text-right" style={{ color: 'var(--ink-soft)' }}>
                      {pkr(it.price)}
                    </td>
                    <td className="py-3 text-right serif" style={{ fontSize: 15 }}>
                      {pkr(it.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div
              className="mt-6 ml-auto"
              style={{ maxWidth: 280, borderTop: '1.5px dashed var(--line-strong)', paddingTop: 14 }}
            >
              <Row label="Subtotal" value={pkr(order.subtotal)} />
              {order.discount > 0 && (
                <Row label="Discount" value={`− ${pkr(order.discount)}`} tone="sage" />
              )}
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 12 }}>
                <div className="flex items-baseline justify-between">
                  <span
                    style={{
                      fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
                      color: 'var(--ink-muted)', fontWeight: 500,
                    }}
                  >
                    Total
                  </span>
                  <span
                    className="serif"
                    style={{ fontSize: 34, letterSpacing: '-0.02em', color: 'var(--terra)' }}
                  >
                    {pkr(order.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Order details */}
            <div
              className="mt-8 grid gap-5"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                borderTop: '1.5px dashed var(--line-strong)',
                paddingTop: 22,
              }}
            >
              <Detail label="Type" value={prettyType(order.order_type)} />
              {order.delivery_method && (
                <Detail label="Delivery" value={prettyMethod(order.delivery_method)} />
              )}
              {order.delivery_distance_km != null && (
                <Detail label="Distance" value={`${order.delivery_distance_km} km`} />
              )}
              <Detail label="Payment" value={order.payment_method === 'unpaid' ? 'On delivery' : order.payment_method} />
              {order.customer_phone && (
                <Detail label="Phone" value={`+${String(order.customer_phone).replace(/^\+/, '')}`} />
              )}
              {order.delivery_address && (
                <Detail label="Address" value={order.delivery_address} wide />
              )}
              {order.notes && <Detail label="Notes" value={order.notes} wide />}
            </div>

            {/* Footer */}
            <div
              className="mt-8 flex items-center justify-between flex-wrap gap-3"
              style={{ borderTop: '1.5px dashed var(--line-strong)', paddingTop: 22 }}
            >
              <div>
                <Wordmark tone="terra" size={24} />
                <p
                  className="mt-1.5"
                  style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}
                >
                  <MapPin size={10} className="inline mr-1" />
                  {SHOP.name} · {SHOP.city}
                </p>
              </div>
              <p
                className="script inline-flex items-center gap-2"
                style={{ color: 'var(--terra)', fontSize: 24, transform: 'rotate(-2deg)' }}
              >
                thanks, {order.customer_name?.split(' ')[0] || 'friend'}
                <Flower size={18} color="var(--terra)" centerColor="var(--mustard, #d4972e)" />
              </p>
            </div>
          </div>

          {/* Tip line */}
          <p
            className="no-print mt-5 text-center"
            style={{ color: 'var(--ink-muted)', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}
          >
            <Printer size={12} className="inline mr-1" />
            Print to save as PDF
          </p>
        </div>
      </main>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'sage' }) {
  return (
    <div className="flex justify-between items-baseline py-1.5" style={{ fontSize: 14 }}>
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span className="serif" style={{ color: tone === 'sage' ? 'var(--sage)' : 'var(--ink)' }}>
        {value}
      </span>
    </div>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <p
        style={{
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--ink-muted)', fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p className="serif mt-1" style={{ fontSize: 15, color: 'var(--ink)' }}>
        {value}
      </p>
    </div>
  );
}

function prettyType(t: string): string {
  if (t === 'delivery') return 'Delivery';
  if (t === 'pickup') return 'Pickup';
  return t;
}
function prettyMethod(m: string): string {
  return ({ bykea: 'Bykea', indrive: 'inDrive', whatsapp: 'WhatsApp' } as any)[m] || m;
}
