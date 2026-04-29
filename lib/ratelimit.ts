// ─────────────────────────────────────────────────────────────
// Rate limiting — Upstash Redis backed (works in Vercel serverless).
//
// Two limiters apply to /api/orders POST per IP:
//   burst   →  5  requests / minute  (catches flooding)
//   hourly  →  30 requests / hour    (catches script-driven spam)
//
// FAIL-OPEN: if UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN aren't
// set, the limiter no-ops and logs a warning ONCE per cold start. The
// site keeps working; just no rate limit. We don't want a missing env
// var to take checkout offline.
//
// To enable: create a free Upstash Redis database (https://upstash.com),
// copy the REST URL + REST TOKEN into Vercel + .env.local. See
// .env.local.example for the variable names.
// ─────────────────────────────────────────────────────────────

import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let warned = false;
function warnOnce(msg: string) {
  if (warned) return;
  warned = true;
  console.warn(`[ratelimit] ${msg}`);
}

type LimiterPair = {
  burst: Ratelimit;
  hourly: Ratelimit;
} | null;

let cached: LimiterPair | undefined;

function getLimiters(): LimiterPair {
  if (cached !== undefined) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    warnOnce(
      'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — /api/orders is NOT rate limited. Set them in Vercel → Project → Settings → Environment Variables.'
    );
    cached = null;
    return null;
  }

  const redis = new Redis({ url, token });
  cached = {
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: false,
      prefix: 'brue:orders:burst',
    }),
    hourly: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 h'),
      analytics: false,
      prefix: 'brue:orders:hourly',
    }),
  };
  return cached;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: 'burst' | 'hourly'; retryAfterSec: number };

/** Apply both rate-limit windows to one identifier (typically IP). */
export async function checkOrderRateLimit(identifier: string): Promise<RateLimitResult> {
  const limiters = getLimiters();
  if (!limiters) return { ok: true };

  // Run both checks in parallel — if either fails, return the longer wait.
  const [burst, hourly] = await Promise.all([
    limiters.burst.limit(identifier),
    limiters.hourly.limit(identifier),
  ]);

  if (!burst.success) {
    const retryAfterSec = Math.max(1, Math.ceil((burst.reset - Date.now()) / 1000));
    return { ok: false, reason: 'burst', retryAfterSec };
  }
  if (!hourly.success) {
    const retryAfterSec = Math.max(1, Math.ceil((hourly.reset - Date.now()) / 1000));
    return { ok: false, reason: 'hourly', retryAfterSec };
  }
  return { ok: true };
}
