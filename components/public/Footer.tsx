import Link from 'next/link';
import { Instagram, MessageCircle, MapPin, Bike } from 'lucide-react';
import { SHOP } from '@/lib/shop';
import { isOpenNow, statusLabel } from '@/lib/hours';
import Wordmark from '@/components/brand/Wordmark';
import Flower from '@/components/brand/Flower';
import FlowerField from '@/components/brand/FlowerField';

export default function Footer() {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const open = isOpenNow();
  const status = statusLabel();
  return (
    <footer
      className="grain relative overflow-hidden"
      style={{ background: 'var(--ink)', color: 'var(--bone)', borderTop: '3px solid var(--terra)' }}
    >
      {/* Ambient flowers drifting behind the big editorial mark */}
      <FlowerField density={10} seed={11} tone="terra" />

      {/* Big editorial mark */}
      <div className="relative z-[2] max-w-[1400px] mx-auto px-7 pt-24 pb-10 text-center">
        <h3
          className="display"
          style={{ fontSize: 'clamp(3.4rem, 9vw, 9rem)', lineHeight: 0.9, color: 'var(--bone)' }}
        >
          Brewed <span className="ital" style={{ color: 'var(--terra)' }}>in</span> Karachi.
        </h3>
        <p
          className="script mt-4 inline-flex items-center gap-2"
          style={{ color: 'var(--mustard)', fontSize: 28 }}
        >
          — see you tomorrow
          <Flower size={22} color="var(--mustard, #d4972e)" centerColor="var(--terra)" spin />
        </p>
      </div>

      <div
        className="relative z-[2] max-w-[1400px] mx-auto px-7 grid gap-12 pt-12"
        style={{
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          borderTop: '1.5px dashed rgba(244,234,218,0.18)',
        }}
      >
        <div>
          <div className="mb-5">
            <Wordmark tone="bone" size={44} />
          </div>
          <p
            className="fraunces italic"
            style={{ fontSize: 17, lineHeight: 1.5, color: 'rgba(244,234,218,0.85)', maxWidth: 320 }}
          >
            Specialty coffee, fresh juices, and the kind of cold brew you write home about.
          </p>
          <div
            className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full"
            style={{ border: '1px solid rgba(244,234,218,0.4)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: 999,
                background: open ? 'var(--sage)' : 'var(--terra)',
              }}
            />
            {status.short}
          </div>
        </div>

        <FooterCol title="Visit">
          <li>
            <a
              href={SHOP.directionsLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:opacity-100 opacity-70"
            >
              <MapPin size={14} /> {SHOP.name} · {SHOP.city}
            </a>
          </li>
          <li>{SHOP.country}</li>
          <li>Mon — Sun</li>
          <li>{SHOP.hoursSummary.replace('Mon — Sun · ', '')}</li>
        </FooterCol>

        <FooterCol title="Delivery">
          <li><Link href="/menu" className="hover:opacity-100 opacity-70">Order on the menu</Link></li>
          <li>
            <a
              href={wa ? `https://wa.me/${wa}` : '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:opacity-100 opacity-70"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          </li>
          <li className="inline-flex items-center gap-2 opacity-70">
            <Bike size={14} /> Bykea
          </li>
          <li className="opacity-70">inDrive</li>
          <li className="opacity-50" style={{ fontSize: 12 }}>
            FB Area · North Nazimabad (14 blocks)
          </li>
        </FooterCol>

        <FooterCol title="Connect">
          <li>
            <a
              href={SHOP.instagram.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:opacity-100 opacity-70"
            >
              <Instagram size={14} /> {SHOP.instagram.handle}
            </a>
          </li>
          <li>Press</li>
          <li>Wholesale</li>
          <li>
            <Link href="/login" className="hover:opacity-100 opacity-70">Staff Login</Link>
          </li>
        </FooterCol>
      </div>

      {/* footer bottom strip */}
      <div
        className="relative z-[2] max-w-[1400px] mx-auto px-7 mt-12 pt-6 pb-7 flex justify-between flex-wrap gap-4 items-center"
        style={{ borderTop: '1.5px dashed rgba(244,234,218,0.18)' }}
      >
        <small
          style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(244,234,218,0.5)' }}
        >
          © BRUE {new Date().getFullYear()} · ALL RIGHTS RESERVED
        </small>
        <span
          className="script inline-flex items-center gap-2"
          style={{ color: 'var(--terra)', fontSize: 24 }}
        >
          made with love in Karachi
          <Flower size={18} color="var(--terra)" centerColor="var(--mustard, #d4972e)" spin />
        </span>
        <small
          style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(244,234,218,0.5)' }}
        >
          NO. 001
        </small>
      </div>

      {/* giant watermark flower */}
      <div
        aria-hidden
        className="absolute pointer-events-none z-[1]"
        style={{
          right: -80,
          bottom: -80,
          width: 420,
          height: 420,
          opacity: 0.06,
        }}
      >
        <Flower size="100%" color="var(--bone)" centerColor="var(--terra)" spin />
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 15,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--mustard)',
          marginBottom: 14,
        }}
      >
        {title}
      </h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'rgba(244,234,218,0.7)', fontSize: 14, lineHeight: 2 }}>
        {children}
      </ul>
    </div>
  );
}
