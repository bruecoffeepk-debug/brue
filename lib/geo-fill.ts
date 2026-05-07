// ─────────────────────────────────────────────────────────────
// Geolocation + reverse-geocode helper for address auto-fill.
//
// Used in two places:
//   - WelcomeGate: tries to auto-pick a covered area from the visitor's
//     current GPS, so they don't have to scroll the cluster list.
//   - CheckoutDrawer: same call, fills the house / block / area fields
//     so the checkout payload matches what the gate stored.
//
// Reverse geocoding uses Nominatim (free, no API key, OSM data). It's
// rate-limited (~1 req/sec) but for a coffee shop's traffic that's
// plenty. We fall back gracefully when coverage is missing.
// ─────────────────────────────────────────────────────────────

import { SHOP, findDeliveryArea, type DeliveryArea } from './shop';

export type GeoLocation = { lat: number; lng: number };

export type AddressParts = {
  houseNo: string;       // best-effort — Nominatim's `house_number`
  blockNo: string;       // e.g. "Block 7" — parsed from `suburb` / `neighbourhood`
  areaName: string;      // e.g. "FB Area" — parsed from `neighbourhood` / `quarter`
  road: string;          // street name fallback
  display: string;       // raw display_name from Nominatim
};

export type AutoFillResult = {
  loc: GeoLocation;
  parts: AddressParts;
  matchedArea: DeliveryArea | null;   // closest covered area, if any
};

/** Promise-wrapped geolocation. Throws if the user denies / unavailable.
 *
 *  Why this is more aggressive than a default getCurrentPosition call:
 *  - `maximumAge: 0` forces a fresh fix so we don't pick up a cached
 *    low-precision IP-based location from earlier in the session
 *    (this was making the welcome-gate call return "Nazimabad district"
 *    while the checkout call seconds later returned the precise block).
 *  - High accuracy + 14s timeout so GPS has time to lock on (iOS GPS
 *    can take ~5–8 seconds from a cold start).
 *  - watchPosition fallback: GPS fix often comes in stages (network
 *    location first, then GPS). We listen for updates and resolve with
 *    the FIRST reading that has accuracy ≤ 100m, OR after timeout
 *    accept whatever we have. */
export function getDeviceLocation(timeoutMs = 14000): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location not supported on this device'));
      return;
    }

    let resolved = false;
    let bestSoFar: { loc: GeoLocation; acc: number } | null = null;
    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy ?? 9999;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!bestSoFar || acc < bestSoFar.acc) bestSoFar = { loc, acc };
        // Accept the first reading accurate to ≤ 100 metres — that's
        // good enough to tell which block on a Karachi map.
        if (acc <= 100 && !resolved) {
          resolved = true;
          navigator.geolocation.clearWatch(watchId);
          resolve(loc);
        }
      },
      (err) => {
        if (resolved) return;
        resolved = true;
        navigator.geolocation.clearWatch(watchId);
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Location permission denied'));
        else if (err.code === err.POSITION_UNAVAILABLE) reject(new Error('Could not read your location'));
        else if (err.code === err.TIMEOUT) reject(new Error('Location request timed out — try again'));
        else reject(new Error(err.message || 'Location unavailable'));
      },
      opts
    );

    // Timeout safety net — accept the best reading we have so far,
    // even if its accuracy is worse than 100m.
    setTimeout(() => {
      if (resolved) return;
      navigator.geolocation.clearWatch(watchId);
      resolved = true;
      if (bestSoFar) resolve(bestSoFar.loc);
      else reject(new Error('Location request timed out — try again'));
    }, timeoutMs + 500);
  });
}

/** Reverse geocode via Nominatim. Returns best-effort address parts. */
export async function reverseGeocode(loc: GeoLocation): Promise<AddressParts> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${loc.lat}&lon=${loc.lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
  const data = await res.json();
  const addr = data?.address || {};

  // Nominatim's Karachi tagging is messy — try several keys per slot.
  const houseNo = String(addr.house_number || '').trim();
  const road = String(addr.road || addr.pedestrian || '').trim();

  // Block number — e.g. "Block 7" sometimes lands in `suburb`,
  // `neighbourhood`, or `quarter`. Pull the first one that contains "block".
  let blockNo = '';
  for (const key of ['suburb', 'neighbourhood', 'quarter', 'city_district', 'hamlet']) {
    const v = String(addr[key] || '').trim();
    if (/block/i.test(v)) {
      blockNo = v;
      break;
    }
  }

  // Area name — FB Area / North Nazimabad / etc. Try `neighbourhood`,
  // `suburb`, or `city_district` that DOESN'T contain "block".
  let areaName = '';
  for (const key of ['neighbourhood', 'suburb', 'quarter', 'city_district']) {
    const v = String(addr[key] || '').trim();
    if (v && !/block/i.test(v) && v !== blockNo) {
      areaName = v;
      break;
    }
  }

  return {
    houseNo,
    blockNo,
    areaName,
    road,
    display: String(data?.display_name || '').trim(),
  };
}

/** Map a Nominatim-detected area string to one of our covered clusters.
 *  Nominatim sometimes returns "Nazimabad" (broader) while our list says
 *  "North Nazimabad" — without this mapping the user gets a useless hint
 *  and an empty search filter.
 *
 *  Returns the canonical cluster string from SHOP.delivery.areas, or "". */
export function smartClusterHint(parts: AddressParts): string {
  const haystack = `${parts.areaName} ${parts.blockNo} ${parts.display}`.toLowerCase();

  // Build a map of cluster -> common aliases / substring matches.
  // Only the substring needs to match; cluster name is the canonical reply.
  const aliases: { needles: string[]; cluster: string }[] = [
    { needles: ['north nazimabad', 'nazimabad'], cluster: 'North Nazimabad' },
    { needles: ['fb area', 'federal b area', 'federal-b area'], cluster: 'FB Area' },
  ];
  for (const a of aliases) {
    if (a.needles.some((n) => haystack.includes(n))) {
      // Verify the canonical name actually exists in our covered list
      // (defensive — if the owner removes a cluster from SHOP, this still
      // degrades gracefully).
      const exists = SHOP.delivery.areas.some(
        (x) => x.cluster.toLowerCase() === a.cluster.toLowerCase()
      );
      if (exists) return a.cluster;
    }
  }
  return '';
}

/** Heuristic: does the reverse-geocode result match one of our covered
 *  areas? We check both cluster (e.g. "FB Area") + block label substring.
 *  Block matching is intentionally tight — if it's not a good match we
 *  return null, the caller should NOT auto-pick anything. */
export function matchCoveredArea(parts: AddressParts): DeliveryArea | null {
  const haystack = `${parts.areaName} ${parts.blockNo} ${parts.display}`.toLowerCase();
  // Both cluster AND block must appear in the haystack
  for (const a of SHOP.delivery.areas) {
    const cluster = a.cluster.toLowerCase();
    const label = a.label.toLowerCase();
    if (haystack.includes(cluster) && haystack.includes(label)) return a;
  }
  return null;
}

/** One-shot: geolocate → reverse-geocode → match covered area. */
export async function autoFillAddress(): Promise<AutoFillResult> {
  const loc = await getDeviceLocation();
  const parts = await reverseGeocode(loc);
  const matchedArea = matchCoveredArea(parts);
  return { loc, parts, matchedArea };
}

/** Strict PK-mobile validator. Returns digits-only normalised number
 *  (e.g. "923001234567") on success, null on failure. */
export function validatePkPhone(raw: string): string | null {
  let d = (raw || '').replace(/\D+/g, '');
  if (!d) return null;
  if (d.startsWith('0092')) d = d.slice(2);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1);
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d;
  // Final shape: exactly 12 digits, starts with 923 (PK mobile)
  if (!/^923\d{9}$/.test(d)) return null;
  return d;
}

/** "923001234567" → "+92 300 1234567" for display. */
export function formatPkPhone(d: string): string {
  if (!/^923\d{9}$/.test(d)) return d;
  return `+92 ${d.slice(2, 5)} ${d.slice(5)}`;
}
