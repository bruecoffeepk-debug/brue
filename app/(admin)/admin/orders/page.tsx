import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import OrdersClient from '@/components/admin/OrdersClient';

export const dynamic = 'force-dynamic';

type Tab = 'queue' | 'today' | 'all';

async function load(tab: Tab) {
  const supabase = createClient();
  let q = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (tab === 'queue') {
    q = q.in('status', ['pending', 'accepted', 'preparing', 'out']);
  } else if (tab === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    q = q.gte('created_at', start.toISOString()).limit(100);
  } else {
    q = q.limit(200);
  }

  const { data: orders } = await q;
  // pull items in one round trip
  const ids = (orders || []).map((o: any) => o.id);
  let itemsByOrder: Record<string, any[]> = {};
  if (ids.length) {
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', ids);
    for (const it of items ?? []) {
      (itemsByOrder[(it as any).order_id] ||= []).push(it);
    }
  }
  return { orders: orders ?? [], itemsByOrder };
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { tab?: Tab };
}) {
  const tab: Tab = searchParams?.tab ?? 'queue';
  const { orders, itemsByOrder } = await load(tab);

  return (
    <div className="px-10 py-12 max-w-[1200px]">
      <header className="flex items-end justify-between gap-6 mb-8 flex-wrap">
        <div>
          <span className="eyebrow">Live · orders from the menu + WhatsApp</span>
          <h1 className="display mt-3" style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4rem)' }}>
            <span className="ital">Orders</span>.
          </h1>
          <p className="mt-2" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            Accept, mark ready, mark out, complete. Each move updates the customer's receipt
            page in real time — tap "Send update" to WhatsApp them the link.
          </p>
        </div>

        <nav
          className="inline-flex p-1 rounded-full"
          style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
        >
          {(['queue', 'today', 'all'] as Tab[]).map((t) => (
            <Link
              key={t}
              href={`/admin/orders?tab=${t}`}
              className="px-4 py-1.5 rounded-full text-[12px]"
              style={{
                background: tab === t ? 'var(--ink)' : 'transparent',
                color: tab === t ? 'var(--bone)' : 'var(--ink-soft)',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              {t === 'queue' ? `Queue · ${orders.length}` : t === 'today' ? 'Today' : 'All'}
            </Link>
          ))}
        </nav>
      </header>

      <OrdersClient orders={orders as any} itemsByOrder={itemsByOrder} />
    </div>
  );
}
