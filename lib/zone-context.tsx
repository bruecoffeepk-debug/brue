'use client';

/**
 * ZoneProvider — radius-based delivery gate.
 *
 *   const { status, distanceKm, coords, canOrder, openGate, reset } = useZone();
 *
 * Status values:
 *   'unknown'  — first visit, no decision yet (the WelcomeGate is showing)
 *   'in'       — visitor's GPS is within SHOP.delivery.radiusKm. Ordering on.
 *   'out'      — visitor's GPS is outside the radius. Ordering off, browse only.
 *   'manual'   — visitor denied / skipped geolocation but said "I'll type my
 *                address". Ordering on; we trust the address at checkout.
 *
 * Persists for 30 days under `brue.zone.v3` so repeat visitors aren't asked
 * again. Bump the storage key version to force re-asking everyone.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SHOP, distanceFromShopKm, isWithinDeliveryRange } from './shop';

const STORAGE_KEY = 'brue.zone.v3';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ZoneStatus = 'unknown' | 'in' | 'out' | 'manual';
export type Coords = { lat: number; lng: number };

type Stored = {
  v: 3;
  status: ZoneStatus;
  coords: Coords | null;
  distanceKm: number | null;
  checkedAt: number;
};

export type ZoneState = {
  status: ZoneStatus;
  coords: Coords | null;
  distanceKm: number | null;
  /** Convenience — visitor can place an order */
  canOrder: boolean;
  /** Hydration finished — safe to render zone-dependent UI */
  resolved: boolean;
  gateOpen: boolean;
  openGate: () => void;
  closeGate: () => void;
  reset: () => void;
  /** Set GPS coords; auto-computes distance + flips status to in/out. */
  setCoords: (c: Coords) => void;
  /** Visitor opted to type their address manually (skipped GPS). */
  setManual: () => void;
};

const Ctx = createContext<ZoneState | null>(null);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ZoneStatus>('unknown');
  const [coords, setCoordsState] = useState<Coords | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [resolved, setResolved] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        if (parsed?.v === 3 && Date.now() - parsed.checkedAt < TTL_MS) {
          // Re-check whether the stored coords are still in range — owner may
          // have moved the shop pin or changed the radius.
          if (parsed.status === 'in' && parsed.coords) {
            const stillIn = isWithinDeliveryRange(parsed.coords);
            setStatus(stillIn ? 'in' : 'out');
            setCoordsState(parsed.coords);
            setDistanceKm(distanceFromShopKm(parsed.coords));
            setResolved(true);
            return;
          }
          setStatus(parsed.status);
          setCoordsState(parsed.coords);
          setDistanceKm(parsed.distanceKm);
          setResolved(true);
          return;
        }
      }
    } catch {
      /* corrupt — re-ask */
    }
    setResolved(true);
    const t = window.setTimeout(() => setGateOpen(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  const persist = useCallback(
    (next: Omit<Stored, 'v' | 'checkedAt'>) => {
      if (typeof window === 'undefined') return;
      const payload: Stored = { v: 3, checkedAt: Date.now(), ...next };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    },
    []
  );

  const setCoords = useCallback(
    (c: Coords) => {
      const km = distanceFromShopKm(c);
      const inRange = km <= SHOP.delivery.radiusKm;
      const next: ZoneStatus = inRange ? 'in' : 'out';
      setCoordsState(c);
      setDistanceKm(km);
      setStatus(next);
      persist({ status: next, coords: c, distanceKm: km });
    },
    [persist]
  );

  const setManual = useCallback(() => {
    setStatus('manual');
    setCoordsState(null);
    setDistanceKm(null);
    persist({ status: 'manual', coords: null, distanceKm: null });
  }, [persist]);

  const reset = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setStatus('unknown');
    setCoordsState(null);
    setDistanceKm(null);
    setGateOpen(true);
  }, []);

  const openGate = useCallback(() => setGateOpen(true), []);
  const closeGate = useCallback(() => setGateOpen(false), []);

  const value = useMemo<ZoneState>(
    () => ({
      status,
      coords,
      distanceKm,
      canOrder: status === 'in' || status === 'manual',
      resolved,
      gateOpen,
      openGate,
      closeGate,
      reset,
      setCoords,
      setManual,
    }),
    [status, coords, distanceKm, resolved, gateOpen, openGate, closeGate, reset, setCoords, setManual]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useZone(): ZoneState {
  const v = useContext(Ctx);
  if (!v) {
    // Fail soft — ordering stays locked if someone forgot the provider.
    return {
      status: 'unknown',
      coords: null,
      distanceKm: null,
      canOrder: false,
      resolved: true,
      gateOpen: false,
      openGate: () => {},
      closeGate: () => {},
      reset: () => {},
      setCoords: () => {},
      setManual: () => {},
    };
  }
  return v;
}
