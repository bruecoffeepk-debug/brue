'use client';

/**
 * ZoneProvider — knows which covered neighbourhood the current visitor
 * picked, and exposes a `canOrder` gate that Order/Add-to-cart CTAs
 * consult across the public surface.
 *
 *   const { status, area, canOrder, openGate, reset } = useZone();
 *
 * Status values:
 *   'unknown'  — first visit, no decision yet
 *   'in'       — picked a covered area, ordering allowed
 *   'browsing' — explicitly chose "my area isn't here, just browsing"
 *
 * The decision persists in localStorage under `brue.zone.v2` so repeat
 * visitors don't get asked again. A small chip in the nav lets them
 * re-open the gate to change it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SHOP, findDeliveryArea, type DeliveryArea } from './shop';

const STORAGE_KEY = 'brue.zone.v2';
// Invalidate stored decisions older than 30 days — if someone moves or
// comes back a month later, re-ask in case the covered list changed.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ZoneStatus = 'unknown' | 'in' | 'browsing';

type Stored = {
  v: 2;
  status: ZoneStatus;
  areaId: string | null;
  checkedAt: number;
};

export type ZoneState = {
  status: ZoneStatus;
  area: DeliveryArea | null;
  areaId: string | null;
  /** convenience — visitor picked a covered area */
  canOrder: boolean;
  /** hydration finished — safe to render zone-dependent UI */
  resolved: boolean;
  gateOpen: boolean;
  openGate: () => void;
  closeGate: () => void;
  reset: () => void;
  /** Pick a covered area. Returns false if the id isn't in the covered list. */
  setArea: (id: string) => boolean;
  /** Explicit "my area isn't here — just browsing". */
  setBrowsing: () => void;
};

const Ctx = createContext<ZoneState | null>(null);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ZoneStatus>('unknown');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        if (parsed?.v === 2 && Date.now() - parsed.checkedAt < TTL_MS) {
          // Re-validate that the stored area is still covered. If the
          // owner removed it, wipe and re-ask.
          if (parsed.status === 'in') {
            const stillCovered = findDeliveryArea(parsed.areaId);
            if (stillCovered) {
              setStatus('in');
              setAreaId(parsed.areaId);
              setResolved(true);
              return;
            }
          } else if (parsed.status === 'browsing') {
            setStatus('browsing');
            setResolved(true);
            return;
          }
        }
      }
    } catch {
      /* corrupt value — ignore */
    }
    // First visit (or stale) — open the gate after the page paints.
    setResolved(true);
    const t = window.setTimeout(() => setGateOpen(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  const persist = useCallback((next: Omit<Stored, 'v' | 'checkedAt'>) => {
    if (typeof window === 'undefined') return;
    const payload: Stored = { v: 2, checkedAt: Date.now(), ...next };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage disabled / quota — fine */
    }
  }, []);

  const setArea = useCallback(
    (id: string): boolean => {
      const covered = findDeliveryArea(id);
      if (!covered) return false;
      setStatus('in');
      setAreaId(id);
      persist({ status: 'in', areaId: id });
      return true;
    },
    [persist]
  );

  const setBrowsing = useCallback(() => {
    setStatus('browsing');
    setAreaId(null);
    persist({ status: 'browsing', areaId: null });
  }, [persist]);

  const reset = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setStatus('unknown');
    setAreaId(null);
    setGateOpen(true);
  }, []);

  const openGate = useCallback(() => setGateOpen(true), []);
  const closeGate = useCallback(() => setGateOpen(false), []);

  const area = useMemo(() => findDeliveryArea(areaId) ?? null, [areaId]);

  const value = useMemo<ZoneState>(
    () => ({
      status,
      area,
      areaId,
      canOrder: status === 'in',
      resolved,
      gateOpen,
      openGate,
      closeGate,
      reset,
      setArea,
      setBrowsing,
    }),
    [status, area, areaId, resolved, gateOpen, openGate, closeGate, reset, setArea, setBrowsing]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useZone(): ZoneState {
  const v = useContext(Ctx);
  if (!v) {
    // Fail soft — ordering stays locked if someone forgot the provider.
    return {
      status: 'unknown',
      area: null,
      areaId: null,
      canOrder: false,
      resolved: false,
      gateOpen: false,
      openGate: () => {},
      closeGate: () => {},
      reset: () => {},
      setArea: () => false,
      setBrowsing: () => {},
    };
  }
  return v;
}
