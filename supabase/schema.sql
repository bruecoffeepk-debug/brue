-- BRUE Coffee - Full Schema with seed data
-- Run in Supabase SQL editor

-- =============================================
-- TABLES
-- =============================================

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  price integer not null,
  cost integer not null default 0,
  photo text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  discount_percent integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
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
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  price integer not null,
  cost integer not null default 0,
  quantity integer not null,
  line_total integer not null
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  amount integer not null,
  category text not null,
  description text,
  spent_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- =============================================
-- RLS POLICIES
-- Public can read menu_items. Authenticated staff have full access.
-- =============================================

alter table menu_items enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table expenses enable row level security;

drop policy if exists "menu_public_read" on menu_items;
create policy "menu_public_read" on menu_items
  for select using (active = true);

drop policy if exists "menu_staff_all" on menu_items;
create policy "menu_staff_all" on menu_items
  for all to authenticated using (true) with check (true);

drop policy if exists "customers_staff_all" on customers;
create policy "customers_staff_all" on customers
  for all to authenticated using (true) with check (true);

drop policy if exists "orders_staff_all" on orders;
create policy "orders_staff_all" on orders
  for all to authenticated using (true) with check (true);

-- Anyone can insert orders (for WhatsApp checkout flow)
drop policy if exists "orders_public_insert" on orders;
create policy "orders_public_insert" on orders
  for insert to anon with check (channel = 'whatsapp');

drop policy if exists "order_items_staff_all" on order_items;
create policy "order_items_staff_all" on order_items
  for all to authenticated using (true) with check (true);

drop policy if exists "order_items_public_insert" on order_items;
create policy "order_items_public_insert" on order_items
  for insert to anon with check (true);

drop policy if exists "expenses_staff_all" on expenses;
create policy "expenses_staff_all" on expenses
  for all to authenticated using (true) with check (true);

-- =============================================
-- SEED: 50 menu items
-- Cost is set to ~40% of price as a sensible default
-- =============================================

insert into menu_items (name, category, description, price, cost, photo, sort_order) values
  -- Coffee
  ('Americano', 'Coffee', 'Double shot espresso with hot water', 550, 220, '/drinks/americano.jpg', 1),
  ('Cappuccino', 'Coffee', 'Espresso with steamed milk foam', 600, 240, '/drinks/cappuccino.jpg', 2),
  ('Mocha Cappuccino', 'Coffee', 'Espresso, chocolate, steamed milk', 650, 260, '/drinks/mocha-cappuccino.jpg', 3),
  ('Flat White', 'Coffee', 'Double ristretto with velvety micro-foam', 625, 250, null, 4),
  ('Long Black', 'Coffee', 'Hot water with double espresso', 550, 220, null, 5),

  -- Iced Latte
  ('Spanish Latte', 'Iced Latte', 'Condensed milk, espresso, cold cream over ice', 625, 250, '/drinks/spanish-latte.jpg', 10),
  ('French Vanilla', 'Iced Latte', 'Vanilla syrup, espresso, cold milk', 625, 250, '/drinks/french-vanilla.jpg', 11),
  ('Caramella', 'Iced Latte', 'Caramel syrup, espresso, cold milk', 650, 260, '/drinks/caramella.jpg', 12),
  ('Creme Brulee', 'Iced Latte', 'Custard-sweet espresso over ice', 645, 258, '/drinks/creme-brulee.jpg', 13),
  ('Roasted Hazelnut', 'Iced Latte', 'Hazelnut syrup, espresso, cold milk', 645, 258, '/drinks/roasted-hazelnut.jpg', 14),
  ('Tiramisu Espresso', 'Iced Latte', 'Tiramisu syrup, espresso, cream milk', 660, 264, '/drinks/tiramisu-espresso.jpg', 15),
  ('Strawberry Mocha', 'Iced Latte', 'Strawberry, mocha, espresso, ice', 660, 264, null, 16),
  ('Salted Caramel Latte', 'Iced Latte', 'Salted caramel, espresso, cold milk', 650, 260, null, 17),
  ('Coconut Latte', 'Iced Latte', 'Coconut syrup, espresso, cold milk', 670, 268, null, 18),
  ('Brown Sugar Latte', 'Iced Latte', 'Brown sugar syrup, espresso, cinnamon milk', 650, 260, null, 19),

  -- Hot Latte
  ('Spanish Latte (Hot)', 'Hot Latte', 'Condensed milk with espresso', 600, 240, null, 20),
  ('French Vanilla (Hot)', 'Hot Latte', 'Vanilla syrup, espresso, steamed milk', 600, 240, null, 21),
  ('Hazelnut Latte (Hot)', 'Hot Latte', 'Hazelnut, espresso, steamed milk', 620, 248, null, 22),
  ('Caramel Latte (Hot)', 'Hot Latte', 'Caramel, espresso, steamed milk', 610, 244, null, 23),
  ('Creme Brulee (Hot)', 'Hot Latte', 'Custard sweet espresso, steamed milk', 625, 250, null, 24),

  -- Frappé
  ('Mocha Frappe', 'Frappé', 'Blended mocha espresso with whipped cream', 820, 328, '/drinks/mocha-frappe.jpg', 30),
  ('Caramel Frappe', 'Frappé', 'Blended caramel espresso with whipped cream', 820, 328, '/drinks/caramel-frappe.jpg', 31),
  ('Vanilla-Bean Frappe', 'Frappé', 'Vanilla bean blended with cold milk', 800, 320, '/drinks/vanilla-bean-frappe.jpg', 32),
  ('Hazelnut Frappe', 'Frappé', 'Hazelnut blended espresso frappe', 830, 332, null, 33),
  ('Strawberry Frappe', 'Frappé', 'Strawberry blended with cream', 800, 320, null, 34),
  ('Oreo Frappe', 'Frappé', 'Oreo cookie blended with cream', 850, 340, null, 35),
  ('Lotus Frappe', 'Frappé', 'Lotus Biscoff blended with espresso cream', 870, 348, null, 36),

  -- Non-Coffee
  ('Iced Chocolate', 'Non-Coffee', 'Premium chocolate over cold milk and ice', 620, 248, '/drinks/iced-chocolate.jpg', 40),
  ('Hot Chocolate', 'Non-Coffee', 'Rich premium chocolate steamed milk', 620, 248, '/drinks/hot-chocolate.jpg', 41),
  ('Berry Lemonade', 'Non-Coffee', 'Mixed berry and fresh lemon over ice', 550, 220, '/drinks/berry-lemonade.jpg', 42),
  ('Mint Lemonade', 'Non-Coffee', 'Fresh mint and lemon with ice', 540, 216, '/drinks/mint-lemonade.jpg', 43),
  ('Virgin Mojito', 'Non-Coffee', 'Mint, lime, soda, crushed ice', 560, 224, null, 44),
  ('Mango Lassi', 'Non-Coffee', 'Mango, yogurt, cold milk', 600, 240, null, 45),
  ('Oreo Milkshake', 'Non-Coffee', 'Oreo cookie milkshake', 750, 300, null, 46),

  -- Iced Tea
  ('Peach Iced Tea', 'Iced Tea', 'Monin peach, black tea, cream cold foam', 580, 232, '/drinks/peach-iced-tea.jpg', 50),
  ('Raspberry Iced Tea', 'Iced Tea', 'Monin raspberry, black tea, ice', 570, 228, '/drinks/raspberry-iced-tea.jpg', 51),
  ('Lychee Iced Tea', 'Iced Tea', 'Lychee syrup, green tea, ice', 575, 230, null, 52),
  ('Passion Fruit Tea', 'Iced Tea', 'Passion fruit, green tea, cream foam', 585, 234, null, 53),
  ('Mango Green Tea', 'Iced Tea', 'Mango, green tea, ice', 575, 230, null, 54),

  -- New Recipe
  ('Tiramisu Frappe', 'New Recipe', 'Tiramisu espresso frappe with mascarpone', 890, 356, null, 60),
  ('Lotus Latte', 'New Recipe', 'Lotus Biscoff, espresso, cold milk', 720, 288, null, 61),
  ('Charcoal Latte', 'New Recipe', 'Activated charcoal, espresso, almond milk', 710, 284, null, 62),
  ('Rose Latte', 'New Recipe', 'Rose syrup, espresso, cold milk, rose petals', 700, 280, null, 63),
  ('Matchaccino', 'New Recipe', 'Matcha, espresso, steamed milk', 720, 288, null, 64),
  ('Dalgona Coffee', 'New Recipe', 'Whipped coffee foam over cold milk', 660, 264, null, 65),
  ('S''mores Latte', 'New Recipe', 'Graham, chocolate, marshmallow, espresso', 760, 304, null, 66),
  ('Banana Foster Latte', 'New Recipe', 'Caramelised banana, espresso, cold milk', 720, 288, null, 67),
  ('Cold Brew', 'New Recipe', '12-hour cold steeped coffee over ice', 600, 240, null, 68),
  ('Nitro Cold Brew', 'New Recipe', 'Nitrogen-infused cold brew on tap', 700, 280, null, 69)
on conflict do nothing;
