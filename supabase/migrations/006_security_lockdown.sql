-- ============================================================
-- BRUE · Migration 006 — security lockdown (Apr 2026)
-- ============================================================
-- Closes the customer-data leak that migration 003 opened.
--
-- Before this migration:
--   anon can SELECT * from orders, order_items, menu_items
--   → leaks customer name/phone/address, order notes, internal cost data
--
-- After this migration:
--   anon can ONLY:
--     - SELECT name + non-cost fields from menu_items (via menu_items_public view)
--     - SELECT name/slug/emoji from categories
--     - INSERT new customers (phone upsert during checkout)
--     - INSERT new pending orders + order_items
--   anon CANNOT:
--     - SELECT orders / order_items / customers (PII protection)
--     - SELECT menu_items.cost
--
-- The receipt page (/r/[id]) and /api/orders POST handler must use a
-- SERVICE ROLE Supabase client to read/insert. See lib/supabase/admin.ts.
--
-- Idempotent. Wrapped in transaction.
-- ============================================================

begin;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Drop the over-permissive anon SELECT policies        │
-- └─────────────────────────────────────────────────────────┘

drop policy if exists "orders_public_read_by_id" on orders;
drop policy if exists "order_items_public_read"  on order_items;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Public menu view that excludes the `cost` column     │
-- └─────────────────────────────────────────────────────────┘
-- Public reads should not expose internal margin. The view filters
-- to active rows and exposes everything except `cost`.
-- Server-side reads (admin / POS) can keep using menu_items directly.

create or replace view menu_items_public as
select
  id,
  name,
  category,
  category_id,
  description,
  price,
  photo,
  active,
  in_stock,
  sort_order,
  created_at,
  updated_at
from menu_items
where active = true;

-- Grant SELECT on the view to anon (and authenticated for parity).
grant select on menu_items_public to anon, authenticated;

-- Tighten the underlying table: anon should NOT be able to select
-- menu_items.* directly (that exposes cost). Only authenticated users
-- (staff) keep full table access.
drop policy if exists "menu_public_read" on menu_items;

-- staff already have "menu_staff_all" → for all to authenticated using (true)
-- so we don't need to re-add anything for the authenticated role.

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Make sure anon still can't read customers either     │
-- └─────────────────────────────────────────────────────────┘
-- (no SELECT policy for anon was ever added, but be defensive)
drop policy if exists "customers_public_read" on customers;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Sanity: list active anon-facing policies             │
-- └─────────────────────────────────────────────────────────┘
-- Run this after to verify what anon can do:
--   select schemaname, tablename, policyname, cmd, roles
--   from pg_policies
--   where 'anon' = any(roles) order by tablename, cmd;
--
-- Expected anon-facing rows after this migration:
--   categories      | categories_public_read     | SELECT (where active)
--   customers       | customers_public_insert    | INSERT
--   orders          | orders_public_insert       | INSERT (web/whatsapp + pending)
--   order_items     | order_items_public_insert  | INSERT
-- (plus menu_items_public view granted to anon, no policy needed on a view)

commit;
