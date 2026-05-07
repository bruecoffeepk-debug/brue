'use client';

// Mounts at the public layout level via PublicShell. Fires a `page_view`
// event whenever the path changes, plus a more specific `home_view` /
// `menu_view` so the dashboard can compute funnel rates without parsing
// the path string.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    track('page_view', { path: pathname });
    if (pathname === '/' || pathname === '/home') track('home_view');
    if (pathname === '/menu') track('menu_view');
  }, [pathname]);

  return null;
}
