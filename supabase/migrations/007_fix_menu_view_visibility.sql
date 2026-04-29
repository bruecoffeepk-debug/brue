-- ============================================================
-- BRUE · Migration 007 — fix menu view visibility (HOTFIX)
-- ============================================================
-- After migration 006 dropped the `menu_public_read` policy, the
-- menu_items_public view returned 0 rows to anon. Reason:
--
-- Postgres 15+ defaults views to `security_invoker = true`. That
-- means when anon SELECTs from the view, the view internally runs
-- as anon — and anon no longer has SELECT on the underlying
-- menu_items table (by design, to hide the `cost` column). So
-- the view returns nothing.
--
-- Fix: recreate the view with `security_invoker = false`. The
-- view will run with the privileges of its OWNER (the migration
-- runner, which has full table access). The view itself still
-- filters to `active = true` and never exposes the `cost` column,
-- so the security guarantee — "anon can read menu names + prices
-- but never internal cost" — holds.
--
-- This is the standard Postgres pattern for a "public-facing
-- projection" of a sensitive table.
-- ============================================================

begin;

-- Recreate the view with security_invoker = false so it bypasses
-- the underlying table's RLS for the columns it exposes.
drop view if exists menu_items_public;

create view menu_items_public
with (security_invoker = false)
as
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

-- Grant SELECT on the view to both roles
grant select on menu_items_public to anon, authenticated;

-- Sanity check — should return the count of active drinks
select count(*) as visible_drinks from menu_items_public;

commit;
