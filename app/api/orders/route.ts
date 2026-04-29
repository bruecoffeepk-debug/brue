// ─────────────────────────────────────────────────────────────
// POST /api/orders
//
// Public endpoint called by the menu cart at checkout.
//
// Hardening done in migration 006 + this file:
//   - Uses the SERVICE ROLE Supabase client (bypasses RLS for the
//     server-trusted writes). RLS now blocks anon SELECT on orders
//     and order_items — see migrations/006_security_lockdown.sql.
//   - Looks up `price` and `cost` SERVER-SIDE from menu_items.id;
//     never trusts the client-supplied number. Ad-hoc items (no id)
//     fall back to the validated client price but cost is forced to 0.
//   - Validates `order_type`, `delivery.method`, `delivery.area_id`
//     against whitelists. Strips obvious junk.
//   - Phone normalisation respects the Pakistani country-code prefix.
//
// Returns { id, order_number, receiptUrl } so the cart can both
// store the id and open the WhatsApp deep link with the URL inside.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkOrderRateLimit } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/clientIp';
import { verifyTurnstileToken } from '@/lib/turnstile';
import {
  SHOP,
  findDeliveryArea,
  applyPromo,
  type DeliveryAreaId,
  type DeliveryMethodId,
} from '@/lib/shop';

export const dynamic = 'force-dynamic';

const VALID_ORDER_TYPES = ['pickup', 'delivery'] as const;
type OrderType = (typeof VALID_ORDER_TYPES)[number];

type IncomingItem = {
  id?: string | null;     // menu_items.id (optional — may be null for ad-hoc)
  name: string;
  price: number;          // ignored if id is present (we look up server-side)
  quantity: number;
};

type IncomingPayload = {
  customer: { name: string; phone: string };
  type: OrderType;
  delivery?: {
    method: DeliveryMethodId;
    area_id: DeliveryAreaId;
    street: string;
  };
  notes?: string | null;
  items: IncomingItem[];
  promo_code?: string | null; // server validates against PROMO_CODES
  cf_token?: string | null;   // Cloudflare Turnstile token from the client
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * Public POST entry. Wraps the real handler so ANY uncaught throw —
 * a missing env var, a Supabase outage, an Upstash hiccup — turns into
 * a JSON error response instead of an empty-body 500. The client used
 * to crash on `res.json()` ("Unexpected end of JSON input") whenever
 * Next.js fell back to its default error page.
 */
export async function POST(req: Request) {
  try {
    return await handleOrder(req);
  } catch (err: any) {
    const message =
      typeof err?.message === 'string' ? err.message : 'Unexpected server error';
    // Log the full error server-side; surface a safe, actionable message to
    // the client. Don't leak internals.
    console.error('[/api/orders] uncaught error:', err);

    // Common config errors → friendlier text.
    let publicMsg = 'Something went wrong placing your order. Please try again, or WhatsApp us.';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      publicMsg = 'Server is missing configuration — please WhatsApp us to place this order.';
    } else if (message.includes('UPSTASH_')) {
      publicMsg = 'Rate limiter misconfigured — please WhatsApp us.';
    }
    return NextResponse.json({ error: publicMsg }, { status: 500 });
  }
}

async function handleOrder(req: Request) {
  // ── origin allow-list (cheap CSRF / cross-site protection) ──
  // Browsers send Origin on POSTs; if it's set and doesn't match our host,
  // refuse. Same-origin form posts and our own fetch() calls always pass.
  // Server-to-server (curl, no Origin) is allowed because legitimate
  // automation sometimes wants this — combined with rate limiting + the
  // server-side price lookup, the blast radius stays small.
  const originHeader = req.headers.get('origin');
  if (originHeader) {
    const expectedHost = req.headers.get('host');
    let originHost = '';
    try {
      originHost = new URL(originHeader).host;
    } catch {
      return bad('Bad origin', 400);
    }
    if (expectedHost && originHost !== expectedHost) {
      // Allow Vercel preview deploys (*.vercel.app) and the main prod host.
      const isAllowed =
        originHost === expectedHost ||
        originHost.endsWith('.vercel.app') ||
        originHost === 'bruecoffeepk.com' ||
        originHost === 'www.bruecoffeepk.com' ||
        originHost === 'localhost:3000' ||
        originHost.startsWith('localhost:');
      if (!isAllowed) return bad('Cross-origin request blocked', 403);
    }
  }

  // ── rate limit (per IP) BEFORE any work ──
  // 5 / minute (burst) and 30 / hour. Fails open if Upstash isn't configured.
  const ip = getClientIp(req);
  const rl = await checkOrderRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error:
          rl.reason === 'burst'
            ? `Too many orders from this device — wait ${rl.retryAfterSec}s and try again.`
            : `Hourly limit reached. Please WhatsApp us instead — try again in ${Math.ceil(rl.retryAfterSec / 60)} min.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSec) },
      }
    );
  }

  let body: IncomingPayload;
  try {
    body = (await req.json()) as IncomingPayload;
  } catch {
    return bad('Invalid JSON');
  }

  // ── CAPTCHA (Cloudflare Turnstile) ──
  // Fail-open if Turnstile isn't configured server-side (no secret key);
  // when configured, a missing or invalid token rejects the order.
  const captcha = await verifyTurnstileToken(body?.cf_token, ip);
  if (!captcha.ok) {
    return bad('Bot check failed — refresh the page and try again.', 403);
  }

  // ── basic shape validation ──
  const name = (body?.customer?.name || '').trim().slice(0, 120);
  const phone = normalisePhone(body?.customer?.phone || '');
  if (!name) return bad('Name is required');
  if (!phone) return bad('Phone is required');
  if (!Array.isArray(body.items) || body.items.length === 0) return bad('Cart is empty');
  if (body.items.length > 50) return bad('Too many items');

  // ── order type ──
  if (!VALID_ORDER_TYPES.includes(body.type)) return bad('Invalid order type');

  // ── delivery validation (area + method whitelist) ──
  let delivery_method: string | null = null;
  let delivery_address: string | null = null;

  if (body.type === 'delivery') {
    if (!body.delivery) return bad('Delivery details missing');

    const method = SHOP.delivery.methods.find((x) => x.id === body.delivery!.method);
    if (!method) return bad('Pick a delivery method');
    delivery_method = method.id;

    const area = findDeliveryArea(body.delivery.area_id);
    if (!area) {
      return bad(
        `Sorry — your area isn't in our delivery list. We currently cover FB Area + North Nazimabad. Try pickup instead.`
      );
    }

    const street = (body.delivery.street || '').trim().slice(0, 500);
    if (!street) return bad('Street / house detail required');

    // Compose the single address string the admin sees: area first for quick routing,
    // then the free-form street / landmark.
    delivery_address = `${area.cluster} · ${area.label} — ${street}`;
  }

  // ── server-trusted Supabase client ──
  const supabase = createAdminClient();

  // ── look up canonical price + cost for every item with an id ──
  // Never trust client-supplied price. For ad-hoc items (no id), we accept the
  // client price but force cost = 0 so internal margins can't be polluted.
  const itemIds = Array.from(
    new Set(body.items.map((i) => i.id).filter((x): x is string => typeof x === 'string'))
  );
  let priceMap = new Map<string, { price: number; cost: number; name: string }>();
  if (itemIds.length > 0) {
    const { data: dbItems, error: lookupErr } = await supabase
      .from('menu_items')
      .select('id, name, price, cost, active, in_stock')
      .in('id', itemIds);
    if (lookupErr) return bad(lookupErr.message, 500);
    for (const row of dbItems || []) {
      if (!row.active || !row.in_stock) continue;
      priceMap.set(row.id, { price: row.price, cost: row.cost ?? 0, name: row.name });
    }
  }

  const items = body.items
    .map((i) => {
      const looked = i.id ? priceMap.get(i.id) : null;
      const price = looked ? looked.price : Math.max(0, Math.round(Number(i.price) || 0));
      const cost = looked ? looked.cost : 0;
      const itemName = looked ? looked.name : String(i.name || '').slice(0, 200);
      return {
        menu_item_id: i.id || null,
        name: itemName,
        price,
        cost,
        quantity: Math.min(99, Math.max(1, Math.round(Number(i.quantity) || 0))),
      };
    })
    .filter((i) => i.name && i.price > 0 && i.quantity > 0);
  if (items.length === 0) return bad('No valid items in cart');

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  // ── promo validation (server-trusted) ──
  // The client preview is just UX; the source of truth is PROMO_CODES.
  // applyPromo returns { discount: 0, promo: null } if the code is junk
  // or for a different channel — silent ignore, no error.
  const promoResult = applyPromo(subtotal, body.promo_code, 'web');
  const discount = promoResult.discount;
  const total = Math.max(0, subtotal - discount);
  const promoCodeApplied = promoResult.promo?.code || null;

  // ── upsert customer (by phone) ──
  // Service role can SELECT; we no longer race-on-conflict.
  let customer_id: string | null = null;
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  if (existingCustomer?.id) {
    customer_id = existingCustomer.id;
  } else {
    const { data: insertedCustomer, error: custInsertErr } = await supabase
      .from('customers')
      .insert({ name, phone })
      .select('id')
      .single();
    if (custInsertErr && (custInsertErr as any).code !== '23505') {
      // 23505 = unique_violation, which means a parallel request beat us;
      // fall back to a SELECT below. Anything else is a real error.
      return bad(custInsertErr.message, 500);
    }
    if (insertedCustomer?.id) {
      customer_id = insertedCustomer.id;
    } else {
      const { data: raced } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      customer_id = raced?.id ?? null;
    }
  }

  // ── insert order ──
  const notes = (body.notes || '').trim().slice(0, 1000) || null;
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id,
      customer_name: name,
      customer_phone: phone,
      order_type: body.type,
      delivery_address,
      delivery_method,
      delivery_lat: null,
      delivery_lng: null,
      delivery_distance_km: null,
      payment_method: 'unpaid',
      subtotal,
      discount,
      total,
      promo_code: promoCodeApplied,
      notes,
      status: 'pending',
      channel: 'web',
    })
    .select('id, order_number, created_at')
    .single();

  if (orderErr || !order) {
    return bad(orderErr?.message || 'Could not place order', 500);
  }

  // ── insert items ──
  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(
      items.map((i) => ({
        order_id: order.id,
        menu_item_id: i.menu_item_id,
        name: i.name,
        price: i.price,
        cost: i.cost,
        quantity: i.quantity,
        line_total: i.price * i.quantity,
      }))
    );
  if (itemsErr) {
    // Best-effort cleanup so we don't leave a half-built order around
    await supabase.from('orders').delete().eq('id', order.id);
    return bad(itemsErr.message, 500);
  }

  // ── absolute receipt URL for the WhatsApp deep link ──
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
  const receiptUrl = `${origin}/r/${order.id}`;

  return NextResponse.json({
    id: order.id,
    order_number: order.order_number,
    receiptUrl,
  });
}

/**
 * Normalise a Pakistani phone to E.164 digits without the `+`.
 *   "03001234567"     → "923001234567"
 *   "+92 300 123 4567"→ "923001234567"
 *   "923001234567"    → "923001234567"
 *   "3001234567"      → "923001234567"  (assume PK)
 *
 * For non-PK numbers (already starting with another country code),
 * we leave the digits as-is. Returns "" if input has fewer than
 * 10 digits — caller should treat as invalid.
 */
function normalisePhone(raw: string): string {
  let d = raw.replace(/\D+/g, '');
  if (d.length < 10) return '';
  // Pakistani patterns
  if (d.startsWith('0092')) d = d.slice(2);            // "0092..."  → "92..."
  if (d.startsWith('00')) d = d.slice(2);              // "00<cc>..." → "<cc>..."
  if (d.startsWith('0') && d.length === 11) {          // "03001234567"
    d = '92' + d.slice(1);
  } else if (d.length === 10 && d.startsWith('3')) {   // "3001234567"
    d = '92' + d;
  }
  // Already 92-prefixed (length 12) — leave alone.
  // Anything else (international): keep as digits.
  return d;
}
