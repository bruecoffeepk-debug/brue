-- ============================================================
-- BRUE · Migration 008 — wire real photos to dessert menu items
-- ============================================================
-- Migration 005 inserted the three Dessert items (Tiramisu Affogato,
-- Tiramisu in a Cup, Brownie) with photo = NULL because we didn't
-- have the photos yet. They've now landed in /public/drinks/, so
-- this patch points each row at its real product photo.
--
-- For each item there are also alternate shots in the public folder
-- (tiramisu-affogato-2.jpg, tiramisu-affogato-3.jpg, tiramisu-cup-2.jpg)
-- that you can swap to via /admin/drinks if you want a different
-- hero — they ship with the repo.
--
-- Idempotent. Wrapped in a transaction. Safe to re-run.
-- ============================================================

begin;

update menu_items
set photo = '/drinks/tiramisu-affogato.jpg', updated_at = now()
where name = 'Tiramisu Affogato' and category = 'Dessert';

update menu_items
set photo = '/drinks/tiramisu-cup.jpg', updated_at = now()
where name = 'Tiramisu in a Cup' and category = 'Dessert';

update menu_items
set photo = '/drinks/brownie.jpg', updated_at = now()
where name = 'Brownie' and category = 'Dessert';

-- Sanity: every active dessert should now have a photo.
select
  name,
  photo,
  active
from menu_items
where category = 'Dessert'
order by sort_order;

commit;
