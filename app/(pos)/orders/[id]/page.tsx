import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { pkr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OrderDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: order } = await supabase.from('orders').select('*').eq('id', params.id).single();
  if (!order) notFound();
  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', params.id);

  return (
    <div>
      <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-charcoal/60 mb-6 hover:text-terracotta">
        <ArrowLeft size={14} /> Back to orders
      </Link>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div className="bg-cream rounded-3xl border-[1.5px] border-charcoal/10 p-6 md:p-8">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
            <div>
              <span className="sticker text-sage border-sage mb-2">Order #{order.order_number}</span>
              <h1 className="h-display text-4xl mt-3">
                {order.customer_name || 'Walk-in'}
              </h1>
              <p className="text-charcoal/60 text-sm">
                {new Date(order.created_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
            <Link href={`/receipt/${order.id}`} className="btn-dark !text-xs !py-2 !px-4">
              <Printer size={14} /> Receipt
            </Link>
          </div>

          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-charcoal/60">
              <tr>
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((it: any) => (
                <tr key={it.id} className="border-t border-charcoal/5">
                  <td className="py-3">{it.name}</td>
                  <td className="py-3 text-right">{it.quantity}</td>
                  <td className="py-3 text-right">{pkr(it.price)}</td>
                  <td className="py-3 text-right font-semibold">{pkr(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-charcoal/60">Subtotal</span><span>{pkr(order.subtotal)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sage"><span>Discount</span><span>−{pkr(order.discount)}</span></div>
            )}
            <div className="dotted-rule my-2 text-charcoal" />
            <div className="flex justify-between items-end">
              <span className="text-charcoal/60 uppercase tracking-widest text-xs">Total</span>
              <span className="h-display text-3xl text-terracotta">{pkr(order.total)}</span>
            </div>
          </div>
        </div>

        <aside className="bg-cream rounded-3xl border-[1.5px] border-charcoal/10 p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-charcoal/50">Type</p>
            <p className="font-semibold capitalize">{order.order_type}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-charcoal/50">Payment</p>
            <p className="font-semibold">{order.payment_method}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-charcoal/50">Channel</p>
            <p className="font-semibold capitalize">{order.channel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-charcoal/50">Status</p>
            <p className="font-semibold capitalize">{order.status}</p>
          </div>
          {order.customer_phone && (
            <div>
              <p className="text-xs uppercase tracking-widest text-charcoal/50">Phone</p>
              <p className="font-semibold">{order.customer_phone}</p>
            </div>
          )}
          {order.delivery_address && (
            <div>
              <p className="text-xs uppercase tracking-widest text-charcoal/50">Address</p>
              <p className="font-semibold">{order.delivery_address}</p>
            </div>
          )}
          {order.notes && (
            <div>
              <p className="text-xs uppercase tracking-widest text-charcoal/50">Notes</p>
              <p className="font-medium text-charcoal/80">{order.notes}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
