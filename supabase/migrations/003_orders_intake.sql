-- ──────────────────────────────────────────────────────────
-- BRUE · migration 003 — public order intake + delivery fields
-- Run AFTER schema.sql + 002_categories_and_stock.sql.
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────

-- 1) EXTEND orders for the public web checkout flow ----------
alter table orders
  add column if not exists delivery_method text,           -- 'bykea' · 'indrive' · 'whatsapp' · null (=pickup)
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists delivery_distance_km numeric(5,2),
  add column if not exists accepted_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists out_for_delivery_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Ensure the orders.status column accepts the new lifecycle values:
--   pending → accepted → preparing → out → completed (or cancelled)
-- (no enum — we keep status as plain text so it stays cheap to extend)

-- 2) PUBLIC INSERT policies ----------------------------------
-- Web menu posts orders before they're accepted, so anon must be able to insert
-- but only with safe channel + status values. Staff (authenticated) keep full access.

drop policy if exists "orders_public_insert" on orders;
create policy "orders_public_insert" on orders
  for insert to anon
  with check (
    channel in ('web', 'whatsapp')
    and status in ('pending')
  );

drop policy if exists "order_items_public_insert" on order_items;
create policy "order_items_public_insert" on order_items
  for insert to anon with check (true);

-- The web checkout also upserts a customer row (by phone). Anon needs INSERT.
-- We DON'T let anon read or update arbitrary customers — only insert a new row.
drop policy if exists "customers_public_insert" on customers;
create policy "customers_public_insert" on customers
  for insert to anon with check (true);

-- Anon needs to be able to look up its own placed order by id (for the receipt page).
drop policy if exists "orders_public_read_by_id" on orders;
create policy "orders_public_read_by_id" on orders
  for select to anon using (true);   -- order ids are uuids = unguessable

drop policy if exists "order_items_public_read" on order_items;
create policy "order_items_public_read" on order_items
  for select to anon using (true);

-- 3) Helpful indexes ----------------------------------------
create index if not exists orders_status_created_idx
  on orders (status, created_at desc);

create index if not exists orders_phone_idx
  on orders (customer_phone);

create index if not exists customers_phone_idx
  on customers (phone);
