-- ============================================================
-- BRUE · Migration 010 — analytics_events
-- ============================================================
-- Stores anonymous funnel events (page_view, drink_view, add_to_cart,
-- checkout_open, checkout_continue, checkout_paid_click, order_placed)
-- so the /admin/analytics dashboard can compute conversion rates,
-- top drinks, and drop-off points.
--
-- session_id is a client-side localStorage UUID. No PII is stored —
-- name / phone / address live on `orders`. Events get a 90-day TTL
-- via a daily cron'd cleanup (run manually for now; see bottom).
--
-- Idempotent. Wrapped in a transaction.
-- ============================================================

begin;

create table if not exists analytics_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  event_name  text not null,
  props       jsonb not null default '{}',
  path        text,
  referrer    text,
  ua          text,
  ip_hash     text,           -- sha256 of IP, for distinct-visitor counts without PII
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on analytics_events (event_name, created_at desc);
create index if not exists analytics_events_session_idx
  on analytics_events (session_id, created_at desc);
create index if not exists analytics_events_time_idx
  on analytics_events (created_at desc);

alter table analytics_events enable row level security;

-- Staff (any authenticated user) can SELECT for the dashboard.
drop policy if exists "analytics_staff_read" on analytics_events;
create policy "analytics_staff_read" on analytics_events
  for select to authenticated using (true);

-- No anon policies. Inserts go through /api/track using the SERVICE ROLE
-- client server-side — the public anon key has zero access to this table.
-- That keeps the events private (even staff can't be impersonated to spam
-- garbage events) and lets us rate-limit at the route boundary.

commit;

-- ============================================================
-- Optional cleanup — run periodically (cron / Supabase Scheduled Job)
-- ============================================================
--   delete from analytics_events where created_at < now() - interval '90 days';
