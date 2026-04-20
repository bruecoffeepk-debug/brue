import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Coffee, DollarSign, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { pkr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = createClient();

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [
    { data: monthOrders },
    { data: todayOrders },
    { data: recent },
    { data: monthExpenses },
    { data: monthItems },
  ] = await Promise.all([
    supabase.from('orders').select('total, created_at').gte('created_at', monthStart),
    supabase.from('orders').select('total').gte('created_at', startOfToday),
    supabase
      .from('orders')
      .select('id, order_number, customer_name, total, payment_method, created_at, status, channel')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('expenses').select('amount').gte('spent_at', monthStart.slice(0, 10)),
    supabase
      .from('order_items')
      .select('name, quantity, line_total, cost, orders!inner(created_at)')
      .gte('orders.created_at', monthStart),
  ]);

  const monthRevenue = (monthOrders || []).reduce((s, o: any) => s + (o.total || 0), 0);
  const todayRevenue = (todayOrders || []).reduce((s, o: any) => s + (o.total || 0), 0);
  const expenseTotal = (monthExpenses || []).reduce((s, e: any) => s + (e.amount || 0), 0);

  const cogs = (monthItems || []).reduce(
    (s, r: any) => s + (r.cost || 0) * (r.quantity || 0),
    0
  );
  const profit = monthRevenue - cogs - expenseTotal;

  // Top items
  const tally: Record<string, { qty: number; revenue: number }> = {};
  for (const r of monthItems || []) {
    const key = (r as any).name as string;
    tally[key] = tally[key] || { qty: 0, revenue: 0 };
    tally[key].qty += (r as any).quantity || 0;
    tally[key].revenue += (r as any).line_total || 0;
  }
  const topItems = Object.entries(tally)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 6);

  const stats = [
    { label: "Today's revenue", value: pkr(todayRevenue), icon: DollarSign, color: 'bg-terracotta', tone: 'text-cream' },
    { label: 'Month revenue', value: pkr(monthRevenue), icon: TrendingUp, color: 'bg-charcoal', tone: 'text-cream' },
    { label: 'Month expenses', value: pkr(expenseTotal), icon: Wallet, color: 'bg-amber', tone: 'text-charcoal' },
    { label: 'Month profit', value: pkr(profit), icon: ShoppingBag, color: 'bg-sage', tone: 'text-cream' },
  ];

  return (
    <div>
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="sticker text-sage border-sage mb-3">
            {today.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <h1 className="h-display text-5xl mt-3">Dashboard</h1>
        </div>
        <Link href="/pos" className="btn-primary">
          New Order <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, tone }) => (
          <div key={label} className={`${color} ${tone} rounded-3xl p-6 relative overflow-hidden grain`}>
            <Icon size={24} className="opacity-60 mb-8" />
            <p className="text-xs uppercase tracking-widest opacity-70">{label}</p>
            <p className="h-display text-3xl mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <section className="bg-cream rounded-3xl p-6 border-[1.5px] border-charcoal/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="h-display text-2xl">Top Items (Month)</h2>
            <Coffee size={18} className="text-terracotta" />
          </div>
          {topItems.length === 0 ? (
            <p className="text-charcoal/50 text-sm py-8 text-center">No orders yet this month.</p>
          ) : (
            <ol className="space-y-3">
              {topItems.map(([name, t], i) => {
                const max = topItems[0][1].qty;
                const pct = (t.qty / max) * 100;
                return (
                  <li key={name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">
                        <span className="text-charcoal/40 mr-2">{String(i + 1).padStart(2, '0')}</span>
                        {name}
                      </span>
                      <span className="text-charcoal/60">
                        {t.qty} · {pkr(t.revenue)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-deep-sand overflow-hidden">
                      <div className="h-full bg-terracotta rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="bg-cream rounded-3xl p-6 border-[1.5px] border-charcoal/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="h-display text-2xl">Recent Orders</h2>
            <Link href="/orders" className="text-xs uppercase tracking-widest text-terracotta">All →</Link>
          </div>
          {(!recent || recent.length === 0) ? (
            <p className="text-charcoal/50 text-sm py-8 text-center">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-charcoal/5">
              {recent.map((o: any) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex items-center justify-between py-3 hover:bg-sand/50 rounded-xl px-2 -mx-2 transition">
                    <div>
                      <p className="font-semibold">
                        #{o.order_number} · {o.customer_name || 'Walk-in'}
                      </p>
                      <p className="text-xs text-charcoal/50">
                        {new Date(o.created_at).toLocaleString('en-PK', { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' })}
                        {' · '}
                        {o.payment_method}
                        {o.channel === 'whatsapp' && ' · WhatsApp'}
                      </p>
                    </div>
                    <span className="h-display text-xl text-terracotta">{pkr(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-12 text-center text-charcoal/30">
        <Image src="/Brue_DP_Orange.png" alt="" width={100} height={32} className="h-7 w-auto mx-auto opacity-30" />
      </div>
    </div>
  );
}
