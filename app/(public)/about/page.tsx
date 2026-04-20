import Image from 'next/image';
import Link from 'next/link';

export const metadata = { title: 'About — BRUE' };

const TIMELINE = [
  { year: '2021', title: 'One bar, one machine', body: 'BRUE opens with a single espresso machine, a 12-hour cold brew tank, and a stubborn idea: cold coffee, slow.' },
  { year: '2022', title: 'Cold brew flight', body: 'The five-flight tasting board lands. Karachi notices.' },
  { year: '2023', title: 'Fifty drinks deep', body: 'Frappés, Spanish lattes, lemonades, lassis. Same fussiness, more menu.' },
  { year: '2024', title: 'Wholesale + delivery', body: 'Foodpanda, Careem, three offices on retainer. Same morning, same beans.' },
  { year: '2026', title: 'BRUE No. 002', body: 'A second bar — same machine, same obsession.' },
];

export default function AboutPage() {
  return (
    <>
      <section
        className="grain"
        style={{ background: 'var(--bone)', paddingTop: 160, paddingBottom: 90 }}
      >
        <div className="relative z-[2] max-w-[1100px] mx-auto px-7 text-center">
          <span className="eyebrow">No. 001 · Karachi · Est. 2021</span>
          <h1 className="display mt-5" style={{ fontSize: 'clamp(3rem, 7vw, 7rem)' }}>
            We pour <span className="ital">slow</span>,<br />
            on purpose.
          </h1>
          <p
            className="mt-7 mx-auto"
            style={{ maxWidth: 560, color: 'var(--ink-soft)', fontSize: 16, lineHeight: 1.7 }}
          >
            BRUE is a Karachi specialty coffee bar that thinks fast service ruins coffee.
            We grind to order, brew to taste, and ice to clink — every cup, every time.
          </p>
        </div>
      </section>

      {/* photograph block */}
      <section style={{ background: 'var(--paper)', padding: '70px 0' }} className="grain">
        <div className="relative z-[2] max-w-[1200px] mx-auto px-7 grid md:grid-cols-3 gap-6 items-end">
          <div
            className="relative overflow-hidden col-span-2"
            style={{ borderRadius: 16, aspectRatio: '16 / 10', boxShadow: '0 30px 70px -28px rgba(28,23,18,0.28)' }}
          >
            <Image
              src="/drinks/spanish-latte.jpg"
              alt="BRUE bar"
              fill
              sizes="(max-width: 768px) 100vw, 70vw"
              className="object-cover"
            />
          </div>
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 16,
              aspectRatio: '4 / 5',
              boxShadow: '0 24px 50px -22px rgba(28,23,18,0.22)',
              border: '4px solid var(--bone)',
              transform: 'rotate(-3deg)',
            }}
          >
            <Image
              src="/drinks/creme-brulee.jpg"
              alt="Crème brûlée latte"
              fill
              sizes="(max-width: 768px) 100vw, 30vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* values */}
      <section style={{ background: 'var(--bone)', padding: '110px 0' }} className="grain">
        <div className="relative z-[2] max-w-[1100px] mx-auto px-7">
          <div className="grid md:grid-cols-3 gap-12">
            <Value
              num="01"
              title="Single-origin only"
              body="Voglia beans, roasted weekly. Single origin or nothing — no blends to hide behind."
            />
            <Value
              num="02"
              title="Cold-pressed daily"
              body="Juices made before service, never the night before. Pulp matters. Time matters more."
            />
            <Value
              num="03"
              title="Made for here"
              body="Recipes calibrated for Karachi water, Karachi air, Karachi taste. You're not in Melbourne."
            />
          </div>
        </div>
      </section>

      {/* timeline */}
      <section style={{ background: 'var(--paper)', padding: '110px 0' }} className="grain">
        <div className="relative z-[2] max-w-[900px] mx-auto px-7">
          <span className="chip"><span className="dot" />A short history</span>
          <h2 className="display mt-5" style={{ fontSize: 'clamp(2.4rem, 5vw, 4.4rem)' }}>
            Three years <span className="ital">in</span>.
          </h2>

          <div className="mt-12 space-y-1">
            {TIMELINE.map((t, i) => (
              <div
                key={t.year}
                className="grid gap-6 py-7"
                style={{
                  gridTemplateColumns: '110px 1fr',
                  borderTop: i === 0 ? '1px solid var(--line-strong)' : '1px solid var(--line)',
                }}
              >
                <div
                  className="serif italic"
                  style={{ fontSize: 32, color: 'var(--terra)', letterSpacing: '-0.04em', lineHeight: 1 }}
                >
                  {t.year}
                </div>
                <div>
                  <h3 className="display" style={{ fontSize: 26, lineHeight: 1.15 }}>
                    {t.title}
                  </h3>
                  <p
                    className="mt-2"
                    style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}
                  >
                    {t.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="grain" style={{ background: 'var(--bone)', padding: '90px 0' }}>
        <div className="relative z-[2] max-w-[900px] mx-auto px-7 text-center">
          <h2 className="display" style={{ fontSize: 'clamp(2.4rem, 5vw, 4.6rem)' }}>
            Come <span className="ital">say hi</span>.
          </h2>
          <div className="flex justify-center gap-3 mt-7 flex-wrap">
            <Link href="/menu" className="btn btn-primary">
              Browse the menu <span className="arrow">→</span>
            </Link>
            <Link href="/find-us" className="btn btn-outline">
              Find the bar
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Value({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div>
      <span
        className="serif italic"
        style={{ fontSize: 32, color: 'var(--terra)', letterSpacing: '-0.04em' }}
      >
        {num}
      </span>
      <h3 className="display mt-3" style={{ fontSize: 28 }}>
        {title}
      </h3>
      <p className="mt-3" style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.65 }}>
        {body}
      </p>
    </div>
  );
}
