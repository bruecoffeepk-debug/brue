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
import { SHOP, type DeliveryMethodId } from '@/lib/shop';
import { haversineKm } from '@/lib/geo';

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
    address: string;
    lat?: number | null;
    lng?: number | null;
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

  // ── delivery validation (2km cap) ──
  let delivery_method: string | null = null;
  let delivery_address: string | null = null;
  let delivery_lat: number | null = null;
  let delivery_lng: number | null = null;
  let delivery_distance_km: number | null = null;

  if (body.type === 'delivery') {
    if (!body.delivery) return bad('Delivery details missing');
    const m = SHOP.delivery.methods.find((x) => x.id === body.delivery!.method);
    if (!m) return bad('Pick a delivery method');
    delivery_method = m.id;
    delivery_address = (body.delivery.address || '').trim();
    if (!delivery_address) return bad('Delivery address required');

    if (body.delivery.lat != null && body.delivery.lng != null) {
      delivery_lat = Number(body.delivery.lat);
      delivery_lng = Number(body.delivery.lng);
      const km = haversineKm(
        { lat: SHOP.lat, lng: SHOP.lng },
        { lat: delivery_lat, lng: delivery_lng }
      );
      delivery_distance_km = Math.round(km * 100) / 100;
      if (km > SHOP.delivery.radiusKm) {
        return bad(
          `Sorry — you're ${delivery_distance_km} km away. We deliver within ${SHOP.delivery.radiusKm} km. Try pickup instead.`
        );
      }
    }
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
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id,
      customer_name: name,
      customer_phone: phone,
      order_type: body.type,
      delivery_address,
      delivery_method,
      delivery_lat,
      delivery_lng,
      delivery_distance_km,
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
