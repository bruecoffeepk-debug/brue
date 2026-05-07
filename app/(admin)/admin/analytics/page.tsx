// ─────────────────────────────────────────────────────────────
// /admin/analytics — server-rendered conversion dashboard.
//
// Reads `analytics_events` directly via the staff Supabase session
// (RLS lets authenticated users SELECT). All aggregation is done
// in JS against a 30-day window; for higher volume later we'd push
// to a materialised view. Right now BRUE is small enough that a
// few hundred KB of events fits in memory cheaply.
// ─────────────────────────────────────────────────────────────

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ExternalLink, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { pkr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Event = {
  id: string;
  session_id: string;
  event_name: string;
  props: Record<string, any>;
  path: string | null;
  referrer: string | null;
  ip_hash: string | null;
  created_at: string;
};

type Order = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

const FUNNEL_STEPS = [
  { key: 'home_view', label: 'Home / menu visit' },
  { key: 'drink_view', label: 'Opened a drink' },
  { key: 'add_to_cart', label: 'Added to cart' },
  { key: 'cart_open', label: 'Opened cart drawer' },
  { key: 'checkout_continue', label: 'Continued to payment' },
  { key: 'payment_method_pick', label: 'Picked a payment method' },
  { key: 'order_attempt', label: 'Tapped "I’ve paid"' },
  { key: 'order_placed', label: 'Order placed ✓' },
] as const;

const WINDOWS = [
  { id: '24h', label: 'Last 24h', days: 1 },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { w?: string };
}) {
  const win = WINDOWS.find((w) => w.id === searchParams.w) || WINDOWS[1];
  const cutoff = new Date(Date.now() - win.days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createClient();

  const [{ data: events, error: eventsErr }, { data: orders }] = await Promise.all([
    supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(20_000),
    supabase
      .from('orders')
      .select('id, total, status, created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false }),
  ]);

  if (eventsErr) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <h1 className="display" style={{ fontSize: 32 }}>
          Analytics is offline
        </h1>
        <p className="mt-3" style={{ color: 'var(--ink-soft)' }}>
          {eventsErr.message}. Run{' '}
          <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--cream)' }}>
            supabase/migrations/010_analytics.sql
          </code>{' '}
          and reload the schema cache.
        </p>
      </div>
    );
  }

  const allEvents = (events || []) as Event[];
  const allOrders = (orders || []) as Order[];

  // Per-step distinct-session counts (a session is a unique localStorage UUID).
  const sessionsByStep = new Map<string, Set<string>>();
  for (const step of FUNNEL_STEPS) sessionsByStep.set(step.key, new Set());
  for (const e of allEvents) {
    const set = sessionsByStep.get(e.event_name);
    if (set) set.add(e.session_id);
  }
  const stepCounts = FUNNEL_STEPS.map((s) => ({
    ...s,
    count: sessionsByStep.get(s.key)!.size,
  }));

  // Distinct visitors = distinct session_ids overall (any event)
  const distinctSessions = new Set(allEvents.map((e) => e.session_id)).size;
  const distinctIps = new Set(allEvents.map((e) => e.ip_hash).filter(Boolean)).size;

  // Top drinks viewed + added
  const drinkViewCounts = new Map<string, number>();
  const drinkAddCounts = new Map<string, number>();
  for (const e of allEvents) {
    const name = (e.props as any)?.drink_name;
    if (!name) continue;
    if (e.event_name === 'drink_view') {
      drinkViewCounts.set(name, (drinkViewCounts.get(name) || 0) + 1);
    }
    if (e.event_name === 'add_to_cart') {
      drinkAddCounts.set(name, (drinkAddCounts.get(name) || 0) + 1);
    }
  }
  const topDrinks = Array.from(drinkViewCounts.entries())
    .map(([name, views]) => ({
      name,
      views,
      adds: drinkAddCounts.get(name) || 0,
      addRate: views > 0 ? (drinkAddCounts.get(name) || 0) / views : 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Where they drop off — biggest %-drop transitions
  const stepDrops = stepCounts.slice(0, -1).map((s, i) => {
    const next = stepCounts[i + 1];
    const dropped = s.count - next.count;
    const dropPct = s.count > 0 ? dropped / s.count : 0;
    return {
      from: s.label,
      to: next.label,
      fromCount: s.count,
      toCount: next.count,
      dropped,
      dropPct,
    };
  });
  const biggestDrop = [...stepDrops]
    .filter((d) => d.fromCount > 0)
    .sort((a, b) => b.dropPct - a.dropPct)[0];

  // Order stats
  const ordersPlaced = allOrders.length;
  const ordersConfirmed = allOrders.filter(
    (o) => !['pending', 'cancelled'].includes(o.status)
  ).length;
  const revenue = allOrders
    .filter((o) => !['cancelled'].includes(o.status))
    .reduce((s, o) => s + (o.total || 0), 0);

  // Conversion: visit → order
  const homeViewCount = sessionsByStep.get('home_view')!.size;
  const orderConvPct =
    homeViewCount > 0 ? (sessionsByStep.get('order_placed')!.size / homeViewCount) * 100 : 0;

  return (
    <div className="space-y-10">
      {/* Header + window switch */}
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1 className="display mt-2" style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)' }}>
            What&apos;s <span className="ital">working</span>?
          </h1>
          <p className="mt-2" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            Anonymous visitor funnel. Sessions are 30-day localStorage UUIDs;
            no PII is stored against events.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-full"
          style={{ background: 'var(--cream)', padding: 4 }}
        >
          {WINDOWS.map((w) => (
            <Link
              key={w.id}
              href={`/admin/analytics?w=${w.id}`}
              className="px-3.5 py-1.5 rounded-full text-[12px] transition-colors"
              style={
                w.id === win.id
                  ? { background: 'var(--ink)', color: 'var(--bone)' }
                  : { color: 'var(--ink-soft)' }
              }
            >
              {w.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Top stat row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat label="Visitors" value={distinctSessions.toLocaleString()} sub={`${distinctIps} unique IPs`} />
        <Stat label="Drink views" value={(sessionsByStep.get('drink_view')?.size ?? 0).toLocaleString()} />
        <Stat label="Carts started" value={(sessionsByStep.get('add_to_cart')?.size ?? 0).toLocaleString()} />
        <Stat label="Orders placed" value={ordersPlaced.toLocaleString()} sub={`${ordersConfirmed} confirmed`} />
        <Stat label="Revenue" value={pkr(revenue)} highlight />
        <Stat
          label="Visit → order"
          value={`${orderConvPct.toFixed(2)}%`}
          sub={ordersPlaced === 0 ? 'no orders yet' : 'conversion'}
        />
      </div>

      {/* Funnel */}
      <section
        className="rounded-2xl"
        style={{
          background: 'var(--bone)',
          border: '1px solid var(--line)',
          padding: 'clamp(20px, 3vw, 32px)',
        }}
      >
        <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
          <div>
            <span className="eyebrow">Funnel · last {win.label.toLowerCase().replace('last ', '')}</span>
            <h2 className="display mt-1" style={{ fontSize: 30 }}>
              How far they <span className="ital">get</span>.
            </h2>
          </div>
          {biggestDrop && biggestDrop.dropPct > 0 && (
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(196,69,38,0.1)',
                color: 'var(--terra-deep)',
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              <TrendingUp size={11} />
              Biggest drop: {biggestDrop.from} → {biggestDrop.to} ({Math.round(biggestDrop.dropPct * 100)}%)
            </span>
          )}
        </div>

        <ol className="space-y-2">
          {stepCounts.map((s, i) => {
            const max = stepCounts[0]?.count || 1;
            const pct = max > 0 ? (s.count / max) * 100 : 0;
            const prev = i === 0 ? null : stepCounts[i - 1];
            const dropPct = prev && prev.count > 0 ? ((prev.count - s.count) / prev.count) * 100 : 0;
            return (
              <li
                key={s.key}
                className="grid items-center gap-4"
                style={{ gridTemplateColumns: '170px 1fr 80px 90px' }}
              >
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{s.label}</span>
                <div
                  className="relative overflow-hidden"
                  style={{
                    background: 'var(--cream)',
                    borderRadius: 10,
                    height: 28,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${pct}%`,
                      background:
                        s.key === 'order_placed'
                          ? 'var(--sage)'
                          : 'var(--terra)',
                      borderRadius: 10,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <span
                  className="serif"
                  style={{ fontSize: 18, textAlign: 'right' }}
                >
                  {s.count.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    textAlign: 'right',
                    color: dropPct > 50 ? 'var(--terra-deep)' : 'var(--ink-muted)',
                    fontWeight: dropPct > 50 ? 600 : 400,
                  }}
                >
                  {i === 0 ? '—' : dropPct > 0 ? `−${dropPct.toFixed(0)}%` : '0%'}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Top drinks */}
      <section
        className="rounded-2xl"
        style={{
          background: 'var(--bone)',
          border: '1px solid var(--line)',
          padding: 'clamp(20px, 3vw, 32px)',
        }}
      >
        <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
          <div>
            <span className="eyebrow">Top drinks</span>
            <h2 className="display mt-1" style={{ fontSize: 30 }}>
              Most <span className="ital">viewed</span>.
            </h2>
          </div>
        </div>

        {topDrinks.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>
            No drink-view events yet — share the site and check back.
          </p>
        ) : (
          <table className="w-full" style={{ fontSize: 14 }}>
            <thead>
              <tr style={{ color: 'var(--ink-muted)' }}>
                <th className="text-left pb-3" style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Drink
                </th>
                <th className="text-right pb-3" style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Views
                </th>
                <th className="text-right pb-3" style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Adds
                </th>
                <th className="text-right pb-3" style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Add rate
                </th>
              </tr>
            </thead>
            <tbody>
              {topDrinks.map((d) => (
                <tr key={d.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="py-2.5 serif" style={{ fontSize: 15 }}>{d.name}</td>
                  <td className="py-2.5 text-right">{d.views.toLocaleString()}</td>
                  <td className="py-2.5 text-right">{d.adds.toLocaleString()}</td>
                  <td
                    className="py-2.5 text-right serif"
                    style={{
                      fontSize: 14,
                      color: d.addRate >= 0.3
                        ? 'var(--sage)'
                        : d.addRate >= 0.1
                        ? 'var(--ink)'
                        : 'var(--ink-muted)',
                    }}
                  >
                    {(d.addRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Recommendations */}
      <Recommendations
        ordersPlaced={ordersPlaced}
        distinctSessions={distinctSessions}
        addToCarts={sessionsByStep.get('add_to_cart')?.size ?? 0}
        biggestDrop={biggestDrop}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl"
      style={{
        background: highlight ? 'var(--ink)' : 'var(--bone)',
        color: highlight ? 'var(--bone)' : 'var(--ink)',
        border: '1px solid var(--line)',
        padding: '18px 20px',
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: highlight ? 'rgba(252,247,235,0.65)' : 'var(--ink-muted)',
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        className="serif mt-1.5"
        style={{
          fontSize: 30,
          letterSpacing: '-0.02em',
          color: highlight ? 'var(--mustard)' : 'var(--ink)',
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="mt-1"
          style={{
            fontSize: 11,
            color: highlight ? 'rgba(252,247,235,0.55)' : 'var(--ink-muted)',
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─── recommendations ─── */
function Recommendations({
  ordersPlaced,
  distinctSessions,
  addToCarts,
  biggestDrop,
}: {
  ordersPlaced: number;
  distinctSessions: number;
  addToCarts: number;
  biggestDrop?: {
    from: string;
    to: string;
    dropPct: number;
  };
}) {
  // Branch the messaging based on what we see in the data.
  const noTraffic = distinctSessions < 20;
  const trafficNoCarts = distinctSessions >= 20 && addToCarts < 5;
  const cartsNoOrders = addToCarts >= 5 && ordersPlaced < 3;

  return (
    <section
      className="rounded-2xl grain"
      style={{
        background: 'linear-gradient(160deg, #fcf7eb 0%, #f3e1d0 100%)',
        border: '1px solid var(--line)',
        padding: 'clamp(24px, 4vw, 40px)',
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--terra)',
            color: 'var(--bone)',
          }}
        >
          <Sparkles size={16} />
        </span>
        <h2 className="display" style={{ fontSize: 28 }}>
          What to <span className="ital">try</span> next
        </h2>
      </div>

      <p className="mb-6" style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, maxWidth: 620 }}>
        Personalised based on what your funnel shows. Tackle these top-down —
        the bottleneck moves as you fix the leak above it.
      </p>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        {/* THIS WEEK — top priority based on data */}
        {noTraffic && (
          <RecCard
            urgency="now"
            title="0 → 100 visitors this week"
            steps={[
              'WhatsApp blast to your contacts: link to bruecoffeepk.com + LAUNCH25 promo (bigger than 15% so people actually click)',
              'Instagram stories: post the /promo/reel.html order-flow loop, tag @bruecoffeepk',
              '5 Instagram posts: 1 hero shot + 4 individual drink photos (Espresso Tonic, Strawberry Mocha, Tiramisu Affogato + Brownie sell most)',
              'Get 5 friends to place real orders + post on their stories — social proof matters more than ads',
              'Add the website link to your Google Maps / Facebook profile + the bio of every staff member',
            ]}
          />
        )}
        {trafficNoCarts && (
          <RecCard
            urgency="now"
            title="People are visiting but not adding"
            steps={[
              'Your photos are doing the work — make sure every drink has the real product shot, no placeholders',
              'Add a "Today\'s specials" sticker overlay on 2–3 drinks at the top of /home',
              'First order discount needs to scream — bump BRUE15 → LAUNCH25 (25% off, first order only) for 2 weeks',
              'Add a sticky "Order now · 15% off first order" banner under the hero',
            ]}
          />
        )}
        {cartsNoOrders && biggestDrop && (
          <RecCard
            urgency="now"
            title={`Fix the ${biggestDrop.from} → ${biggestDrop.to} drop`}
            steps={[
              `${Math.round(biggestDrop.dropPct * 100)}% of people drop here. That's the single biggest unlock.`,
              biggestDrop.to.toLowerCase().includes('payment')
                ? 'People hesitate at "Continue to payment" — make sure the total + delivery method are visible above the fold'
                : biggestDrop.to.toLowerCase().includes('paid')
                ? 'They picked a method but didn\'t pay. Likely friction = the IBAN copy isn\'t convincing. Add a "Pay any amount, we\'ll match" trust line, and a screenshot of how the QR works'
                : 'Audit this step on a real phone — record yourself ordering, screen-share with a friend, find the friction',
              'Add a "Need help? WhatsApp us now" link at the bottom of every checkout step — recovers ~30% of bouncers',
            ]}
          />
        )}

        {/* EVERGREEN — always show */}
        <RecCard
          urgency="next 2 weeks"
          title="Local micro-influencers"
          steps={[
            'List 5 Karachi food bloggers in the 1k–10k follower range (e.g. @karachifoodtour, @khaikhaikarachi)',
            'DM each: comp them 2 drinks + brownie in exchange for one Story post',
            'Repost every story on @bruecoffeepk — borrowed credibility compounds',
            'Total cost ≈ PKR 5–8k delivery, returns 100x in reach if even 2 post',
          ]}
        />
        <RecCard
          urgency="next 2 weeks"
          title="foodpanda + Careem listing"
          steps={[
            'Apply at partner.foodpanda.com.pk and partner-pk.careem.com',
            'They handle delivery + bring discovery traffic',
            'Listing fees are commission-based — 0 upfront cost',
            'Use foodpanda first (bigger Karachi market share)',
          ]}
        />
        <RecCard
          urgency="month 1"
          title="Loyalty + retention"
          steps={[
            'Auto-WhatsApp 1 day after delivery: "How was it? Reply YES for 10% off your next order"',
            'Punch-card style: every 10th drink free (track via customer phone in /admin)',
            'Pin the BRUE15 promo card in every physical order — it converts walk-ins to web',
            'Post-order receipt page already has WhatsApp + receipt — push for repeat orders within 3 days',
          ]}
        />
        <RecCard
          urgency="data-driven"
          title="Test what works"
          steps={[
            'This dashboard updates every visit. Watch the funnel weekly',
            'A/B by changing ONE thing per week (hero copy, promo amount, drink order on the menu)',
            'Top drink with low add-rate? Bad photo or bad price — fix one',
            'High home views but low menu views? Hero CTA isn\'t obvious enough',
          ]}
        />
      </div>

      <div
        className="mt-6 flex items-center gap-3 flex-wrap"
        style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}
      >
        <Link href="/admin/drinks" className="btn btn-outline btn-sm">
          <ShoppingBag size={12} /> Update drinks
        </Link>
        <Link href="/admin/orders" className="btn btn-outline btn-sm">
          <ArrowUpRight size={12} /> Orders dashboard
        </Link>
        <Link href="/promo/reel.html" target="_blank" className="btn btn-outline btn-sm">
          <ExternalLink size={12} /> Promo reel
        </Link>
      </div>
    </section>
  );
}

function RecCard({
  urgency,
  title,
  steps,
}: {
  urgency: string;
  title: string;
  steps: string[];
}) {
  return (
    <div
      className="rounded-xl"
      style={{
        background: 'var(--bone)',
        border: '1px solid var(--line)',
        padding: 22,
      }}
    >
      <span
        className="inline-block"
        style={{
          fontSize: 9,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: urgency === 'now' ? 'var(--terra-deep)' : 'var(--ink-muted)',
          background: urgency === 'now' ? 'rgba(196,69,38,0.1)' : 'rgba(28,23,18,0.05)',
          padding: '4px 10px',
          borderRadius: 999,
        }}
      >
        {urgency}
      </span>
      <h3 className="serif mt-3" style={{ fontSize: 18, lineHeight: 1.25 }}>
        {title}
      </h3>
      <ul className="mt-3 space-y-2" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <ArrowRight size={11} className="shrink-0" style={{ color: 'var(--terra)', marginTop: 5 }} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
