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

/** Promise-wrapped geolocation. Throws if the user denies / unavailable. */
export function getDeviceLocation(timeoutMs = 8000): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied'));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error('Could not read your location'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('Location request timed out — try again'));
        } else {
          reject(new Error(err.message || 'Location unavailable'));
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    );
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

/** Heuristic: does the reverse-geocode result match one of our covered
 *  areas? We check both cluster (e.g. "FB Area") + block label substring. */
export function matchCoveredArea(parts: AddressParts): DeliveryArea | null {
  const haystack = `${parts.areaName} ${parts.blockNo} ${parts.display}`.toLowerCase();
  for (const a of SHOP.delivery.areas) {
    const cluster = a.cluster.toLowerCase();
    const label = a.label.toLowerCase();
    if (haystack.includes(cluster) && haystack.includes(label)) return a;
  }
  // Soft fallback: just match on cluster, then leave block to the user.
  for (const a of SHOP.delivery.areas) {
    if (haystack.includes(a.cluster.toLowerCase())) return a;
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
