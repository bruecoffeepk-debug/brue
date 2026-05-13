'use client';

/**
 * Tiny pill in the nav that surfaces the visitor's distance status and
 * lets them re-open the WelcomeGate to re-check.
 *
 *   · GPS in range   →  "2.3 km · in range"        (sage)
 *   · GPS out        →  "8.1 km · out of range"    (terra)
 *   · Manual mode    →  "Address mode"             (neutral)
 *   · Unknown        →  "Check delivery"           (neutral)
 */

import { MapPin } from 'lucide-react';
import { useZone } from '@/lib/zone-context';

export default function ZoneChip({ compact = false }: { compact?: boolean }) {
  const zone = useZone();

  if (!zone.resolved) return null;

  const inRange = zone.status === 'in';
  const outRange = zone.status === 'out';
  const manual = zone.status === 'manual';

  const text = inRange
    ? `${zone.distanceKm?.toFixed(1)} km · in range`
    : outRange
    ? `${zone.distanceKm?.toFixed(1)} km · out of range`
    : manual
    ? 'Address mode'
    : 'Check delivery';

  const bg = inRange
    ? 'rgba(107,122,83,0.16)'
    : outRange
    ? 'rgba(196,69,38,0.12)'
    : 'rgba(28,23,18,0.06)';
  const color = inRange
    ? 'var(--sage)'
    : outRange
    ? 'var(--terra-deep)'
    : 'var(--ink-muted)';
  const dot = color;

  return (
    <button
      onClick={zone.openGate}
      aria-label={`${text} — change`}
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
      {inRange || outRange ? (
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
