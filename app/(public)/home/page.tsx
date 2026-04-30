import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { DrinkWithCategory } from '@/lib/utils';
import FlowerField from '@/components/brand/FlowerField';
import Flower from '@/components/brand/Flower';
import DrinkCard from '@/components/public/DrinkCard';

// Debug: force-dynamic so every request hits Supabase fresh. Swap back to
// `export const revalidate = 60` for ISR once stable.
export const dynamic = 'force-dynamic';

/**
 * Fetch the four "row" datasets the homepage displays:
 *   - specials : top 8 drinks across non-Dessert / non-New Recipe categories
 *                (the "trending / hot" list — owner can later replace with a
 *                proper `featured` flag on menu_items)
 *   - desserts : every active Dessert
 *   - newRecipes : every active New Recipe
 *   - all      : just for the sort-by-price-asc + count
 *
 * One round trip — a single SELECT pulls every visible drink, then we slice
 * client-side. Cheaper than 4 separate queries.
 */
async function getHomeData() {
  const supabase = createClient();
  const { data } = await supabase
    .from('menu_items_public')
    .select('*, categories ( id, name, slug, emoji )')
    .order('sort_order', { ascending: true });

  const all = (data ?? []) as DrinkWithCategory[];
  const desserts = all.filter((d) => d.category === 'Dessert');
  const newRecipes = all.filter((d) => d.category === 'New Recipe');
  const specials = all
    .filter((d) => d.category !== 'Dessert' && d.category !== 'New Recipe')
    .slice(0, 8);
  const startingFrom = all.length
    ? all.reduce((m, d) => Math.min(m, d.price), Infinity)
    : 540;
  return {
    specials,
    desserts,
    newRecipes,
    drinkCount: all.length,
    startingFrom,
  };
}

export default async function HomePage() {
  const { specials, desserts, newRecipes, drinkCount, startingFrom } =
    await getHomeData();
  const featured = specials;
  const stats = { drinks: drinkCount, startingFrom };

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
        {/* ambient flowers drifting behind hero content */}
        <FlowerField density={14} seed={3} tone="terra" />
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

      {/* ─── SPECIALS / TODAY'S HOT ─────────────────────── */}
      <section className="grain" style={{ background: 'var(--paper)', padding: '90px 0 50px' }}>
        <div className="relative z-[2] max-w-[1400px] mx-auto px-7 lg:px-10">
          <div className="flex items-end justify-between gap-8 mb-12 flex-wrap">
            <div>
              <span className="chip">
                <span className="dot" />
                Today&apos;s specials · trending
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
                flight that put us on the map. Tap a card to add — straight to your cart.
              </p>
              <span
                className="script mt-3 inline-block"
                style={{ fontSize: 20, color: 'var(--terra)', transform: 'rotate(-2deg)' }}
              >
                tap any card ↗
              </span>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-10 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((d) => (
              <DrinkCard key={d.id} drink={d} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── NEW RECIPES ────────────────────────────────── */}
      {newRecipes.length > 0 && (
        <section style={{ background: 'var(--paper)', padding: '40px 0' }}>
          <div className="relative z-[2] max-w-[1400px] mx-auto px-7 lg:px-10">
            <div className="flex items-end justify-between gap-8 mb-10 flex-wrap">
              <div>
                <span className="chip">
                  <span className="dot" style={{ background: 'var(--mustard)' }} />
                  Just dropped
                </span>
                <h2 className="display mt-5" style={{ fontSize: 'clamp(2.4rem, 4.6vw, 4rem)' }}>
                  New <span className="ital">recipes</span>.
                </h2>
              </div>
              <p
                className="max-w-sm"
                style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}
              >
                Tested behind the bar this month. Try them before they hit the regular line-up.
              </p>
            </div>
            <div className="grid gap-x-6 gap-y-10 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {newRecipes.map((d) => (
                <DrinkCard key={d.id} drink={d} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── DESSERTS ───────────────────────────────────── */}
      {desserts.length > 0 && (
        <section style={{ background: 'var(--paper)', padding: '40px 0 110px' }}>
          <div className="relative z-[2] max-w-[1400px] mx-auto px-7 lg:px-10">
            <div className="flex items-end justify-between gap-8 mb-10 flex-wrap">
              <div>
                <span className="chip">
                  <span className="dot" style={{ background: 'var(--sage)' }} />
                  After the brew
                </span>
                <h2 className="display mt-5" style={{ fontSize: 'clamp(2.4rem, 4.6vw, 4rem)' }}>
                  Sweet <span className="ital">things</span>.
                </h2>
              </div>
              <p
                className="max-w-sm"
                style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}
              >
                Tiramisu in a cup, the affogato, a fudgy brownie. Pair them with anything cold.
              </p>
            </div>
            <div className="grid gap-x-6 gap-y-10 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {desserts.map((d) => (
                <DrinkCard key={d.id} drink={d} />
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
                FB area + north nazimabad · bykea · indrive · whatsapp
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ─── THE CRAFT · GROUND TO ORDER ─────────────────── */}
      <section
        className="grain relative overflow-hidden"
        style={{ background: 'var(--ink)', color: 'var(--bone)', padding: '110px 0' }}
      >
        <FlowerField density={8} seed={29} tone="terra" />
        <div className="relative z-[2] max-w-[1300px] mx-auto px-7 lg:px-10 grid gap-12 md:grid-cols-[1fr_1.05fr] items-center">
          {/* video — portrait 9:16 */}
          <div
            className="relative overflow-hidden mx-auto"
            style={{
              width: '100%',
              maxWidth: 440,
              aspectRatio: '9 / 16',
              borderRadius: 22,
              boxShadow:
                '0 40px 80px -25px rgba(0,0,0,0.55), 0 18px 40px -22px rgba(0,0,0,0.5)',
              border: '1px solid rgba(244,234,218,0.08)',
            }}
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/craft-grind-poster.jpg"
              aria-label="Coffee being ground at BRUE"
              className="absolute inset-0 h-full w-full object-cover"
            >
              <source src="/craft-grind.webm" type="video/webm" />
              <source src="/craft-grind.mp4" type="video/mp4" />
            </video>
            {/* subtle vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to top, rgba(28,23,18,0.35), transparent 35%, transparent 70%, rgba(28,23,18,0.18))',
              }}
            />
            {/* floating script caption */}
            <span
              className="script absolute inline-flex items-center gap-2"
              style={{
                left: 20,
                bottom: 18,
                color: 'var(--bone)',
                fontSize: 22,
                transform: 'rotate(-2deg)',
                textShadow: '0 2px 10px rgba(0,0,0,0.6)',
                zIndex: 2,
              }}
            >
              every cup starts here
              <Flower size={18} color="var(--mustard, #d4972e)" centerColor="var(--terra)" spin />
            </span>
            {/* corner chip */}
            <span
              className="absolute"
              style={{
                top: 14,
                left: 14,
                background: 'rgba(252,247,235,0.9)',
                color: 'var(--ink)',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                padding: '5px 10px',
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              Step 01 · Grind
            </span>
          </div>

          {/* copy */}
          <div>
            <span
              className="eyebrow"
              style={{ color: 'var(--mustard)' }}
            >
              The Craft · No. 001
            </span>
            <h2
              className="display mt-5"
              style={{
                fontSize: 'clamp(2.6rem, 5.4vw, 5rem)',
                lineHeight: 1,
                color: 'var(--bone)',
              }}
            >
              Ground <span className="ital" style={{ color: 'var(--terra)' }}>to order</span>.
            </h2>
            <p
              className="mt-6"
              style={{
                color: 'rgba(244,234,218,0.78)',
                fontSize: 17,
                lineHeight: 1.65,
                maxWidth: 520,
              }}
            >
              Single-origin beans, weighed to the gram, ground the moment you order.
              Because the fifteen seconds between grinder and portafilter is the
              difference between a coffee and a <em className="fraunces italic">28-second pull</em>.
            </p>

            {/* recipe strip */}
            <ul
              className="mt-8 flex flex-wrap gap-x-8 gap-y-3"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                color: 'rgba(244,234,218,0.9)',
                fontSize: 13,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              <li>18g <span style={{ opacity: 0.55 }}>in</span></li>
              <li>36g <span style={{ opacity: 0.55 }}>out</span></li>
              <li>93°<span style={{ opacity: 0.55 }}>C</span></li>
              <li>9 <span style={{ opacity: 0.55 }}>bar</span></li>
              <li>28<span style={{ opacity: 0.55 }}>s</span></li>
            </ul>

            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link href="/menu" className="btn btn-terra">
                See the menu <span className="arrow">↗</span>
              </Link>
              <span
                className="script"
                style={{
                  color: 'var(--mustard)',
                  fontSize: 22,
                  transform: 'rotate(-2deg)',
                  display: 'inline-block',
                }}
              >
                fifty drinks, one obsession
              </span>
            </div>
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
              body="FB Area + North Nazimabad — book a Bykea or inDrive yourself, or have us coordinate it on WhatsApp."
              note="14 covered blocks · live tracking"
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
          poster="/hero-pull-poster.jpg"
          aria-label="Latte being poured at BRUE"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/hero-pull.webm" type="video/webm" />
          <source src="/hero-pull.mp4" type="video/mp4" />
          {/* graceful fallback if the browser refuses to load any video source */}
          <Image
            src="/hero-pull-poster.jpg"
            alt="BRUE latte pour"
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
          a 28-second pull{' '}
          <Flower
            size={18}
            color="var(--bone)"
            centerColor="var(--mustard, #d4972e)"
            spin
            style={{ verticalAlign: '-3px', marginLeft: 2 }}
          />
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
