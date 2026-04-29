// ─────────────────────────────────────────────────────────────
// Extract the real client IP from a request, accounting for the
// reverse-proxy chain in Vercel (and Cloudflare if it's in front).
//
// Order of preference:
//   1. cf-connecting-ip       — Cloudflare (most reliable when present)
//   2. x-real-ip              — single upstream proxy
//   3. x-forwarded-for[0]     — Vercel sets this; first hop is the client
//   4. fallback "unknown"     — should not happen on Vercel
//
// ⚠️ Headers are forgeable from arbitrary clients hitting the origin
// directly. On Vercel they're trusted because Vercel rewrites them at
// the edge — but if you ever expose your origin separately, sanitise.
// ─────────────────────────────────────────────────────────────

export function getClientIp(req: Request): string {
  const h = req.headers;
  const cf = h.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return 'unknown';
}
