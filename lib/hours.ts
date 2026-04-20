// ─────────────────────────────────────────────────────────────
// Open / closed math — runs entirely in Karachi time so the
// chip + closed-shop modal don't lie when the server is in UTC.
// ─────────────────────────────────────────────────────────────

import { SHOP } from './shop';

type HoursRow = (typeof SHOP.hours)[number];

/** Now in Karachi (Asia/Karachi, UTC+5, no DST). */
export function nowInKarachi(): Date {
  const now = new Date();
  // shift to UTC then add the Karachi offset
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + SHOP.utcOffsetHours * 60 * 60_000);
}

function row(day: number): HoursRow | undefined {
  return SHOP.hours.find((h) => h.day === day);
}

/** True if BRUE is currently open (Karachi time). */
export function isOpenNow(now: Date = nowInKarachi()): boolean {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  // today's window
  const today = row(day);
  if (today && minutes >= today.open * 60 && minutes < today.close * 60) return true;

  // yesterday's window may extend past midnight (close > 24)
  const yesterdayDay = (day + 6) % 7;
  const yest = row(yesterdayDay);
  if (yest && yest.close > 24) {
    // minutes_since_yesterday_open relative to today = (24*60) + minutes
    const overflow = (yest.close - 24) * 60;
    if (minutes < overflow) return true;
  }
  return false;
}

/** Short string for the chip: "Open until 12:00 am" / "Closed · opens 8 am". */
export function statusLabel(now: Date = nowInKarachi()): {
  open: boolean;
  short: string;     // "Open until 12 am"
  detail: string;    // "We're brewing til midnight tonight."
} {
  if (isOpenNow(now)) {
    const closing = closingTime(now);
    return {
      open: true,
      short: closing ? `Open until ${formatHour(closing)}` : 'Open now',
      detail: closing
        ? `We're pouring until ${formatHour(closing)} tonight.`
        : "We're open right now.",
    };
  }
  const next = nextOpening(now);
  return {
    open: false,
    short: next ? `Closed · opens ${formatHour(next.openHour)}` : 'Closed',
    detail: next
      ? `We're closed right now. We open ${next.relative} at ${formatHour(next.openHour)}.`
      : 'We are closed right now.',
  };
}

function closingTime(now: Date): number | null {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = row(day);
  if (today && minutes >= today.open * 60 && minutes < today.close * 60) return today.close;

  const yest = row((day + 6) % 7);
  if (yest && yest.close > 24) {
    const overflow = (yest.close - 24) * 60;
    if (minutes < overflow) return yest.close - 24;
  }
  return null;
}

function nextOpening(now: Date): { openHour: number; relative: string } | null {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = row(day);
  if (today && minutes < today.open * 60) {
    return { openHour: today.open, relative: 'today' };
  }
  // walk forward up to 7 days
  for (let i = 1; i <= 7; i++) {
    const r = row((day + i) % 7);
    if (r) {
      return {
        openHour: r.open,
        relative: i === 1 ? 'tomorrow' : (r as any).label || 'soon',
      };
    }
  }
  return null;
}

function formatHour(h: number): string {
  // Allow values like 24 (=12 am), 25 (=1 am)
  let n = h;
  while (n >= 24) n -= 24;
  if (n === 0) return '12 am';
  if (n === 12) return '12 pm';
  return n < 12 ? `${n} am` : `${n - 12} pm`;
}
