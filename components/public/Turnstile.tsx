'use client';

// ─────────────────────────────────────────────────────────────
// Cloudflare Turnstile widget — invisible / managed challenge.
//
// Renders nothing visible if NEXT_PUBLIC_TURNSTILE_SITE_KEY is not
// set. When set, lazy-loads the Cloudflare script and mounts the
// widget in "managed" mode — the user only sees a checkbox if
// Cloudflare actually thinks they look automated.
//
// Usage:
//   const [token, setToken] = useState<string | null>(null);
//   <Turnstile onToken={setToken} />
//   // pass `token` in the /api/orders body as `cf_token`
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          appearance?: 'always' | 'execute' | 'interaction-only';
          retry?: 'auto' | 'never';
        }
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit';

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const mount = () => {
      if (!window.turnstile || !containerRef.current) return;
      // already rendered
      if (widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        appearance: 'interaction-only', // hide widget unless human interaction needed
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
        retry: 'auto',
      });
    };

    if (window.turnstile) {
      mount();
    } else {
      // Define callback before the script loads so Turnstile invokes it
      window.onloadTurnstileCallback = mount;
      const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`);
      if (!existing) {
        const s = document.createElement('script');
        s.src = SCRIPT_SRC;
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onToken]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="cf-turnstile" />;
}
