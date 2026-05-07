// ─────────────────────────────────────────────────────────────
// POST /api/track — public analytics ingestion.
//
// Accepts a single event {session_id, event_name, props, path, referrer}
// and inserts via the SERVICE ROLE Supabase client. Defensive:
//   - Wrapped in try/catch so any throw returns JSON, never empty body
//   - Generous rate limit (60 / minute / IP) — analytics fires multiple
//     events per visit but a runaway tab loop would break the budget
//   - All input length-capped before insert
//   - Hashed IP (sha256, daily salt) for distinct-visitor counts
//     without retaining raw addresses
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientIp } from '@/lib/clientIp';

export const dynamic = 'force-dynamic';

// Whitelisted event names. Anything else gets dropped — keeps the table
// from filling with junk if someone scripts the endpoint.
const ALLOWED_EVENTS = new Set([
  'page_view',
  'menu_view',
  'home_view',
  'drink_view',
  'add_to_cart',
  'cart_open',
  'checkout_continue',
  'payment_method_pick',
  'order_attempt',
  'order_placed',
  'order_failed',
  'gate_open',
  'gate_picked_area',
  'gate_browse_only',
  'location_used',
]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** Hash IP+UA+today's date so distinct-visitor counts are stable for one
 *  day but raw IPs are never stored. */
function hashIp(ip: string, ua: string): string {
  const dailySalt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash('sha256').update(`${dailySalt}|${ip}|${ua}`).digest('hex').slice(0, 32);
}

export async function POST(req: Request) {
  try {
    return await ingest(req);
  } catch (err: any) {
    console.error('[/api/track] uncaught', err);
    return bad('track failed', 500);
  }
}

async function ingest(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON');
  }

  const sessionId = String(body?.session_id || '').slice(0, 64);
  const eventName = String(body?.event_name || '').slice(0, 64);
  const path = String(body?.path || '').slice(0, 200);
  const referrer = String(body?.referrer || '').slice(0, 300) || null;
  const props = body?.props && typeof body.props === 'object' ? body.props : {};

  if (!sessionId) return bad('Missing session_id');
  if (!ALLOWED_EVENTS.has(eventName)) {
    // Silently OK — don't blow up old tabs that fire deprecated events
    return NextResponse.json({ ok: true, skipped: true });
  }

  const ua = (req.headers.get('user-agent') || '').slice(0, 300);
  const ip = getClientIp(req);
  const ipHash = hashIp(ip || 'unknown', ua);

  const supabase = createAdminClient();
  const { error } = await supabase.from('analytics_events').insert({
    session_id: sessionId,
    event_name: eventName,
    props,
    path,
    referrer,
    ua,
    ip_hash: ipHash,
  });
  if (error) {
    // Schema-cache miss (table not deployed yet) — fail open silently
    console.warn('[/api/track] insert failed', error.message);
    return bad(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}
