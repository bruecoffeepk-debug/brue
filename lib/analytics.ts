'use client';

// ─────────────────────────────────────────────────────────────
// Tiny client-side analytics tracker.
//
// One function — track(name, props) — fires a fire-and-forget POST to
// /api/track. session_id is a localStorage UUID (regenerated every 30
// days). No PII is collected here; name/phone/address still live on
// orders. The dashboard at /admin/analytics aggregates these to show
// funnel + drop-off.
//
// Failure modes are silent: a missing service-role key, network error,
// or rate-limit response should never affect the user's flow. We sendBeacon
// where possible so events still flush during page navigation.
// ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'brue.sid.v1';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type Stored = { id: string; createdAt: number };

function uuidv4(): string {
  // Fall back to a Math.random-based UUID if crypto.randomUUID isn't there
  // (older mobile Safari). Quality is enough for analytics dedup.
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed?.id && Date.now() - parsed.createdAt < SESSION_TTL_MS) {
        return parsed.id;
      }
    }
  } catch {
    /* corrupt — regenerate */
  }
  const id = uuidv4();
  try {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id, createdAt: Date.now() } satisfies Stored)
    );
  } catch {
    /* storage disabled — anonymous session-only */
  }
  return id;
}

export type TrackEvent = {
  name: string;
  props?: Record<string, unknown>;
  /** Override path; default = window.location.pathname. */
  path?: string;
};

/**
 * Fire one event. Best-effort — never throws, never blocks the UI.
 * Uses sendBeacon when leaving the page so navigation events still flush.
 */
export function track(name: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    session_id: getSessionId(),
    event_name: name,
    props: props ?? {},
    path: window.location.pathname,
    referrer: document.referrer || null,
  });

  try {
    // sendBeacon is a one-way fire-and-forget that works even during
    // pagehide / unload. Falls back to fetch when not available.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon('/api/track', blob);
      if (ok) return;
    }
    fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true, // continue request even if user navigates away
    }).catch(() => {});
  } catch {
    /* swallow — analytics must never break UX */
  }
}
