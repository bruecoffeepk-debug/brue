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
  ('Iced Americano', 'Coffee', 'Double espresso over cold water and ice', 580, 232, '/drinks/iced-americano.jpg', 6),

  -- Iced Latte
  ('Spanish Latte', 'Iced Latte', 'Condensed milk, espresso, cold cream over ice', 625, 250, '/drinks/spanish-latte.jpg', 10),
  ('French Vanilla', 'Iced Latte', 'Vanilla syrup, espresso, cold milk', 625, 250, '/drinks/french-vanilla.jpg', 11),
  ('Caramella', 'Iced Latte', 'Caramel syrup, espresso, cold milk', 650, 260, '/drinks/caramella.jpg', 12),
  ('Creme Brulee', 'Iced Latte', 'Custard-sweet espresso over ice', 645, 258, '/drinks/creme-brulee.jpg', 13),
  ('Roasted Hazelnut', 'Iced Latte', 'Hazelnut syrup, espresso, cold milk', 645, 258, '/drinks/roasted-hazelnut.jpg', 14),
  ('Tiramisu Espresso', 'Iced Latte', 'Tiramisu syrup, espresso, cream milk', 660, 264, '/drinks/tiramisu-espresso.jpg', 15),
  ('Strawberry Mocha', 'Iced Latte', 'Strawberry, mocha, espresso, ice', 660, 264, '/drinks/strawberry-mocha.jpg', 16),
  ('Salted Caramel Latte', 'Iced Latte', 'Salted caramel, espresso, cold milk', 650, 260, '/drinks/salted-caramel-latte.jpg', 17),
  ('Brown Sugar Latte', 'Iced Latte', 'Brown sugar syrup, espresso, cinnamon milk', 650, 260, '/drinks/brown-sugar-latte.jpg', 18),
  ('Affogato Latte', 'Iced Latte', 'Espresso poured over vanilla ice cream', 720, 288, '/drinks/creme-brulee.jpg', 19),
  ('Mocha Latte', 'Iced Latte', 'Iced mocha, espresso, cold milk', 660, 264, '/drinks/mocha-latte.jpg', 20),

  -- Hot Latte
  ('Cafe Latte', 'Hot Latte', 'Espresso with steamed milk', 580, 232, '/drinks/cafe-latte.jpg', 25),
  ('Salted Caramel', 'Hot Latte', 'Salted caramel, espresso, steamed milk', 610, 244, '/drinks/mocha-cappuccino.jpg', 26),
  ('Tiramisu', 'Hot Latte', 'Tiramisu syrup, espresso, steamed milk', 625, 250, '/drinks/mocha-cappuccino.jpg', 27),
  ('Mocha Latte', 'Hot Latte', 'Chocolate, espresso, steamed milk', 620, 248, '/drinks/mocha-cappuccino.jpg', 28),
  ('Spanish Latte (Hot)', 'Hot Latte', 'Condensed milk with espresso', 600, 240, '/drinks/spanish-latte-hot.jpg', 29),
  ('French Vanilla (Hot)', 'Hot Latte', 'Vanilla syrup, espresso, steamed milk', 600, 240, '/drinks/french-vanilla-hot.jpg', 30),
  ('Hazelnut Latte (Hot)', 'Hot Latte', 'Hazelnut, espresso, steamed milk', 620, 248, '/drinks/hazelnut-latte-hot.jpg', 31),
  ('Caramel Latte (Hot)', 'Hot Latte', 'Caramel, espresso, steamed milk', 610, 244, '/drinks/caramel-latte-hot.jpg', 32),
  ('Creme Brulee (Hot)', 'Hot Latte', 'Custard sweet espresso, steamed milk', 625, 250, '/drinks/creme-brulee-hot.jpg', 33),

  -- Frappé
  ('Mocha Frappe', 'Frappé', 'Blended mocha espresso with whipped cream', 820, 328, '/drinks/mocha-frappe.jpg', 40),
  ('Caramel Frappe', 'Frappé', 'Blended caramel espresso with whipped cream', 820, 328, '/drinks/caramel-frappe.jpg', 41),
  ('Vanilla-Bean Frappe', 'Frappé', 'Vanilla bean blended with cold milk', 800, 320, '/drinks/vanilla-bean-frappe.jpg', 42),
  ('Hazelnut Frappe', 'Frappé', 'Hazelnut blended espresso frappe', 830, 332, '/drinks/hazelnut-frappe.jpg', 43),
  ('Strawberry Frappe', 'Frappé', 'Strawberry blended with cream', 800, 320, '/drinks/strawberry-frappe.jpg', 44),
  ('Oreo Frappe', 'Frappé', 'Oreo cookie blended with cream', 850, 340, '/drinks/oreo-frappe.jpg', 45),
  ('Strawberry Mocha', 'Frappé', 'Strawberry mocha blended with whipped cream', 850, 340, '/drinks/strawberry-frappe.jpg', 46),

  -- Non-Coffee
  ('Iced Chocolate', 'Non-Coffee', 'Premium chocolate over cold milk and ice', 620, 248, '/drinks/iced-chocolate.jpg', 50),
  ('Hot Chocolate', 'Non-Coffee', 'Rich premium chocolate steamed milk', 620, 248, '/drinks/hot-chocolate.jpg', 51),
  ('Berry Lemonade', 'Non-Coffee', 'Mixed berry and fresh lemon over ice', 550, 220, '/drinks/berry-lemonade.jpg', 52),
  ('Mint Lemonade', 'Non-Coffee', 'Fresh mint and lemon with ice', 540, 216, '/drinks/mint-lemonade.jpg', 53),
  ('Strawberry Shake', 'Non-Coffee', 'Strawberry blended with vanilla ice cream', 700, 280, '/drinks/strawberry-shake.jpg', 55),
  ('Chocolate Shake', 'Non-Coffee', 'Chocolate blended with vanilla ice cream', 700, 280, '/drinks/chocolate-shake.jpg', 56),

  -- Iced Tea
  ('Peach Iced Tea', 'Iced Tea', 'Monin peach, black tea, cream cold foam', 580, 232, '/drinks/peach-iced-tea.jpg', 60),
  ('Raspberry Iced Tea', 'Iced Tea', 'Monin raspberry, black tea, ice', 570, 228, '/drinks/raspberry-iced-tea.jpg', 61),

  -- New Recipe
  ('Espresso Tonic', 'New Recipe', 'Espresso tonic bomb over ice', 720, 288, '/drinks/espresso-tonic.jpg', 70),
  ('Mont de Creme', 'New Recipe', 'Layered cream + espresso over ice', 720, 288, '/drinks/mont-de-creme.jpg', 71),
  ('Salted Mocha', 'New Recipe', 'Salted chocolate, espresso, cold milk', 700, 280, '/drinks/mocha-cappuccino.jpg', 72),
  ('Ice Sweetful', 'New Recipe', 'House sweet iced specialty', 680, 272, null, 73),
  ('Strawberry Mocha', 'New Recipe', 'Strawberry mocha specialty over ice', 720, 288, '/drinks/strawberry-mocha.jpg', 74),

  -- Dessert
  ('Tiramisu Affogato', 'Dessert', 'Tiramisu with hot espresso poured over', 650, 260, '/drinks/tiramisu-affogato.jpg', 80),
  ('Tiramisu in a Cup', 'Dessert', 'Classic tiramisu served in a cup', 550, 220, '/drinks/tiramisu-cup.jpg', 81),
  ('Brownie', 'Dessert', 'Warm chocolate brownie', 450, 180, '/drinks/brownie.jpg', 82)
on conflict do nothing;
