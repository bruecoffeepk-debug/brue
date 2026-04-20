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
  lat: 24.8050,
  lng: 67.0500,

  // Public-facing address (one line on the find-us card).
  address: 'Karachi, Pakistan',

  // Original Google Maps share link the owner provided.
  googleMapsLink: 'https://share.google/Q7wDCor5jqiIbbjS3',

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
  delivery: {
    radiusKm: 2, // hard cap — beyond this, the cart blocks delivery
    methods: [
      { id: 'bykea', label: 'Bykea',   note: 'You book on the Bykea app · pay rider' },
      { id: 'indrive', label: 'inDrive', note: 'You book on inDrive app · pay rider' },
      { id: 'whatsapp', label: 'WhatsApp', note: 'We coordinate a rider on WhatsApp' },
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
