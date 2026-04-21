import type { Metadata } from 'next';
import { Instrument_Serif, Fraunces, Inter_Tight, Caveat } from 'next/font/google';
import './globals.css';

// v3 — chic + clean
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

const sans = Inter_Tight({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const script = Caveat({
  subsets: ['latin'],
  weight: '500',
  variable: '--font-script',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BRUE — Cold · Coffee · Juices · Karachi',
  description:
    "Karachi's favourite specialty coffee. Fifty drinks, cold-pressed juices, single-origin espresso — made in Karachi, for Karachi.",
  // Favicon comes from app/icon.svg (brand flower mark, transparent).
  // OpenGraph image still uses the square JPEG — social previews can't eat SVG.
  openGraph: {
    title: 'BRUE — Cold · Coffee · Juices · Karachi',
    description: 'Specialty coffee, cold-pressed juices, fifty drinks. Made slow.',
    images: ['/Brue_DP_Orange.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${fraunces.variable} ${sans.variable} ${script.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
