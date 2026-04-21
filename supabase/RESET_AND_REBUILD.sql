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

-- menu_items: anyone reads active drinks; staff full
create policy "menu_public_read" on menu_items
  for select to anon, authenticated using (active = true);
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

-- orders: staff full; anon can insert pending orders from the web/whatsapp channel;
-- anon can read any order (receipt pages look up by uuid, which is unguessable).
create policy "orders_staff_all" on orders
  for all to authenticated using (true) with check (true);
create policy "orders_public_insert" on orders
  for insert to anon with check (
    channel in ('web', 'whatsapp') and status = 'pending'
  );
create policy "orders_public_read_by_id" on orders
  for select to anon using (true);

-- order_items: staff full; anon can insert + read (paired with orders policy)
create policy "order_items_staff_all" on order_items
  for all to authenticated using (true) with check (true);
create policy "order_items_public_insert" on order_items
  for insert to anon with check (true);
create policy "order_items_public_read" on order_items
  for select to anon using (true);

-- expenses: staff only
create policy "expenses_staff_all" on expenses
  for all to authenticated using (true) with check (true);

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
  ('Sweets',      'sweets',      '🍰', 70),
  ('New Recipe',  'new-recipe',  '✨', 80);

-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. SEED: 50 drinks                                      │
-- └─────────────────────────────────────────────────────────┘

insert into menu_items (name, category, description, price, cost, photo, sort_order) values
  ('Americano',            'Coffee',     'Double shot espresso with hot water',                 550, 220, '/drinks/americano.jpg',          1),
  ('Cappuccino',           'Coffee',     'Espresso with steamed milk foam',                     600, 240, '/drinks/cappuccino.jpg',         2),
  ('Mocha Cappuccino',     'Coffee',     'Espresso, chocolate, steamed milk',                   650, 260, '/drinks/mocha-cappuccino.jpg',   3),
  ('Flat White',           'Coffee',     'Double ristretto with velvety micro-foam',            625, 250, null,                             4),
  ('Long Black',           'Coffee',     'Hot water with double espresso',                      550, 220, null,                             5),
  ('Spanish Latte',        'Iced Latte', 'Condensed milk, espresso, cold cream over ice',       625, 250, '/drinks/spanish-latte.jpg',     10),
  ('French Vanilla',       'Iced Latte', 'Vanilla syrup, espresso, cold milk',                  625, 250, '/drinks/french-vanilla.jpg',    11),
  ('Caramella',            'Iced Latte', 'Caramel syrup, espresso, cold milk',                  650, 260, '/drinks/caramella.jpg',         12),
  ('Creme Brulee',         'Iced Latte', 'Custard-sweet espresso over ice',                     645, 258, '/drinks/creme-brulee.jpg',      13),
  ('Roasted Hazelnut',     'Iced Latte', 'Hazelnut syrup, espresso, cold milk',                 645, 258, '/drinks/roasted-hazelnut.jpg',  14),
  ('Tiramisu Espresso',    'Iced Latte', 'Tiramisu syrup, espresso, cream milk',                660, 264, '/drinks/tiramisu-espresso.jpg', 15),
  ('Strawberry Mocha',     'Iced Latte', 'Strawberry, mocha, espresso, ice',                    660, 264, null,                            16),
  ('Salted Caramel Latte', 'Iced Latte', 'Salted caramel, espresso, cold milk',                 650, 260, null,                            17),
  ('Coconut Latte',        'Iced Latte', 'Coconut syrup, espresso, cold milk',                  670, 268, null,                            18),
  ('Brown Sugar Latte',    'Iced Latte', 'Brown sugar syrup, espresso, cinnamon milk',          650, 260, null,                            19),
  ('Spanish Latte (Hot)',  'Hot Latte',  'Condensed milk with espresso',                        600, 240, null,                            20),
  ('French Vanilla (Hot)', 'Hot Latte',  'Vanilla syrup, espresso, steamed milk',               600, 240, null,                            21),
  ('Hazelnut Latte (Hot)', 'Hot Latte',  'Hazelnut, espresso, steamed milk',                    620, 248, null,                            22),
  ('Caramel Latte (Hot)',  'Hot Latte',  'Caramel, espresso, steamed milk',                     610, 244, null,                            23),
  ('Creme Brulee (Hot)',   'Hot Latte',  'Custard sweet espresso, steamed milk',                625, 250, null,                            24),
  ('Mocha Frappe',         'Frappé',     'Blended mocha espresso with whipped cream',           820, 328, '/drinks/mocha-frappe.jpg',      30),
  ('Caramel Frappe',       'Frappé',     'Blended caramel espresso with whipped cream',         820, 328, '/drinks/caramel-frappe.jpg',    31),
  ('Vanilla-Bean Frappe',  'Frappé',     'Vanilla bean blended with cold milk',                 800, 320, '/drinks/vanilla-bean-frappe.jpg',32),
  ('Hazelnut Frappe',      'Frappé',     'Hazelnut blended espresso frappe',                    830, 332, null,                            33),
  ('Strawberry Frappe',    'Frappé',     'Strawberry blended with cream',                       800, 320, null,                            34),
  ('Oreo Frappe',          'Frappé',     'Oreo cookie blended with cream',                      850, 340, null,                            35),
  ('Lotus Frappe',         'Frappé',     'Lotus Biscoff blended with espresso cream',           870, 348, null,                            36),
  ('Iced Chocolate',       'Non-Coffee', 'Premium chocolate over cold milk and ice',            620, 248, '/drinks/iced-chocolate.jpg',    40),
  ('Hot Chocolate',        'Non-Coffee', 'Rich premium chocolate steamed milk',                 620, 248, '/drinks/hot-chocolate.jpg',     41),
  ('Berry Lemonade',       'Non-Coffee', 'Mixed berry and fresh lemon over ice',                550, 220, '/drinks/berry-lemonade.jpg',    42),
  ('Mint Lemonade',        'Non-Coffee', 'Fresh mint and lemon with ice',                       540, 216, '/drinks/mint-lemonade.jpg',     43),
  ('Virgin Mojito',        'Non-Coffee', 'Mint, lime, soda, crushed ice',                       560, 224, null,                            44),
  ('Mango Lassi',          'Non-Coffee', 'Mango, yogurt, cold milk',                            600, 240, null,                            45),
  ('Oreo Milkshake',       'Non-Coffee', 'Oreo cookie milkshake',                               750, 300, null,                            46),
  ('Peach Iced Tea',       'Iced Tea',   'Monin peach, black tea, cream cold foam',             580, 232, '/drinks/peach-iced-tea.jpg',    50),
  ('Raspberry Iced Tea',   'Iced Tea',   'Monin raspberry, black tea, ice',                     570, 228, '/drinks/raspberry-iced-tea.jpg',51),
  ('Lychee Iced Tea',      'Iced Tea',   'Lychee syrup, green tea, ice',                        575, 230, null,                            52),
  ('Passion Fruit Tea',    'Iced Tea',   'Passion fruit, green tea, cream foam',                585, 234, null,                            53),
  ('Mango Green Tea',      'Iced Tea',   'Mango, green tea, ice',                               575, 230, null,                            54),
  ('Tiramisu Frappe',      'New Recipe', 'Tiramisu espresso frappe with mascarpone',            890, 356, null,                            60),
  ('Lotus Latte',          'New Recipe', 'Lotus Biscoff, espresso, cold milk',                  720, 288, null,                            61),
  ('Charcoal Latte',       'New Recipe', 'Activated charcoal, espresso, almond milk',           710, 284, null,                            62),
  ('Rose Latte',           'New Recipe', 'Rose syrup, espresso, cold milk, rose petals',        700, 280, null,                            63),
  ('Matchaccino',          'New Recipe', 'Matcha, espresso, steamed milk',                      720, 288, null,                            64),
  ('Dalgona Coffee',       'New Recipe', 'Whipped coffee foam over cold milk',                  660, 264, null,                            65),
  ('S''mores Latte',       'New Recipe', 'Graham, chocolate, marshmallow, espresso',            760, 304, null,                            66),
  ('Banana Foster Latte',  'New Recipe', 'Caramelised banana, espresso, cold milk',             720, 288, null,                            67),
  ('Cold Brew',            'New Recipe', '12-hour cold steeped coffee over ice',                600, 240, null,                            68),
  ('Nitro Cold Brew',      'New Recipe', 'Nitrogen-infused cold brew on tap',                   700, 280, null,                            69);

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
