-- ──────────────────────────────────────────────────────────
-- BRUE · migration 002 — categories + in_stock + admin role
-- Run AFTER schema.sql (which creates menu_items, orders, etc.)
-- Idempotent: safe to run multiple times.
-- ──────────────────────────────────────────────────────────

-- 1) CATEGORIES TABLE ----------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  emoji text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) EXTEND menu_items --------------------------------------
alter table menu_items
  add column if not exists in_stock boolean not null default true;

alter table menu_items
  add column if not exists category_id uuid references categories(id) on delete set null;

alter table menu_items
  add column if not exists updated_at timestamptz not null default now();

-- trigger: keep updated_at fresh on any write
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists menu_items_touch on menu_items;
create trigger menu_items_touch
  before update on menu_items
  for each row execute function touch_updated_at();

-- 3) SEED CATEGORIES ----------------------------------------
insert into categories (name, slug, emoji, sort_order) values
  ('Coffee',      'coffee',       '☕', 10),
  ('Iced Latte',  'iced-latte',   '🧊', 20),
  ('Hot Latte',   'hot-latte',    '🔥', 30),
  ('Frappé',      'frappe',       '🥤', 40),
  ('Non-Coffee',  'non-coffee',   '🥛', 50),
  ('Iced Tea',    'iced-tea',     '🍵', 60),
  ('Lemonade',    'lemonade',     '🍋', 65),
  ('Sweets',      'sweets',       '🍰', 70),
  ('New Recipe',  'new-recipe',   '✨', 80)
on conflict (slug) do nothing;

-- 4) BACKFILL: match existing menu_items.category (text) → category_id
update menu_items mi
  set category_id = c.id
  from categories c
  where mi.category_id is null
    and lower(trim(mi.category)) = lower(trim(c.name));

-- 5) RLS ------------------------------------------------------
alter table categories enable row level security;

drop policy if exists "categories_public_read" on categories;
create policy "categories_public_read" on categories
  for select using (active = true);

drop policy if exists "categories_staff_all" on categories;
create policy "categories_staff_all" on categories
  for all to authenticated using (true) with check (true);

-- 6) PUBLIC can still read menu_items, but we now respect in_stock on UI side only.
--    (We don't want the menu to HIDE sold-out drinks; we want to SHOW them as sold-out.
--     So RLS still returns in_stock=false rows.)

-- ──────────────────────────────────────────────────────────
-- STORAGE BUCKET for drink photos
-- Create a 'drink-photos' bucket via Supabase dashboard, then run:
-- ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('drink-photos', 'drink-photos', true)
on conflict (id) do nothing;

-- Allow public read
drop policy if exists "drink_photos_public_read" on storage.objects;
create policy "drink_photos_public_read" on storage.objects
  for select using (bucket_id = 'drink-photos');

-- Allow authenticated admins to upload / update / delete
drop policy if exists "drink_photos_staff_write" on storage.objects;
create policy "drink_photos_staff_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'drink-photos')
  with check (bucket_id = 'drink-photos');
