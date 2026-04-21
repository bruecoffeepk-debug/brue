import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { pkr } from '@/lib/utils';
import type { DrinkWithCategory } from '@/lib/utils';

// Debug: force-dynamic so every request hits Supabase fresh. Swap back to
// `export const revalidate = 60` for ISR once stable.
export const dynamic = 'force-dynamic';

async function getFeatured(): Promise<DrinkWithCategory[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('menu_items')
    .select('*, categories ( id, name, slug, emoji )')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(8);
  return (data ?? []) as any;
}

async function getStats() {
  const supabase = createClient();
  const [{ count: drinks }, { data: cheapest }] = await Promise.all([
    supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase
      .from('menu_items')
      .select('price')
      .eq('active', true)
      .order('price', { ascending: true })
      .limit(1),
  ]);
  return {
    drinks: drinks ?? 0,
    startingFrom: cheapest?.[0]?.price ?? 540,
  };
}

export default async function HomePage() {
  const [featured, stats] = await Promise.all([getFeatured(), getStats()]);

  return (
    <>
      {/* ─── HERO ─────────────────────────────────────────── */}
      <section
        className="grain relative overflow-hidden"
        style={{ background: 'var(--bone)', minHeight: '100vh' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(900px 600px at 95% 20%, rgba(196,69,38,0.07), transparent 60%)',
          }}
        />
        <div className="relative z-[2] max-w-[1400px] mx-auto px-7 lg:px-10 pt-44 pb-24">
          <div className="grid gap-16 items-center md:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="flex items-center gap-3 mb-7">
                <span style={{ height: 1, width: 44, background: 'var(--line-strong)' }} />
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--terra)',
                  }}
                />
                <span className="eyebrow">Est. 2021 · Karachi · No. 001</span>
              </div>

              <h1 className="display" style={{ fontSize: 'clamp(3.6rem, 7.4vw, 7.6rem)' }}>
                Cold coffee,<br />
                <span className="ital">slowly</span><br />
                brewed <span className="amp">&amp;</span> <span className="ital">poured</span>.
              </h1>

              <p
                className="mt-7"
                style={{ maxWidth: 480, color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.65 }}
              >
                Fifty drinks, cold-pressed juices, single-origin espresso — made on{' '}
                <span style={{ color: 'var(--terra)' }}>Voglia beans</span>,{' '}
                <span style={{ color: 'var(--terra)' }}>Monin syrups</span> and{' '}
                <span style={{ color: 'var(--terra)' }}>Dayfresh milk</span>.
              </p>

              <div className="flex gap-11 mt-8 pt-6" style={{ borderTop: '1px solid var(--line)' }}>
                <Stat num={stats.drinks} suffix="drinks" italic />
                <Stat num={`PKR ${stats.startingFrom}`} suffix="starting at" />
                <Stat num="8 — 12" suffix="open every day" />
              </div>

              <div className="flex gap-3 items-center flex-wrap mt-8">
                <Link href="/menu" className="btn btn-primary">
                  See the Menu <span className="arrow">→</span>
                </Link>
                <Link href="/find-us" className="btn btn-outline">
                  Find a Store
                </Link>
                <span
                  className="script ml-2"
                  style={{
                    fontSize: 20,
                    color: 'var(--terra)',
                    transform: 'rotate(-3deg)',
                    display: 'inline-block',
                  }}
                >
                  cold-pressed daily
                </span>
              </div>
            </div>

            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ─── FEATURED DRINKS ─────────────────────────────── */}
      <section className="grain" style={{ background: 'var(--paper)', padding: '90px 0 110px' }}>
        <div className="relative z-[2] max-w-[1400px] mx-auto px-7 lg:px-10">
          <div className="flex items-end justify-between gap-8 mb-12 flex-wrap">
            <div>
              <span className="chip">
                <span className="dot" />
                The Line-up · {stats.drinks} drinks
              </span>
              <h2 className="display mt-5" style={{ fontSize: 'clamp(2.8rem, 5.6vw, 5rem)' }}>
                What&apos;s <span className="ital">brewing</span>
                <br />
                this <span className="ital">week</span>.
              </h2>
            </div>
            <div className="max-w-md">
              <p style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}>
                Espresso classics, blended frappés, iced teas, fresh lemonades — and the cold brew
                flight that put us on the map.
              </p>
              <span
                className="script mt-3 inline-block"
                style={{ fontSize: 20, color: 'var(--terra)', transform: 'rotate(-2deg)' }}
              >
                tap any card ↗
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {featured.map((d) => (
              <FeatureCard key={d.id} drink={d} />
            ))}
          </div>

          <div className="flex justify-center items-center gap-6 flex-wrap mt-14">
            <Link href="/menu" className="btn btn-primary">
              Full Menu — {stats.drinks} Drinks <span className="arrow">↗</span>
            </Link>
            <span
              className="script"
              style={{
                fontSize: 22,
                color: 'var(--terra)',
                transform: 'rotate(-2deg)',
                display: 'inline-block',
              }}
            >
              delivery within 2km · bykea · indrive · whatsapp
            </span>
          </div>
        </div>
      </section>

      {/* ─── BRAND STATEMENT ────────────────────────────── */}
      <section className="grain" style={{ background: 'var(--bone)', padding: '110px 0' }}>
        <div className="relative z-[2] max-w-[1100px] mx-auto px-7 text-center">
          <span className="eyebrow">No. 001 · Karachi</span>
          <h2 className="display mt-5" style={{ fontSize: 'clamp(2.4rem, 5.4vw, 4.6rem)' }}>
            Specialty coffee, served <span className="ital">slow</span>, on a street that{' '}
            <span className="ital">never sleeps</span>.
          </h2>
          <p
            className="mt-7 mx-auto"
            style={{ maxWidth: 620, color: 'var(--ink-soft)', fontSize: 16, lineHeight: 1.7 }}
          >
            BRUE started as one bar, one machine, one obsession with cold brew. Three years in,
            it&apos;s a Karachi ritual — fifty drinks deep, still fussy about every pull.
          </p>

          <div className="grid grid-cols-3 gap-0 mt-12">
            <Pillar num="3" label="years brewing" />
            <Pillar num="50" label="drinks on offer" italic />
            <Pillar num="∞" label="cold brew batches" />
          </div>
        </div>
      </section>

      {/* ─── HOW TO ORDER ───────────────────────────────── */}
      <section className="grain" style={{ background: 'var(--paper)', padding: '100px 0' }}>
        <div className="relative z-[2] max-w-[1400px] mx-auto px-7 lg:px-10">
          <div className="text-center mb-14">
            <span className="chip">
              <span className="dot" />
              Three ways
            </span>
            <h2 className="display mt-5" style={{ fontSize: 'clamp(2.4rem, 5.4vw, 4.6rem)' }}>
              How to <span className="ital">order</span>.
            </h2>
          </div>

          <div
            className="grid md:grid-cols-3"
            style={{ gap: 2, background: 'var(--line)' }}
          >
            <OrderCard
              num="01"
              title="Walk in"
              body="Pull up to BRUE Karachi. Order at the bar, watch us pour, leave caffeinated."
              note="open 8am — 12am"
            />
            <OrderCard
              num="02"
              title="WhatsApp"
              body="Send your order to our line. We confirm in minutes, deliver to your door."
              note="cash · jazz · easypaisa"
            />
            <OrderCard
              num="03"
              title="Delivery"
              body="Within 2 km — book a Bykea or inDrive yourself, or have us coordinate it on WhatsApp."
              note="2 km zone · live tracking"
            />
          </div>
        </div>
      </section>
    </>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function Stat({
  num,
  suffix,
  italic,
}: {
  num: number | string;
  suffix: string;
  italic?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="serif"
        style={{
          fontSize: 28,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          fontStyle: italic ? 'italic' : 'normal',
          color: italic ? 'var(--terra)' : 'var(--ink)',
        }}
      >
        {num}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {suffix}
      </span>
    </div>
  );
}

function Pillar({ num, label, italic }: { num: string; label: string; italic?: boolean }) {
  return (
    <div
      className="flex flex-col items-center gap-2 px-6 py-8"
      style={{ borderLeft: '1px solid var(--line)' }}
    >
      <span
        className="serif"
        style={{
          fontSize: 64,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          fontStyle: italic ? 'italic' : 'normal',
          color: italic ? 'var(--terra)' : 'var(--ink)',
        }}
      >
        {num}
      </span>
      <span className="eyebrow">{label}</span>
    </div>
  );
}

function OrderCard({
  num,
  title,
  body,
  note,
}: {
  num: string;
  title: string;
  body: string;
  note: string;
}) {
  return (
    <div style={{ background: 'var(--paper)', padding: '40px 36px' }}>
      <div className="flex items-center justify-between mb-6">
        <span
          className="serif italic"
          style={{ fontSize: 36, color: 'var(--terra)', letterSpacing: '-0.04em' }}
        >
          {num}
        </span>
        <span className="eyebrow">{note}</span>
      </div>
      <h3 className="display" style={{ fontSize: 32 }}>
        {title}
      </h3>
      <p className="mt-3" style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.65 }}>
        {body}
      </p>
    </div>
  );
}

function FeatureCard({ drink }: { drink: DrinkWithCategory }) {
  const sold = !drink.in_stock;
  const photo = drink.photo || '/Brue_DP_Orange.png';
  return (
    <Link
      href={`/menu#${drink.id}`}
      className="group block"
      style={{ opacity: sold ? 0.7 : 1 }}
    >
      <div
        className="relative overflow-hidden grain"
        style={{
          aspectRatio: '4 / 5',
          borderRadius: 14,
          background: 'var(--cream)',
          boxShadow: '0 24px 60px -28px rgba(28,23,18,0.25)',
        }}
      >
        <Image
          src={photo}
          alt={drink.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {drink.categories && (
          <span
            className="absolute top-3 left-3 z-[2]"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              background: 'var(--bone)',
              color: 'var(--ink)',
              padding: '5px 10px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            {drink.categories.name}
          </span>
        )}
        {sold && (
          <span
            className="absolute top-3 right-3 z-[2]"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              background: 'var(--ink)',
              color: 'var(--bone)',
              padding: '5px 10px',
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            Sold out
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between mt-4">
        <h3 className="serif" style={{ fontSize: 20, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          {drink.name}
        </h3>
        <span
          className="serif"
          style={{ fontSize: 16, color: 'var(--ink-soft)', letterSpacing: '-0.02em' }}
        >
          {pkr(drink.price)}
        </span>
      </div>
      {drink.description && (
        <p className="mt-1" style={{ color: 'var(--ink-muted)', fontSize: 13, lineHeight: 1.5 }}>
          {drink.description}
        </p>
      )}
    </Link>
  );
}

function HeroVisual() {
  return (
    <div
      className="relative"
      style={{
        aspectRatio: '4 / 5',
        maxHeight: 580,
        marginLeft: 'auto',
        width: '100%',
      }}
    >
      <span
        className="absolute z-[3] inline-flex items-center gap-2"
        style={{
          top: -14,
          left: -14,
          background: 'var(--ink)',
          color: 'var(--bone)',
          padding: '9px 14px',
          borderRadius: 999,
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 500,
          boxShadow: '0 10px 30px -10px rgba(28,23,18,0.4)',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--mustard)' }} />
        Open today · until midnight
      </span>

      <div
        className="relative h-full overflow-hidden"
        style={{
          borderRadius: 16,
          background: 'var(--cream)',
          boxShadow:
            '0 40px 80px -30px rgba(28,23,18,0.28), 0 20px 40px -25px rgba(28,23,18,0.16)',
        }}
      >
        {/*
          Drop a 6–10 s espresso-pull clip at /public/hero-pull.mp4 (and ideally /hero-pull.webm).
          If the file is missing, the poster image renders and the <video> plays nothing —
          which is exactly the previous behaviour. See README §6 for asset notes.
        */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/drinks/spanish-latte.jpg"
          aria-label="Espresso shot being pulled at BRUE"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/hero-pull.webm" type="video/webm" />
          <source src="/hero-pull.mp4" type="video/mp4" />
          {/* graceful fallback if the browser refuses to load any video source */}
          <Image
            src="/drinks/spanish-latte.jpg"
            alt="BRUE Spanish Latte"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover"
          />
        </video>

        {/* Soft vignette so text-on-image stays legible if we ever overlay copy */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(28,23,18,0.18), transparent 40%, transparent 70%, rgba(28,23,18,0.08))',
          }}
        />

        {/* Tiny scripted caption pinned to the bottom */}
        <span
          className="script absolute"
          style={{
            left: 18,
            bottom: 14,
            color: 'var(--bone)',
            fontSize: 22,
            transform: 'rotate(-2deg)',
            textShadow: '0 2px 10px rgba(28,23,18,0.6)',
            zIndex: 2,
          }}
        >
          a 28-second pull ✿
        </span>
      </div>

      <div
        className="absolute z-[2] overflow-hidden"
        style={{
          right: -16,
          bottom: -28,
          width: 150,
          aspectRatio: '3 / 4',
          borderRadius: 12,
          boxShadow: '0 30px 60px -20px rgba(28,23,18,0.32)',
          transform: 'rotate(4deg)',
          border: '4px solid var(--bone)',
        }}
      >
        <Image
          src="/drinks/creme-brulee.jpg"
          alt="Crème Brûlée"
          fill
          sizes="200px"
          className="object-cover"
        />
      </div>

      <span
        className="absolute"
        style={{
          right: -8,
          top: '50%',
          transform: 'translateY(-50%) rotate(90deg)',
          transformOrigin: 'right center',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        № 001 — BRUE Karachi
      </span>
    </div>
  );
}
