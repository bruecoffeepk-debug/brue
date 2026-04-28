-- ============================================================
-- BRUE · Migration 005 — dedupe + canonical menu (Apr 2026)
-- ============================================================
-- Run this ONCE to fix:
--   • duplicate rows (created if migration 004 ran more than once)
--   • items the website still shows that aren't on the BRUE menu
--   • stale or missing photo paths
--
-- Idempotent. Safe to run any number of times. Wrapped in a transaction.
--
-- Strategy:
--   1. Soft-delete everything (active = false).
--   2. For each canonical (name, category) pair:
--        a. UPSERT — update the oldest matching row, deactivate the rest.
--        b. If no row exists, INSERT a fresh one.
--   3. The result: exactly ONE active row per canonical menu item with
--      the correct price, photo, and category_id.
--
-- Order history is preserved: order_items.menu_item_id has
-- ON DELETE SET NULL, and we never DELETE — only deactivate.
-- ============================================================

begin;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. Categories — make sure Dessert exists                │
-- └─────────────────────────────────────────────────────────┘

update categories
set name = 'Dessert', slug = 'dessert', emoji = '🍰', sort_order = 90
where slug = 'sweets';

insert into categories (name, slug, emoji, sort_order)
values ('Dessert', 'dessert', '🍰', 90)
on conflict (slug) do nothing;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. Deactivate every menu_item                           │
-- │    — we'll re-activate the canonical ones below.        │
-- └─────────────────────────────────────────────────────────┘

update menu_items set active = false, updated_at = now() where active = true;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. Helper: upsert one canonical item                    │
-- │    (procedural via DO block since we can't use a func)  │
-- └─────────────────────────────────────────────────────────┘

-- We use a temp table to drive the upsert in a single pass.
create temp table _canonical (
  name          text not null,
  category      text not null,
  description   text,
  price         integer not null,
  cost          integer not null,
  photo         text,
  sort_order    integer not null
) on commit drop;

insert into _canonical (name, category, description, price, cost, photo, sort_order) values
  -- ─── Coffee ──────────────────────────────────────────
  ('Americano',            'Coffee',     'Double shot espresso with hot water',                  550, 220, '/drinks/americano.jpg',            1),
  ('Cappuccino',           'Coffee',     'Espresso with steamed milk foam',                      600, 240, '/drinks/cappuccino.jpg',           2),
  ('Mocha Cappuccino',     'Coffee',     'Espresso, chocolate, steamed milk',                    650, 260, '/drinks/mocha-cappuccino.jpg',     3),
  ('Iced Americano',       'Coffee',     'Double espresso over cold water and ice',              580, 232, '/drinks/iced-americano.jpg',       6),

  -- ─── Iced Latte ──────────────────────────────────────
  ('Spanish Latte',        'Iced Latte', 'Condensed milk, espresso, cold cream over ice',        625, 250, '/drinks/spanish-latte.jpg',       10),
  ('French Vanilla',       'Iced Latte', 'Vanilla syrup, espresso, cold milk',                   625, 250, '/drinks/french-vanilla.jpg',      11),
  ('Caramella',            'Iced Latte', 'Caramel syrup, espresso, cold milk',                   650, 260, '/drinks/caramella.jpg',           12),
  ('Creme Brulee',         'Iced Latte', 'Custard-sweet espresso over ice',                      645, 258, '/drinks/creme-brulee.jpg',        13),
  ('Roasted Hazelnut',     'Iced Latte', 'Hazelnut syrup, espresso, cold milk',                  645, 258, '/drinks/roasted-hazelnut.jpg',    14),
  ('Tiramisu Espresso',    'Iced Latte', 'Tiramisu syrup, espresso, cream milk',                 660, 264, '/drinks/tiramisu-espresso.jpg',   15),
  ('Strawberry Mocha',     'Iced Latte', 'Strawberry, mocha, espresso, ice',                     660, 264, '/drinks/strawberry-mocha.jpg',    16),
  ('Salted Caramel Latte', 'Iced Latte', 'Salted caramel, espresso, cold milk',                  650, 260, '/drinks/salted-caramel-latte.jpg',17),
  ('Brown Sugar Latte',    'Iced Latte', 'Brown sugar syrup, espresso, cinnamon milk',           650, 260, '/drinks/brown-sugar-latte.jpg',   18),
  ('Affogato Latte',       'Iced Latte', 'Espresso poured over vanilla ice cream',               720, 288, '/drinks/creme-brulee.jpg',        19),
  ('Mocha Latte',          'Iced Latte', 'Iced mocha, espresso, cold milk',                      660, 264, '/drinks/mocha-latte.jpg',         20),

  -- ─── Hot Latte ───────────────────────────────────────
  ('Cafe Latte',           'Hot Latte',  'Espresso with steamed milk',                           580, 232, '/drinks/cafe-latte.jpg',          25),
  ('Salted Caramel',       'Hot Latte',  'Salted caramel, espresso, steamed milk',               610, 244, '/drinks/mocha-cappuccino.jpg',    26),
  ('Tiramisu',             'Hot Latte',  'Tiramisu syrup, espresso, steamed milk',               625, 250, '/drinks/mocha-cappuccino.jpg',    27),
  ('Mocha Latte',          'Hot Latte',  'Chocolate, espresso, steamed milk',                    620, 248, '/drinks/mocha-cappuccino.jpg',    28),
  ('Spanish Latte (Hot)',  'Hot Latte',  'Condensed milk with espresso',                         600, 240, '/drinks/spanish-latte-hot.jpg',   29),
  ('French Vanilla (Hot)', 'Hot Latte',  'Vanilla syrup, espresso, steamed milk',                600, 240, '/drinks/french-vanilla-hot.jpg',  30),
  ('Hazelnut Latte (Hot)', 'Hot Latte',  'Hazelnut, espresso, steamed milk',                     620, 248, '/drinks/hazelnut-latte-hot.jpg',  31),
  ('Caramel Latte (Hot)',  'Hot Latte',  'Caramel, espresso, steamed milk',                      610, 244, '/drinks/caramel-latte-hot.jpg',   32),
  ('Creme Brulee (Hot)',   'Hot Latte',  'Custard sweet espresso, steamed milk',                 625, 250, '/drinks/creme-brulee-hot.jpg',    33),

  -- ─── Frappé ──────────────────────────────────────────
  ('Mocha Frappe',         'Frappé',     'Blended mocha espresso with whipped cream',            820, 328, '/drinks/mocha-frappe.jpg',        40),
  ('Caramel Frappe',       'Frappé',     'Blended caramel espresso with whipped cream',          820, 328, '/drinks/caramel-frappe.jpg',      41),
  ('Vanilla-Bean Frappe',  'Frappé',     'Vanilla bean blended with cold milk',                  800, 320, '/drinks/vanilla-bean-frappe.jpg', 42),
  ('Hazelnut Frappe',      'Frappé',     'Hazelnut blended espresso frappe',                     830, 332, '/drinks/hazelnut-frappe.jpg',     43),
  ('Strawberry Frappe',    'Frappé',     'Strawberry blended with cream',                        800, 320, '/drinks/strawberry-frappe.jpg',   44),
  ('Oreo Frappe',          'Frappé',     'Oreo cookie blended with cream',                       850, 340, '/drinks/oreo-frappe.jpg',         45),
  ('Strawberry Mocha',     'Frappé',     'Strawberry mocha blended with whipped cream',          850, 340, '/drinks/strawberry-frappe.jpg',   46),

  -- ─── Non-Coffee ──────────────────────────────────────
  ('Iced Chocolate',       'Non-Coffee', 'Premium chocolate over cold milk and ice',             620, 248, '/drinks/iced-chocolate.jpg',      50),
  ('Hot Chocolate',        'Non-Coffee', 'Rich premium chocolate steamed milk',                  620, 248, '/drinks/hot-chocolate.jpg',       51),
  ('Berry Lemonade',       'Non-Coffee', 'Mixed berry and fresh lemon over ice',                 550, 220, '/drinks/berry-lemonade.jpg',      52),
  ('Mint Lemonade',        'Non-Coffee', 'Fresh mint and lemon with ice',                        540, 216, '/drinks/mint-lemonade.jpg',       53),
  ('Strawberry Shake',     'Non-Coffee', 'Strawberry blended with vanilla ice cream',            700, 280, '/drinks/strawberry-shake.jpg',    55),
  ('Chocolate Shake',      'Non-Coffee', 'Chocolate blended with vanilla ice cream',             700, 280, '/drinks/chocolate-shake.jpg',     56),

  -- ─── Iced Tea ────────────────────────────────────────
  ('Peach Iced Tea',       'Iced Tea',   'Monin peach, black tea, cream cold foam',              580, 232, '/drinks/peach-iced-tea.jpg',      60),
  ('Raspberry Iced Tea',   'Iced Tea',   'Monin raspberry, black tea, ice',                      570, 228, '/drinks/raspberry-iced-tea.jpg',  61),

  -- ─── New Recipe ──────────────────────────────────────
  ('Espresso Tonic',       'New Recipe', 'Espresso tonic bomb over ice',                         720, 288, '/drinks/espresso-tonic.jpg',      70),
  ('Mont de Creme',        'New Recipe', 'Layered cream + espresso over ice',                    720, 288, '/drinks/mont-de-creme.jpg',       71),
  ('Salted Mocha',         'New Recipe', 'Salted chocolate, espresso, cold milk',                700, 280, '/drinks/mocha-cappuccino.jpg',    72),
  ('Ice Sweetful',         'New Recipe', 'House sweet iced specialty',                           680, 272, null,                              73),
  ('Strawberry Mocha',     'New Recipe', 'Strawberry mocha specialty over ice',                  720, 288, '/drinks/strawberry-mocha.jpg',    74),

  -- ─── Dessert ─────────────────────────────────────────
  ('Tiramisu Affogato',    'Dessert',    'Tiramisu with hot espresso poured over',               650, 260, null,                              80),
  ('Tiramisu in a Cup',    'Dessert',    'Classic tiramisu served in a cup',                     550, 220, null,                              81),
  ('Brownie',              'Dessert',    'Warm chocolate brownie',                               450, 180, null,                              82);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. Dedupe + activate the canonical row for each item    │
-- │    (oldest matching row wins; the rest stay deactivated)│
-- └─────────────────────────────────────────────────────────┘

-- For each (name, category) in canonical, keep the oldest matching row
-- and update it to canonical values. Mark it active.
with ranked as (
  select
    mi.id,
    mi.name,
    mi.category,
    row_number() over (
      partition by mi.name, mi.category
      order by mi.created_at asc, mi.id asc
    ) as rn
  from menu_items mi
  join _canonical c on c.name = mi.name and c.category = mi.category
)
update menu_items mi
set
  description = c.description,
  price       = c.price,
  cost        = c.cost,
  photo       = c.photo,
  sort_order  = c.sort_order,
  active      = true,
  updated_at  = now()
from _canonical c, ranked r
where r.id = mi.id
  and r.rn = 1
  and c.name = mi.name
  and c.category = mi.category;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. Insert any canonical items that don't exist at all   │
-- └─────────────────────────────────────────────────────────┘

insert into menu_items (name, category, description, price, cost, photo, sort_order, active)
select c.name, c.category, c.description, c.price, c.cost, c.photo, c.sort_order, true
from _canonical c
where not exists (
  select 1 from menu_items mi
  where mi.name = c.name and mi.category = c.category
);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. Backfill category_id on every active row             │
-- └─────────────────────────────────────────────────────────┘

update menu_items mi
set category_id = c.id
from categories c
where lower(trim(mi.category)) = lower(trim(c.name));

-- ┌─────────────────────────────────────────────────────────┐
-- │ 7. Sanity check                                         │
-- └─────────────────────────────────────────────────────────┘

select
  (select count(*) from menu_items where active = true)                              as active_drinks,
  (select count(*) from menu_items where active = false)                             as retired_drinks,
  (select count(*) from menu_items where active = true and photo is null)            as active_no_photo,
  (select count(*) from menu_items where active = true and category_id is null)      as active_no_category,
  (select count(distinct (name, category)) from menu_items where active = true)      as distinct_active,
  (select count(*) from categories)                                                  as total_categories;

-- Expected: active_drinks = 47, distinct_active = 47 (no duplicates),
-- active_no_photo = 4 (Ice Sweetful + 3 Desserts), active_no_category = 0.

commit;
