// ─────────────────────────────────────────────────────────────
// POST /api/orders
//
// Public endpoint called by the menu cart at checkout. It runs
// with the anon Supabase key — RLS in migration 003 allows the
// minimal writes needed:
//   - INSERT one row in customers (upsert by phone, server-side)
//   - INSERT one row in orders   (channel='web', status='pending')
//   - INSERT N  rows in order_items
//
// Returns { id, order_number, receiptUrl } so the cart can both
// store the id and open the WhatsApp deep link with the URL inside.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  SHOP,
  findDeliveryArea,
  type DeliveryAreaId,
  type DeliveryMethodId,
} from '@/lib/shop';

export const dynamic = 'force-dynamic';

type IncomingItem = {
  id?: string | null;     // menu_items.id (optional — may be null for ad-hoc)
  name: string;
  price: number;
  cost?: number;
  quantity: number;
};

type IncomingPayload = {
  customer: { name: string; phone: string };
  type: 'pickup' | 'delivery';
  delivery?: {
    method: DeliveryMethodId;
    area_id: DeliveryAreaId;
    street: string;
  };
  notes?: string | null;
  items: IncomingItem[];
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  let body: IncomingPayload;
  try {
    body = (await req.json()) as IncomingPayload;
  } catch {
    return bad('Invalid JSON');
  }

  // ── validation ──
  const name = (body?.customer?.name || '').trim();
  const phone = normalisePhone(body?.customer?.phone || '');
  if (!name) return bad('Name is required');
  if (!phone) return bad('Phone is required');
  if (!Array.isArray(body.items) || body.items.length === 0) return bad('Cart is empty');

  const items = body.items
    .map((i) => ({
      menu_item_id: i.id || null,
      name: String(i.name || '').slice(0, 200),
      price: Math.max(0, Math.round(Number(i.price) || 0)),
      cost: Math.max(0, Math.round(Number(i.cost) || 0)),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 0)),
    }))
    .filter((i) => i.name && i.price > 0 && i.quantity > 0);
  if (items.length === 0) return bad('No valid items in cart');

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  // ── delivery validation (area membership) ──
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

    const street = (body.delivery.street || '').trim();
    if (!street) return bad('Street / house detail required');

    // Compose the single address string the admin sees: area first for quick routing,
    // then the free-form street / landmark. e.g.
    //   "FB Area · Block 7 — House 12-C, Sharafabad Rd, near the pharmacy"
    delivery_address = `${area.cluster} · ${area.label} — ${street}`;
  }

  const supabase = createClient();

  // ── upsert customer (by phone) ──
  // Anon RLS allows insert. We accept the duplicate-phone case (unique constraint
  // will throw); when that happens we look up the existing row by phone.
  let customer_id: string | null = null;
  const { data: insertedCustomer, error: custInsertErr } = await supabase
    .from('customers')
    .insert({ name, phone })
    .select('id')
    .single();
  if (insertedCustomer?.id) {
    customer_id = insertedCustomer.id;
  } else if (custInsertErr) {
    // 23505 = unique_violation (phone already exists). Look it up.
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();
    customer_id = existing?.id ?? null;
    // If we still couldn't get one, that's fine — order will save with null customer_id.
  }

  // ── insert order ──
  // NOTE: delivery_lat / delivery_lng / delivery_distance_km columns may still
  // exist on the orders table from the old radius-based design. We leave them
  // null now that coverage is area-based — no schema migration needed.
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
      discount: 0,
      total: subtotal,
      notes: (body.notes || '').trim() || null,
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

/** Strip non-digits, trim leading zero/+. e.g. "+92 300 1234567" → "923001234567" */
function normalisePhone(s: string): string {
  const digits = s.replace(/\D+/g, '');
  return digits.replace(/^0+/, '');
}
