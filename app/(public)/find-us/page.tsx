import { Clock, Instagram, MapPin, MessageCircle, Phone, Navigation, ExternalLink } from 'lucide-react';
import { SHOP } from '@/lib/shop';
import { isOpenNow, statusLabel } from '@/lib/hours';
import FlowerField from '@/components/brand/FlowerField';
import Flower from '@/components/brand/Flower';

export const metadata = { title: 'Find Us — BRUE' };

const HOURS_DISPLAY: [string, string][] = [
  ['Mon — Thu', '8:00 am — 12:00 am'],
  ['Friday',    '8:00 am —  1:00 am'],
  ['Saturday',  '9:00 am —  1:00 am'],
  ['Sunday',    '9:00 am — 12:00 am'],
];

export default function FindUsPage() {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const open = isOpenNow();
  const status = statusLabel();

  return (
    <>
      {/* ─── HEADER ─────────────────────────────────────── */}
      <section
        className="grain relative overflow-hidden"
        style={{ background: 'var(--bone)', paddingTop: 160, paddingBottom: 70 }}
      >
        <FlowerField density={12} seed={21} tone="terra" />
        <div className="relative z-[2] max-w-[1100px] mx-auto px-7 text-center">
          <span className="eyebrow">{SHOP.city} · {SHOP.country}</span>
          <h1
            className="display mt-5 inline-flex items-baseline justify-center gap-4 flex-wrap"
            style={{ fontSize: 'clamp(3rem, 6.6vw, 6.8rem)' }}
          >
            Come <span className="ital">find</span> us.
            <Flower size={42} color="var(--terra)" centerColor="var(--mustard, #d4972e)" spin
                    style={{ alignSelf: 'center' }} />
          </h1>
          <p
            className="mt-6 mx-auto"
            style={{ maxWidth: 540, color: 'var(--ink-soft)', fontSize: 16, lineHeight: 1.65 }}
          >
            One bar. Open every day. Easy parking after 9pm, easy company any time.
          </p>

          <div className="flex justify-center mt-6">
            <span
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
              style={{
                background: open ? 'rgba(107,122,83,0.16)' : 'rgba(196,69,38,0.12)',
                color: open ? 'var(--sage)' : 'var(--terra-deep)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: open ? 'var(--sage)' : 'var(--terra)',
                }}
              />
              {status.short}
            </span>
          </div>
        </div>
      </section>

      {/* ─── MAP + INFO ─────────────────────────────────── */}
      <section
        className="grain"
        style={{ background: 'var(--paper)', padding: '70px 0 120px' }}
      >
        <div className="relative z-[2] max-w-[1300px] mx-auto px-7 grid md:grid-cols-[1.4fr_1fr] gap-10">
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 18,
              aspectRatio: '4 / 3',
              boxShadow: '0 36px 80px -28px rgba(28,23,18,0.28)',
            }}
          >
            <iframe
              title="BRUE on Google Maps"
              src={SHOP.embedSrc}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <a
              href={SHOP.directionsLink}
              target="_blank"
              rel="noreferrer"
              className="absolute inline-flex items-center gap-2"
              style={{
                bottom: 16, left: 16,
                background: 'var(--ink)',
                color: 'var(--bone)',
                padding: '10px 16px',
                borderRadius: 999,
                fontSize: 12,
                letterSpacing: '0.06em',
                fontWeight: 500,
                boxShadow: '0 16px 36px -12px rgba(28,23,18,0.45)',
              }}
            >
              <Navigation size={14} style={{ color: 'var(--mustard)' }} />
              Directions
            </a>
          </div>

          <div>
            <h2 className="display" style={{ fontSize: 'clamp(2rem, 3.6vw, 3.2rem)' }}>
              {SHOP.name} <span className="ital">No. 001</span>
            </h2>
            <p
              className="mt-4"
              style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.7 }}
            >
              {SHOP.address} — DM us on Instagram for the exact pin or tap directions to launch
              Google Maps with the route already built.
            </p>

            {/* CONTACT TILES (theme-styled icons) */}
            <div className="grid grid-cols-2 gap-3 mt-7">
              <ContactTile
                icon={<Instagram size={16} />}
                label="Instagram"
                value={SHOP.instagram.handle}
                href={SHOP.instagram.url}
                tone="terra"
              />
              <ContactTile
                icon={<MessageCircle size={16} />}
                label="WhatsApp"
                value={wa ? `+${wa}` : 'add to .env'}
                href={wa ? `https://wa.me/${wa}` : undefined}
                tone="sage"
              />
              <ContactTile
                icon={<MapPin size={16} />}
                label="Location"
                value="Open in Maps"
                href={SHOP.googleMapsLink}
                tone="ink"
              />
              <ContactTile
                icon={<Phone size={16} />}
                label="Phone"
                value={SHOP.phoneDisplay || '—'}
                href={SHOP.phoneTel ? `tel:${SHOP.phoneTel}` : undefined}
                tone="mustard"
              />
            </div>

            <h3
              className="eyebrow mt-10 mb-4 flex items-center gap-2"
              style={{ color: 'var(--ink)' }}
            >
              <Clock size={14} /> Hours
            </h3>
            <ul style={{ borderTop: '1px solid var(--line)' }}>
              {HOURS_DISPLAY.map(([d, t]) => (
                <li
                  key={d}
                  className="flex justify-between py-3"
                  style={{ borderBottom: '1px solid var(--line)' }}
                >
                  <span style={{ color: 'var(--ink-soft)', fontSize: 14 }}>{d}</span>
                  <span className="serif" style={{ fontSize: 16 }}>
                    {t}
                  </span>
                </li>
              ))}
            </ul>

            <p
              className="mt-6 inline-flex items-center gap-2"
              style={{ fontSize: 12, color: 'var(--ink-muted)' }}
            >
              <ExternalLink size={12} /> Times shown in Karachi (PKT, UTC+5).
            </p>
          </div>
        </div>
      </section>

      {/* ─── DELIVERY ZONE NOTE ─────────────────────────── */}
      <section style={{ background: 'var(--bone)', padding: '70px 0 90px' }}>
        <div className="max-w-[1100px] mx-auto px-7 text-center">
          <span className="eyebrow">Delivery</span>
          <h2 className="display mt-4" style={{ fontSize: 'clamp(2rem, 4.2vw, 3.4rem)' }}>
            We deliver inside <span className="ital">2 km</span> of the bar.
          </h2>
          <p className="mt-5 mx-auto" style={{ maxWidth: 560, color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.7 }}>
            Tap your location at checkout — if you're inside our zone, pick a rider:
            <span className="serif italic" style={{ color: 'var(--terra)' }}> Bykea</span>,
            <span className="serif italic" style={{ color: 'var(--terra)' }}> inDrive</span>, or
            we'll coordinate one over WhatsApp.
          </p>
          <div className="flex justify-center gap-3 mt-7 flex-wrap">
            {SHOP.delivery.methods.map((m) => (
              <span
                key={m.id}
                className="chip"
                style={{ borderColor: 'var(--line-strong)' }}
              >
                <span className="dot" style={{ background: 'var(--terra)' }} />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ContactTile({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  tone: 'terra' | 'sage' | 'ink' | 'mustard';
}) {
  const toneMap = {
    terra:   { bg: 'rgba(196,69,38,0.10)', fg: 'var(--terra-deep)' },
    sage:    { bg: 'rgba(107,122,83,0.16)', fg: 'var(--sage)' },
    ink:     { bg: 'rgba(28,23,18,0.06)',   fg: 'var(--ink)' },
    mustard: { bg: 'rgba(212,151,46,0.18)', fg: '#7a560f' },
  }[tone];

  const inner = (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-transform hover:-translate-y-0.5"
      style={{
        background: 'var(--bone)',
        border: '1px solid var(--line)',
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: toneMap.bg, color: toneMap.fg,
        }}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span
          style={{
            fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--ink-muted)', fontWeight: 500,
          }}
        >
          {label}
        </span>
        <span className="serif" style={{ fontSize: 15, color: 'var(--ink)' }}>
          {value}
        </span>
      </span>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}
