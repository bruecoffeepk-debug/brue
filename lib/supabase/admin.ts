// ─────────────────────────────────────────────────────────────
// Server-only Supabase client that uses the SERVICE ROLE key.
// Bypasses RLS — use ONLY for operations the server has already
// validated as legitimate (e.g. /api/orders insert after input
// validation, /r/[id] receipt page reading a single order by id).
//
// NEVER import this from a client component. Next.js will refuse
// to bundle it because of the "server-only" import below.
// ─────────────────────────────────────────────────────────────

import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Vercel: Project Settings → Environment Variables). Get it from Supabase → Settings → API → service_role.'
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
