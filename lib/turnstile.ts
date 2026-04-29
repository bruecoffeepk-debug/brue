// ─────────────────────────────────────────────────────────────
// Cloudflare Turnstile verification (server-side).
//
// Called from /api/orders POST. Fails OPEN if TURNSTILE_SECRET_KEY
// is not set (logs once) so a missing env var can't take checkout
// offline. The widget on the client also no-ops when
// NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set.
//
// Setup: https://dash.cloudflare.com/?to=/:account/turnstile →
// "Add site" → mode "Managed" → copy site key + secret key into
// NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.
// ─────────────────────────────────────────────────────────────

import 'server-only';

let warned = false;
function warnOnce(msg: string) {
  if (warned) return;
  warned = true;
  console.warn(`[turnstile] ${msg}`);
}

export type TurnstileResult =
  | { ok: true; configured: boolean }
  | { ok: false; reason: string };

/**
 * Verify a Turnstile token against Cloudflare's siteverify endpoint.
 *
 * - Returns { ok: true, configured: false } if the SECRET key isn't set
 *   (development / before setup). Caller can decide to allow or reject.
 * - Returns { ok: true, configured: true } on a verified token.
 * - Returns { ok: false } on missing token or failed verification.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    warnOnce(
      'TURNSTILE_SECRET_KEY not set — /api/orders is not CAPTCHA-protected. Add it from Cloudflare → Turnstile → your site.'
    );
    return { ok: true, configured: false };
  }

  if (!token) return { ok: false, reason: 'missing-token' };

  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token);
  if (remoteIp) params.append('remoteip', remoteIp);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
      // siteverify is fast (<200ms) but never let it stall the request
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, reason: `siteverify-http-${res.status}` };
    }
    const data = (await res.json()) as {
      success: boolean;
      'error-codes'?: string[];
      hostname?: string;
    };
    if (!data.success) {
      return { ok: false, reason: (data['error-codes'] || []).join(',') || 'verification-failed' };
    }
    return { ok: true, configured: true };
  } catch (err: any) {
    return { ok: false, reason: `siteverify-error-${err?.name || 'unknown'}` };
  }
}
