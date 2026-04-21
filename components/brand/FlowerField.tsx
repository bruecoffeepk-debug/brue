'use client';

import { useMemo } from 'react';
import Flower from './Flower';

/**
 * Ambient, decorative flower field — an absolutely-positioned layer of
 * semi-transparent flowers that drift and rotate slowly behind hero content.
 *
 * Deterministic: flowers are seeded by `seed` so SSR and the first client
 * render produce the same positions (no hydration mismatch). Pointer-events
 * are disabled so it never interferes with clicks.
 *
 *   <FlowerField density={12} seed={7} />          // default
 *   <FlowerField density={6}  tone="sage" />
 *
 * Drop inside a `position: relative` parent and give that parent
 * `overflow: hidden` if you want flowers to be clipped nicely.
 */

type FlowerFieldProps = {
  density?: number;
  seed?: number;
  tone?: 'terra' | 'mustard' | 'sage' | 'bone';
  className?: string;
  style?: React.CSSProperties;
};

const TONE_COLOR = {
  terra:   'var(--terra)',
  mustard: 'var(--mustard, #d4972e)',
  sage:    'var(--sage, #6b7a53)',
  bone:    'var(--bone)',
} as const;

// tiny deterministic PRNG (mulberry32) so the layout is stable per seed
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function FlowerField({
  density = 10,
  seed = 42,
  tone = 'terra',
  className,
  style,
}: FlowerFieldProps) {
  const flowers = useMemo(() => {
    const rand = rng(seed);
    return Array.from({ length: density }, (_, i) => ({
      id: i,
      left: rand() * 100,            // %
      top: rand() * 100,             // %
      size: 18 + Math.floor(rand() * 50),   // px
      rotate: Math.floor(rand() * 360),
      opacity: 0.05 + rand() * 0.18, // 0.05 – 0.23
      driftDur: 18 + rand() * 22,    // seconds
      spinDur: 30 + rand() * 30,     // seconds
      delay: -rand() * 40,           // negative = start mid-animation
      driftX: (rand() * 40 - 20).toFixed(1), // px
      driftY: (rand() * 60 - 30).toFixed(1),
    }));
  }, [density, seed]);

  const color = TONE_COLOR[tone];

  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        ...style,
      }}
    >
      {flowers.map((f) => (
        <span
          key={f.id}
          style={{
            position: 'absolute',
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            transform: `translate(-50%, -50%) rotate(${f.rotate}deg)`,
            animation: `
              brue-field-drift-${f.id} ${f.driftDur}s ease-in-out ${f.delay}s infinite alternate,
              brue-field-spin-${f.id}  ${f.spinDur}s linear ${f.delay}s infinite
            `,
            willChange: 'transform',
          }}
        >
          <Flower size="100%" color={color} centerColor={color} />
          <style>{`
            @keyframes brue-field-drift-${f.id} {
              from { translate: 0 0; }
              to   { translate: ${f.driftX}px ${f.driftY}px; }
            }
            @keyframes brue-field-spin-${f.id} {
              from { rotate: ${f.rotate}deg; }
              to   { rotate: ${f.rotate + 360}deg; }
            }
          `}</style>
        </span>
      ))}
    </div>
  );
}
