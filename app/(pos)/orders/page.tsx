import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { pkr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="sticker text-sage border-sage mb-3">Last 200</span>
          <h1 className="h-display text-5xl mt-3">Orders</h1>
        </div>
        <Link href="/pos" className="btn-primary">
          New Order <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="bg-cream rounded-3xl border-[1.5px] border-charcoal/10 overflow-hidden">
        {(!orders || orders.length === 0) ? (
          <p className="text-charcoal/50 text-center py-16">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-deep-sand text-charcoal/60 uppercase tracking-widest text-xs">
              <tr>
                <th className="text-left p-4">#</th>
                <th className="text-left p-4">Customer</th>
                <th className="text-left p-4 hidden md:table-cell">Type</th>
                <th className="text-left p-4 hidden md:table-cell">Payment</th>
                <th className="text-left p-4 hidden md:table-cell">Channel</th>
                <th className="text-right p-4">Total</th>
                <th className="text-left p-4">When</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} className="border-t border-charcoal/5 hover:bg-sand/50 transition">
                  <td className="p-4 font-semibold">
                    <Link href={`/orders/${o.id}`} className="hover:text-terracotta">
                      #{o.order_number}
                    </Link>
                  </td>
                  <td className="p-4">{o.customer_name || 'Walk-in'}</td>
                  <td className="p-4 hidden md:table-cell capitalize">{o.order_type}</td>
                  <td className="p-4 hidden md:table-cell">{o.payment_method}</td>
                  <td className="p-4 hidden md:table-cell">
                    <span className={`sticker !text-[10px] !py-1 ${o.channel === 'whatsapp' ? 'text-sage border-sage' : 'text-terracotta border-terracotta'}`}>
                      {o.channel}
                    </span>
                  </td>
                  <td className="p-4 text-right font-semibold text-terracotta">{pkr(o.total)}</td>
                  <td className="p-4 text-charcoal/60">
                    {new Date(o.created_at).toLocaleString('en-PK', {
                      hour: 'numeric',
                      minute: 'numeric',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
