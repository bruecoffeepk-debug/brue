'use client';

/**
 * Tiny pill in the nav that surfaces the visitor's zone status and lets
 * them re-open the WelcomeGate to change it.
 *
 *   · Picked a covered area  →  "Block 7 · FB Area"  (sage)
 *   · Just browsing          →  "Browsing · Set area" (neutral)
 *   · First visit / unknown  →  "Check area"         (neutral)
 */

import { MapPin } from 'lucide-react';
import { useZone } from '@/lib/zone-context';

export default function ZoneChip({ compact = false }: { compact?: boolean }) {
  const zone = useZone();

  // Don't render before hydration finishes, to avoid a flicker.
  if (!zone.resolved) return null;

  const inZone = zone.status === 'in' && zone.area;
  const browsing = zone.status === 'browsing';

  const text = inZone
    ? `${zone.area!.label} · ${zone.area!.cluster}`
    : browsing
    ? 'Browsing · Set area'
    : 'Check area';

  const bg = inZone ? 'rgba(107,122,83,0.16)' : 'rgba(28,23,18,0.06)';
  const color = inZone ? 'var(--sage)' : 'var(--ink-muted)';
  const dot = inZone ? 'var(--sage)' : 'var(--ink-muted)';

  return (
    <button
      onClick={zone.openGate}
      aria-label={inZone ? `${text} — change` : 'Pick your delivery area'}
      className="inline-flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
      style={{
        background: bg,
        color,
        padding: compact ? '5px 10px' : '6px 12px',
        fontSize: compact ? 10 : 11,
        fontWeight: 500,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}
    >
      {inZone ? (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: dot,
            boxShadow: `0 0 0 3px ${bg}`,
          }}
        />
      ) : (
        <MapPin size={12} />
      )}
      {text}
    </button>
  );
}
