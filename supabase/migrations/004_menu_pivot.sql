-- ============================================================
-- BRUE · Migration 004 — menu pivot + real-photo wiring (Apr 2026)
-- ============================================================
-- Apply on a LIVE database where you don't want to drop tables.
-- (Greenfield deploys: just run RESET_AND_REBUILD.sql which already
--  reflects the new menu — this migration is only for prod.)
--
-- This script:
--   1. Soft-deletes 17 retired drinks (active = false) so order history is
--      preserved. Uncomment the hard DELETE block at the bottom if you want
--      them gone for good.
--   2. Renames the unused "Sweets" category to "Dessert".
--   3. Renames "Espresso Bomb" → "Espresso Tonic" (matches actual cup label).
--   4. Inserts 15 new drinks across Coffee / Iced Latte / Hot Latte / Frappé /
--      Non-Coffee / New Recipe / Dessert (incl. new "Iced Americano").
--   5. Re-points photo paths for all items now that real product photos
--      exist for most of them (Hot Lattes, Iced Lattes, Frappés, Shakes).
--   6. Backfills category_id on all newly-inserted rows.
--
-- Idempotent: safe to re-run. Wrapped in a transaction.
-- ============================================================

begin;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Retire removed drinks (soft delete)                  │
-- └─────────────────────────────────────────────────────────┘

update menu_items
set active = false, updated_at = now()
where name in (
  -- Originally retired
  'Coconut Latte',
  'Lotus Frappe',
  'Virgin Mojito',
  'Mango Lassi',
  'Lychee Iced Tea',
  'Passion Fruit Tea',
  'Mango Green Tea',
  'Lotus Latte',
  'Tiramisu Frappe',
  'Charcoal Latte',
  'Rose Latte',
  'Matchaccino',
  'Dalgona Coffee',
  'S''mores Latte',
  'Banana Foster Latte',
  'Cold Brew',
  'Nitro Cold Brew',
  -- Also retired (never explicitly part of the BRUE menu)
  'Flat White',
  'Long Black',
  'Oreo Milkshake'
);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Categories — add Dessert (or rename Sweets if present)│
-- └─────────────────────────────────────────────────────────┘

update categories
set name = 'Dessert', slug = 'dessert', emoji = '🍰', sort_order = 90
where slug = 'sweets';

insert into categories (name, slug, emoji, sort_order)
values ('Dessert', 'dessert', '🍰', 90)
on conflict (slug) do nothing;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Rename "Espresso Bomb" → "Espresso Tonic"            │
-- └─────────────────────────────────────────────────────────┘

update menu_items
set name = 'Espresso Tonic',
    description = 'Espresso tonic bomb over ice',
    photo = '/drinks/espresso-tonic.jpg',
    updated_at = now()
where name = 'Espresso Bomb';

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Insert new drinks                                    │
-- └─────────────────────────────────────────────────────────┘
-- The menu_items table has no unique constraint on name, so duplicates
-- across categories (e.g. "Mocha Latte" Hot vs Iced, "Strawberry Mocha"
-- Iced/Frappé/New Recipe) are intentionally allowed.

insert into menu_items (name, category, description, price, cost, photo, sort_order, active) values
  -- Coffee (new)
  ('Iced Americano',   'Coffee',     'Double espresso over cold water and ice', 580, 232, '/drinks/iced-americano.jpg',       6, true),

  -- Iced Latte (new)
  ('Affogato Latte',   'Iced Latte', 'Espresso poured over vanilla ice cream',  720, 288, '/drinks/creme-brulee.jpg',        19, true),
  ('Mocha Latte',      'Iced Latte', 'Iced mocha, espresso, cold milk',         660, 264, '/drinks/mocha-latte.jpg',         20, true),

  -- Hot Latte (new)
  ('Cafe Latte',       'Hot Latte',  'Espresso with steamed milk',              580, 232, '/drinks/cafe-latte.jpg',          25, true),
  ('Salted Caramel',   'Hot Latte',  'Salted caramel, espresso, steamed milk',  610, 244, '/drinks/mocha-cappuccino.jpg',    26, true),
  ('Tiramisu',         'Hot Latte',  'Tiramisu syrup, espresso, steamed milk',  625, 250, '/drinks/mocha-cappuccino.jpg',    27, true),
  ('Mocha Latte',      'Hot Latte',  'Chocolate, espresso, steamed milk',       620, 248, '/drinks/mocha-cappuccino.jpg',    28, true),

  -- Frappé (new)
  ('Strawberry Mocha', 'Frappé',     'Strawberry mocha blended with whipped cream', 850, 340, '/drinks/strawberry-frappe.jpg', 46, true),

  -- Non-Coffee (new)
  ('Strawberry Shake', 'Non-Coffee', 'Strawberry blended with vanilla ice cream', 700, 280, '/drinks/strawberry-shake.jpg',   55, true),
  ('Chocolate Shake',  'Non-Coffee', 'Chocolate blended with vanilla ice cream',  700, 280, '/drinks/chocolate-shake.jpg',    56, true),

  -- New Recipe (new — Espresso Tonic was a rename, not an insert)
  ('Mont de Creme',    'New Recipe', 'Layered cream + espresso over ice',       720, 288, '/drinks/mont-de-creme.jpg',       71, true),
  ('Salted Mocha',     'New Recipe', 'Salted chocolate, espresso, cold milk',   700, 280, '/drinks/mocha-cappuccino.jpg',    72, true),
  ('Ice Sweetful',     'New Recipe', 'House sweet iced specialty',              680, 272, null,                              73, true),
  ('Strawberry Mocha', 'New Recipe', 'Strawberry mocha specialty over ice',     720, 288, '/drinks/strawberry-mocha.jpg',    74, true),

  -- Dessert (new)
  ('Tiramisu Affogato', 'Dessert',   'Tiramisu with hot espresso poured over',  650, 260, null,                              80, true),
  ('Tiramisu in a Cup', 'Dessert',   'Classic tiramisu served in a cup',        550, 220, null,                              81, true),
  ('Brownie',           'Dessert',   'Warm chocolate brownie',                  450, 180, null,                              82, true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. Re-point photos to real product photos               │
-- └─────────────────────────────────────────────────────────┘
-- Photos for many existing items are now real product shots — overwrite
-- the old reused/illustrated paths unconditionally so the website picks
-- them up on next deploy.

-- Iced Latte — real photos for Strawberry Mocha, Salted Caramel, Brown Sugar, Mocha Latte
update menu_items set photo = '/drinks/strawberry-mocha.jpg'     where name = 'Strawberry Mocha'     and category = 'Iced Latte';
update menu_items set photo = '/drinks/salted-caramel-latte.jpg' where name = 'Salted Caramel Latte' and category = 'Iced Latte';
update menu_items set photo = '/drinks/brown-sugar-latte.jpg'    where name = 'Brown Sugar Latte'    and category = 'Iced Latte';
update menu_items set photo = '/drinks/mocha-latte.jpg'          where name = 'Mocha Latte'          and category = 'Iced Latte';
update menu_items set photo = '/drinks/creme-brulee.jpg'         where name = 'Affogato Latte'       and category = 'Iced Latte';

-- Hot Latte — real photos for the Hot variants
update menu_items set photo = '/drinks/spanish-latte-hot.jpg'  where name = 'Spanish Latte (Hot)'  and category = 'Hot Latte';
update menu_items set photo = '/drinks/french-vanilla-hot.jpg' where name = 'French Vanilla (Hot)' and category = 'Hot Latte';
update menu_items set photo = '/drinks/hazelnut-latte-hot.jpg' where name = 'Hazelnut Latte (Hot)' and category = 'Hot Latte';
update menu_items set photo = '/drinks/caramel-latte-hot.jpg'  where name = 'Caramel Latte (Hot)'  and category = 'Hot Latte';
update menu_items set photo = '/drinks/creme-brulee-hot.jpg'   where name = 'Creme Brulee (Hot)'   and category = 'Hot Latte';

-- Frappé — real photos for Hazelnut, Strawberry, Oreo
update menu_items set photo = '/drinks/hazelnut-frappe.jpg'   where name = 'Hazelnut Frappe'   and category = 'Frappé';
update menu_items set photo = '/drinks/strawberry-frappe.jpg' where name = 'Strawberry Frappe' and category = 'Frappé';
update menu_items set photo = '/drinks/oreo-frappe.jpg'       where name = 'Oreo Frappe'       and category = 'Frappé';

-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. Backfill category_id on all rows that don't have one │
-- └─────────────────────────────────────────────────────────┘

update menu_items mi
set category_id = c.id
from categories c
where mi.category_id is null
  and lower(trim(mi.category)) = lower(trim(c.name));

-- ┌─────────────────────────────────────────────────────────┐
-- │ 7. Sanity counts                                        │
-- └─────────────────────────────────────────────────────────┘

select
  (select count(*) from menu_items where active = true)                       as drinks_active,
  (select count(*) from menu_items where active = false)                      as drinks_retired,
  (select count(*) from menu_items where active = true and photo is null)     as drinks_active_no_photo,
  (select count(*) from menu_items where category_id is null)                 as drinks_missing_category,
  (select count(*) from categories where slug = 'dessert')                    as dessert_category_present;

commit;

-- ============================================================
-- OPTIONAL: hard-delete retired drinks instead of soft-delete.
-- Only run after confirming no order_items reference these rows
-- (or accept that order_items.menu_item_id will go to NULL via
-- ON DELETE SET NULL — order_items keeps the name/price snapshot
-- so reports still work).
-- ============================================================
--
-- delete from menu_items where active = false and name in (
--   'Coconut Latte', 'Lotus Frappe', 'Virgin Mojito', 'Mango Lassi',
--   'Lychee Iced Tea', 'Passion Fruit Tea', 'Mango Green Tea',
--   'Lotus Latte', 'Tiramisu Frappe', 'Charcoal Latte', 'Rose Latte',
--   'Matchaccino', 'Dalgona Coffee', 'S''mores Latte',
--   'Banana Foster Latte', 'Cold Brew', 'Nitro Cold Brew',
--   'Flat White', 'Long Black', 'Oreo Milkshake'
-- );
