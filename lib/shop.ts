// ─────────────────────────────────────────────────────────────
// BRUE · single source of truth for shop info
// Edit this file once — Find Us page, footer, cart, hours chip
// and delivery zone all read from here.
// ─────────────────────────────────────────────────────────────

export const SHOP = {
  name: 'BRUE',
  tagline: 'Cold coffee, slowly brewed & poured.',
  city: 'Karachi',
  country: 'Pakistan',

  // Replace with your exact pin. Get from Google Maps:
  //   right-click the pin → the first row is "lat, lng" — paste it here.
  // Default below is central Karachi (DHA Phase 6 commercial). REPLACE THIS.
  lat: 24.921676545656283, 
  lng: 67.0560994423303,

  // Public-facing address (one line on the find-us card).
  address: 'Karachi, Pakistan',

  // Original Google Maps share link the owner provided.
  googleMapsLink: 'https://maps.app.goo.gl/3Q47bySzQsZ4QUVPA',

  // Built from {lat,lng} — used by the "Open in Google Maps" CTA when you
  // want directions from wherever the visitor is.
  get directionsLink() {
    return `https://www.google.com/maps/dir/?api=1&destination=${this.lat},${this.lng}`;
  },

  // Used by the iframe map embed on /find-us.
  get embedSrc() {
    // q= centers the marker; t=m for the standard map style.
    return `https://www.google.com/maps?q=${this.lat},${this.lng}&z=16&output=embed`;
  },

  // Social handles — render with theme-styled icon chips.
  instagram: {
    handle: '@bruecoffeepk',
    url: 'https://instagram.com/bruecoffeepk',
  },

  // Public phone (display string). Leave '' to hide.
  phoneDisplay: '',
  phoneTel: '',

  // ── DELIVERY ──────────────────────────────────────────────
  // Radius-based coverage. Anyone within `radiusKm` of the shop pin
  // (computed from SHOP.lat/lng) can order. The legacy `areas` array
  // below is kept for marketing copy on /find-us only — it is NOT
  // enforced anywhere. The radius is the only gate.
  delivery: {
    radiusKm: 6,
    methods: [
      { id: 'bykea', label: 'Bykea',   note: 'You book on the Bykea app · pay rider' },
      { id: 'indrive', label: 'inDrive', note: 'You book on inDrive app · pay rider' },
      { id: 'whatsapp', label: 'WhatsApp', note: 'We coordinate a rider on WhatsApp' },
    ] as const,
    /** Display-only — listed on /find-us as the neighbourhoods within the
     *  radius. Not enforced; the actual gate is the haversine distance. */
    areas: [
      // FB Area — blocks 4-7 + 10-13
      { id: 'fb-4',  label: 'Block 4',  cluster: 'FB Area' },
      { id: 'fb-5',  label: 'Block 5',  cluster: 'FB Area' },
      { id: 'fb-6',  label: 'Block 6',  cluster: 'FB Area' },
      { id: 'fb-7',  label: 'Block 7',  cluster: 'FB Area' },
      { id: 'fb-10', label: 'Block 10', cluster: 'FB Area' },
      { id: 'fb-11', label: 'Block 11', cluster: 'FB Area' },
      { id: 'fb-12', label: 'Block 12', cluster: 'FB Area' },
      { id: 'fb-13', label: 'Block 13', cluster: 'FB Area' },
      // North Nazimabad — blocks B/F/G/H/L/M
      { id: 'nn-b',  label: 'Block B',  cluster: 'North Nazimabad' },
      { id: 'nn-f',  label: 'Block F',  cluster: 'North Nazimabad' },
      { id: 'nn-g',  label: 'Block G',  cluster: 'North Nazimabad' },
      { id: 'nn-h',  label: 'Block H',  cluster: 'North Nazimabad' },
      { id: 'nn-l',  label: 'Block L',  cluster: 'North Nazimabad' },
      { id: 'nn-m',  label: 'Block M',  cluster: 'North Nazimabad' },
    ] as const,
  },

  // ── HOURS ────────────────────────────────────────────────
  // Times are 24-h. Crossing midnight is fine — set close > 24 (e.g. 25 = 1am next day).
  // Days: 0 = Sunday, 1 = Mon, … 6 = Sat
  hours: [
    { day: 1, open: 8,  close: 24, label: 'Mon' },
    { day: 2, open: 8,  close: 24, label: 'Tue' },
    { day: 3, open: 8,  close: 24, label: 'Wed' },
    { day: 4, open: 8,  close: 24, label: 'Thu' },
    { day: 5, open: 8,  close: 25, label: 'Fri' }, // until 1 am
    { day: 6, open: 9,  close: 25, label: 'Sat' }, // until 1 am
    { day: 0, open: 9,  close: 24, label: 'Sun' },
  ] as const,

  // Display string used on the footer + nav chip when we don't compute live.
  hoursSummary: 'Mon — Sun · 8 am — late',

  // Asia/Karachi is UTC+5 with no DST. Server time will differ from shop time on Vercel
  // (which runs UTC), so we always compute hours in Karachi time.
  timezone: 'Asia/Karachi',
  utcOffsetHours: 5,
} as const;

export type DeliveryMethodId = (typeof SHOP.delivery.methods)[number]['id'];
export type DeliveryAreaId   = (typeof SHOP.delivery.areas)[number]['id'];
export type DeliveryArea     = (typeof SHOP.delivery.areas)[number];

/** Look up a covered area by slug. Returns undefined if not covered. */
export function findDeliveryArea(id: string | null | undefined): DeliveryArea | undefined {
  if (!id) return undefined;
  return SHOP.delivery.areas.find((a) => a.id === id);
}

/** Group the covered areas by cluster (FB Area / North Nazimabad / …) for
 *  the picker UI. Preserves declaration order within each cluster. */
export function deliveryAreaClusters(): { cluster: string; areas: DeliveryArea[] }[] {
  const map = new Map<string, DeliveryArea[]>();
  for (const a of SHOP.delivery.areas) {
    if (!map.has(a.cluster)) map.set(a.cluster, []);
    map.get(a.cluster)!.push(a);
  }
  return Array.from(map, ([cluster, areas]) => ({ cluster, areas }));
}

/** Short marketing summary: "Within 6km of BRUE · FB Area + North Nazimabad". */
export function deliverySummary(): string {
  const clusters = deliveryAreaClusters();
  return `Within ${SHOP.delivery.radiusKm} km · ${clusters.map((c) => c.cluster).join(' + ')}`;
}

// ─── DISTANCE GATE ───────────────────────────────────────────
// Haversine distance + simple "in range?" check. Used by both the
// welcome gate and /api/orders so the same rule applies client and
// server.

/** Great-circle distance in kilometres between two lat/lng points. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance from BRUE to the supplied point, in km. */
export function distanceFromShopKm(point: { lat: number; lng: number }): number {
  return haversineKm({ lat: SHOP.lat, lng: SHOP.lng }, point);
}

/** True if a lat/lng is within our delivery radius. */
export function isWithinDeliveryRange(point: { lat: number; lng: number }): boolean {
  return distanceFromShopKm(point) <= SHOP.delivery.radiusKm;
}

// ─── PAYMENT OPTIONS (web checkout) ──────────────────────────
// Customer picks one of these on the checkout's payment step. We don't
// process payments online — staff verify in their own JazzCash/SadaPay
// /Faysal app before accepting the order in /admin/orders.
//
// Cash on delivery is intentionally NOT here for the web flow.

export type PaymentOption = {
  id: string;             // stored in orders.payment_method
  label: string;          // shown on the picker
  kind: 'bank' | 'fintech';
  emoji?: string;
  // Account details, all displayed with copy buttons
  accountName: string;
  accountNumber: string;  // IBAN for bank, mobile number for fintech
  accountNumberLabel?: string; // "IBAN", "Mobile number", etc.
  bankName?: string;
  branch?: string;
  // QR image path under /public/payment/. If undefined, no QR shown.
  qrImage?: string;
  // Short instructions shown above the details
  note?: string;
};

export const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'faysal-bank',
    label: 'Faysal Bank — IBFT',
    kind: 'bank',
    emoji: '🏦',
    accountName: 'BRUE COFFEE STUDIO',
    accountNumber: 'PK03FAYS3066301000007502',
    accountNumberLabel: 'IBAN',
    bankName: 'Faysal Bank',
    branch: 'IBB Ayesha Manzil, Karachi',
    qrImage: '/payment/faysal-bank-qr.jpg',
    note: 'Scan with any banking app or transfer via IBFT.',
  },
  {
    id: 'nayapay',
    label: 'NayaPay',
    kind: 'fintech',
    emoji: '💳',
    accountName: 'BRUE COFFEE STUDIO',
    accountNumber: '03347639801',
    accountNumberLabel: 'NayaPay number',
    note: 'Send via the NayaPay app to the number above.',
  },
  {
    id: 'sadapay',
    label: 'SadaPay',
    kind: 'fintech',
    emoji: '💸',
    accountName: 'BRUE COFFEE STUDIO',
    accountNumber: '03347639801',
    accountNumberLabel: 'SadaPay number',
    note: 'Send via the SadaPay app to the number above.',
  },
  {
    id: 'jazzcash',
    label: 'JazzCash',
    kind: 'fintech',
    emoji: '📱',
    accountName: 'BRUE COFFEE STUDIO',
    accountNumber: '03347639801',
    accountNumberLabel: 'JazzCash number',
    note: 'Send via the JazzCash app to the number above.',
  },
];

/** Find a payment option by id. Returns undefined if invalid. */
export function findPaymentOption(id: string | null | undefined): PaymentOption | undefined {
  if (!id) return undefined;
  return PAYMENT_OPTIONS.find((p) => p.id === id);
}

// ─── PROMO CODES ─────────────────────────────────────────────
// Hard-coded for now — small set, easy to manage, server validates against
// this same list so the client can't fake a code. To add codes later, just
// drop a new entry here. To disable, set active: false.

export type PromoCode = {
  code: string;          // canonical uppercase code
  label: string;         // shown on receipt + admin
  discountPct: number;   // 0–100
  active: boolean;
  channel?: 'web' | 'pos' | 'both'; // where it's redeemable
};

export const PROMO_CODES: PromoCode[] = [
  {
    code: 'BRUE15',
    label: '15% off — BRUE15',
    discountPct: 15,
    active: true,
    channel: 'both',
  },
];

/** Look up a promo by code (case-insensitive). Returns undefined if invalid
 *  or inactive. Caller still has to honour the channel restriction. */
export function findPromoCode(raw: string | null | undefined): PromoCode | undefined {
  if (!raw) return undefined;
  const code = raw.trim().toUpperCase();
  return PROMO_CODES.find((p) => p.code === code && p.active);
}

/** Compute the line-item discount for a subtotal given a promo code. Returns
 *  { discount, label } or { discount: 0 } if the code is missing/invalid for
 *  this channel. */
export function applyPromo(
  subtotal: number,
  rawCode: string | null | undefined,
  channel: 'web' | 'pos'
): { discount: number; promo: PromoCode | null } {
  const promo = findPromoCode(rawCode);
  if (!promo) return { discount: 0, promo: null };
  if (promo.channel && promo.channel !== 'both' && promo.channel !== channel) {
    return { discount: 0, promo: null };
  }
  const discount = Math.max(0, Math.round((subtotal * promo.discountPct) / 100));
  return { discount, promo };
}
