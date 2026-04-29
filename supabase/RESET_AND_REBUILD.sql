-- ============================================================
-- BRUE · RESET + REBUILD everything
-- ============================================================
-- Paste this whole file into Supabase SQL Editor and click Run.
-- It will:
--   1. Drop every BRUE table + storage policy (auth users are NOT touched)
--   2. Rebuild the full schema (schema.sql + migration 002 + migration 003)
--   3. Seed 9 categories + 50 drinks
--   4. Set up every RLS policy so public reads work + public order intake works
-- Safe to re-run any time. Auth users (the one you made for /login) stay.
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. NUKE                                                 │
-- └─────────────────────────────────────────────────────────┘

drop table if exists order_items cascade;
drop table if exists orders       cascade;
drop table if exists expenses     cascade;
drop table if exists menu_items   cascade;
drop table if exists categories   cascade;
drop table if exists customers    cascade;

-- storage policies (bucket itself can stay; we'll recreate policies)
drop policy if exists "drink_photos_public_read" on storage.objects;
drop policy if exists "drink_photos_staff_write" on storage.objects;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. TABLES                                               │
-- └─────────────────────────────────────────────────────────┘

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  price integer not null,
  cost integer not null default 0,
  photo text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  -- from migration 002
  in_stock boolean not null default true,
  category_id uuid,
  updated_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  discount_percent integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number serial,
  customer_id uuid references customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  order_type text not null default 'pickup',
  delivery_address text,
  payment_method text not null default 'cash',
  subtotal integer not null,
  discount integer not null default 0,
  total integer not null,
  notes text,
  status text not null default 'completed',
  channel text not null default 'pos',
  created_at timestamptz not null default now(),
  -- from migration 003
  delivery_method text,
  delivery_lat double precision,
  delivery_lng double precision,
  delivery_distance_km numeric(5,2),
  accepted_at timestamptz,
  ready_at timestamptz,
  out_for_delivery_at timestamptz,
  completed_at timestamptz
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  price integer not null,
  cost integer not null default 0,
  quantity integer not null,
  line_total integer not null
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  amount integer not null,
  category text not null,
  description text,
  spent_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  emoji text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- link menu_items → categories now that both exist
alter table menu_items
  add constraint menu_items_category_id_fkey
  foreign key (category_id) references categories(id) on delete set null;

-- updated_at trigger
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger menu_items_touch
  before update on menu_items
  for each row execute function touch_updated_at();

-- indexes
create index orders_status_created_idx on orders (status, created_at desc);
create index orders_phone_idx           on orders (customer_phone);
create index customers_phone_idx        on customers (phone);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. RLS                                                  │
-- └─────────────────────────────────────────────────────────┘

alter table menu_items  enable row level security;
alter table customers   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table expenses    enable row level security;
alter table categories  enable row level security;

-- menu_items: staff full; ANON reads through the menu_items_public view
-- below (which excludes the `cost` column so margin doesn't leak).
create policy "menu_staff_all" on menu_items
  for all to authenticated using (true) with check (true);

-- categories: anyone reads active categories; staff full
create policy "categories_public_read" on categories
  for select to anon, authenticated using (active = true);
create policy "categories_staff_all" on categories
  for all to authenticated using (true) with check (true);

-- customers: staff full; anon can insert a new customer (phone upsert from web checkout)
create policy "customers_staff_all" on customers
  for all to authenticated using (true) with check (true);
create policy "customers_public_insert" on customers
  for insert to anon with check (true);

-- orders: staff full; anon can ONLY insert pending web/whatsapp orders.
-- Public SELECT is intentionally NOT granted — that would leak every
-- customer name/phone/address through the public REST endpoint. The
-- receipt page (/r/[id]) reads orders via the SERVICE ROLE Supabase
-- client server-side. See lib/supabase/admin.ts and migration 006.
create policy "orders_staff_all" on orders
  for all to authenticated using (true) with check (true);
create policy "orders_public_insert" on orders
  for insert to anon with check (
    channel in ('web', 'whatsapp') and status = 'pending'
  );

-- order_items: staff full; anon can ONLY insert (no public SELECT — see note above)
create policy "order_items_staff_all" on order_items
  for all to authenticated using (true) with check (true);
create policy "order_items_public_insert" on order_items
  for insert to anon with check (true);

-- expenses: staff only
create policy "expenses_staff_all" on expenses
  for all to authenticated using (true) with check (true);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 3b. PUBLIC MENU VIEW (excludes the `cost` column)       │
-- └─────────────────────────────────────────────────────────┘
-- Public reads use this view so internal margin (`cost`) never reaches
-- the browser bundle. Server-side reads (admin/POS, authenticated
-- session) keep using the menu_items table directly.

-- security_invoker = false → view runs as its owner (full menu_items
-- access), bypassing the anon RLS that hides the underlying table.
-- The view still filters to active = true and never exposes `cost`,
-- so anon gets a safe public projection only.
drop view if exists menu_items_public;
create view menu_items_public
with (security_invoker = false)
as
select
  id, name, category, category_id, description, price, photo,
  active, in_stock, sort_order, created_at, updated_at
from menu_items
where active = true;

grant select on menu_items_public to anon, authenticated;

-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. STORAGE — drink-photos bucket                        │
-- └─────────────────────────────────────────────────────────┘

insert into storage.buckets (id, name, public)
values ('drink-photos', 'drink-photos', true)
on conflict (id) do nothing;

create policy "drink_photos_public_read" on storage.objects
  for select using (bucket_id = 'drink-photos');

create policy "drink_photos_staff_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'drink-photos')
  with check (bucket_id = 'drink-photos');

-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. SEED: categories                                     │
-- └─────────────────────────────────────────────────────────┘

insert into categories (name, slug, emoji, sort_order) values
  ('Coffee',      'coffee',      '☕', 10),
  ('Iced Latte',  'iced-latte',  '🧊', 20),
  ('Hot Latte',   'hot-latte',   '🔥', 30),
  ('Frappé',      'frappe',      '🥤', 40),
  ('Non-Coffee',  'non-coffee',  '🥛', 50),
  ('Iced Tea',    'iced-tea',    '🍵', 60),
  ('Lemonade',    'lemonade',    '🍋', 65),
  ('New Recipe',  'new-recipe',  '✨', 80),
  ('Dessert',     'dessert',     '🍰', 90);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. SEED: 49 drinks                                      │
-- └─────────────────────────────────────────────────────────┘
-- Reuse map: hot/iced lattes that don't have their own photo borrow
-- a visually similar one from the existing 18-photo set. Photos for
-- distinctly-named drinks (strawberry / shake / dessert) are pending —
-- see /public/drinks-generated/_render.html for the illustrated poster
-- pipeline.

insert into menu_items (name, category, description, price, cost, photo, sort_order) values
  -- Coffee
  ('Americano',            'Coffee',     'Double shot espresso with hot water',                 550, 220, '/drinks/americano.jpg',           1),
  ('Cappuccino',           'Coffee',     'Espresso with steamed milk foam',                     600, 240, '/drinks/cappuccino.jpg',          2),
  ('Mocha Cappuccino',     'Coffee',     'Espresso, chocolate, steamed milk',                   650, 260, '/drinks/mocha-cappuccino.jpg',    3),
  ('Iced Americano',       'Coffee',     'Double espresso over cold water and ice',             580, 232, '/drinks/iced-americano.jpg',      6),

  -- Iced Latte
  ('Spanish Latte',        'Iced Latte', 'Condensed milk, espresso, cold cream over ice',       625, 250, '/drinks/spanish-latte.jpg',      10),
  ('French Vanilla',       'Iced Latte', 'Vanilla syrup, espresso, cold milk',                  625, 250, '/drinks/french-vanilla.jpg',     11),
  ('Caramella',            'Iced Latte', 'Caramel syrup, espresso, cold milk',                  650, 260, '/drinks/caramella.jpg',          12),
  ('Creme Brulee',         'Iced Latte', 'Custard-sweet espresso over ice',                     645, 258, '/drinks/creme-brulee.jpg',       13),
  ('Roasted Hazelnut',     'Iced Latte', 'Hazelnut syrup, espresso, cold milk',                 645, 258, '/drinks/roasted-hazelnut.jpg',   14),
  ('Tiramisu Espresso',    'Iced Latte', 'Tiramisu syrup, espresso, cream milk',                660, 264, '/drinks/tiramisu-espresso.jpg',  15),
  ('Strawberry Mocha',     'Iced Latte', 'Strawberry, mocha, espresso, ice',                    660, 264, '/drinks/strawberry-mocha.jpg',   16),
  ('Salted Caramel Latte', 'Iced Latte', 'Salted caramel, espresso, cold milk',                 650, 260, '/drinks/salted-caramel-latte.jpg', 17),
  ('Brown Sugar Latte',    'Iced Latte', 'Brown sugar syrup, espresso, cinnamon milk',          650, 260, '/drinks/brown-sugar-latte.jpg',  18),
  ('Affogato Latte',       'Iced Latte', 'Espresso poured over vanilla ice cream',              720, 288, '/drinks/creme-brulee.jpg',       19),
  ('Mocha Latte',          'Iced Latte', 'Iced mocha, espresso, cold milk',                     660, 264, '/drinks/mocha-latte.jpg',        20),

  -- Hot Latte
  ('Cafe Latte',           'Hot Latte',  'Espresso with steamed milk',                          580, 232, '/drinks/cafe-latte.jpg',         25),
  ('Salted Caramel',       'Hot Latte',  'Salted caramel, espresso, steamed milk',              610, 244, '/drinks/mocha-cappuccino.jpg',   26),
  ('Tiramisu',             'Hot Latte',  'Tiramisu syrup, espresso, steamed milk',              625, 250, '/drinks/mocha-cappuccino.jpg',   27),
  ('Mocha Latte',          'Hot Latte',  'Chocolate, espresso, steamed milk',                   620, 248, '/drinks/mocha-cappuccino.jpg',   28),
  ('Spanish Latte (Hot)',  'Hot Latte',  'Condensed milk with espresso',                        600, 240, '/drinks/spanish-latte-hot.jpg',  29),
  ('French Vanilla (Hot)', 'Hot Latte',  'Vanilla syrup, espresso, steamed milk',               600, 240, '/drinks/french-vanilla-hot.jpg', 30),
  ('Hazelnut Latte (Hot)', 'Hot Latte',  'Hazelnut, espresso, steamed milk',                    620, 248, '/drinks/hazelnut-latte-hot.jpg', 31),
  ('Caramel Latte (Hot)',  'Hot Latte',  'Caramel, espresso, steamed milk',                     610, 244, '/drinks/caramel-latte-hot.jpg',  32),
  ('Creme Brulee (Hot)',   'Hot Latte',  'Custard sweet espresso, steamed milk',                625, 250, '/drinks/creme-brulee-hot.jpg',   33),

  -- Frappé
  ('Mocha Frappe',         'Frappé',     'Blended mocha espresso with whipped cream',           820, 328, '/drinks/mocha-frappe.jpg',       40),
  ('Caramel Frappe',       'Frappé',     'Blended caramel espresso with whipped cream',         820, 328, '/drinks/caramel-frappe.jpg',     41),
  ('Vanilla-Bean Frappe',  'Frappé',     'Vanilla bean blended with cold milk',                 800, 320, '/drinks/vanilla-bean-frappe.jpg',42),
  ('Hazelnut Frappe',      'Frappé',     'Hazelnut blended espresso frappe',                    830, 332, '/drinks/hazelnut-frappe.jpg',    43),
  ('Strawberry Frappe',    'Frappé',     'Strawberry blended with cream',                       800, 320, '/drinks/strawberry-frappe.jpg',  44),
  ('Oreo Frappe',          'Frappé',     'Oreo cookie blended with cream',                      850, 340, '/drinks/oreo-frappe.jpg',        45),
  ('Strawberry Mocha',     'Frappé',     'Strawberry mocha blended with whipped cream',         850, 340, '/drinks/strawberry-frappe.jpg',  46),

  -- Non-Coffee
  ('Iced Chocolate',       'Non-Coffee', 'Premium chocolate over cold milk and ice',            620, 248, '/drinks/iced-chocolate.jpg',     50),
  ('Hot Chocolate',        'Non-Coffee', 'Rich premium chocolate steamed milk',                 620, 248, '/drinks/hot-chocolate.jpg',      51),
  ('Berry Lemonade',       'Non-Coffee', 'Mixed berry and fresh lemon over ice',                550, 220, '/drinks/berry-lemonade.jpg',     52),
  ('Mint Lemonade',        'Non-Coffee', 'Fresh mint and lemon with ice',                       540, 216, '/drinks/mint-lemonade.jpg',      53),
  ('Strawberry Shake',     'Non-Coffee', 'Strawberry blended with vanilla ice cream',           700, 280, '/drinks/strawberry-shake.jpg',   55),
  ('Chocolate Shake',      'Non-Coffee', 'Chocolate blended with vanilla ice cream',            700, 280, '/drinks/chocolate-shake.jpg',    56),

  -- Iced Tea
  ('Peach Iced Tea',       'Iced Tea',   'Monin peach, black tea, cream cold foam',             580, 232, '/drinks/peach-iced-tea.jpg',     60),
  ('Raspberry Iced Tea',   'Iced Tea',   'Monin raspberry, black tea, ice',                     570, 228, '/drinks/raspberry-iced-tea.jpg', 61),

  -- New Recipe
  ('Espresso Tonic',       'New Recipe', 'Espresso tonic bomb over ice',                        720, 288, '/drinks/espresso-tonic.jpg',     70),
  ('Mont de Creme',        'New Recipe', 'Layered cream + espresso over ice',                   720, 288, '/drinks/mont-de-creme.jpg',      71),
  ('Salted Mocha',         'New Recipe', 'Salted chocolate, espresso, cold milk',               700, 280, '/drinks/mocha-cappuccino.jpg',   72),
  ('Ice Sweetful',         'New Recipe', 'House sweet iced specialty',                          680, 272, null,                             73),
  ('Strawberry Mocha',     'New Recipe', 'Strawberry mocha specialty over ice',                 720, 288, '/drinks/strawberry-mocha.jpg',   74),

  -- Dessert
  ('Tiramisu Affogato',    'Dessert',    'Tiramisu with hot espresso poured over',              650, 260, '/drinks/tiramisu-affogato.jpg',  80),
  ('Tiramisu in a Cup',    'Dessert',    'Classic tiramisu served in a cup',                    550, 220, '/drinks/tiramisu-cup.jpg',       81),
  ('Brownie',              'Dessert',    'Warm chocolate brownie',                              450, 180, '/drinks/brownie.jpg',            82);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 7. BACKFILL category_id on menu_items                   │
-- └─────────────────────────────────────────────────────────┘

update menu_items mi
  set category_id = c.id
  from categories c
  where lower(trim(mi.category)) = lower(trim(c.name));

-- ┌─────────────────────────────────────────────────────────┐
-- │ 8. Sanity counts                                        │
-- └─────────────────────────────────────────────────────────┘

select
  (select count(*) from categories)  as categories_count,
  (select count(*) from menu_items)  as drinks_count,
  (select count(*) from menu_items where category_id is null) as drinks_missing_category,
  (select count(*) from menu_items where active = true)       as drinks_active;
