import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pkr(amount: number): string {
  return `PKR ${amount.toLocaleString('en-PK')}`;
}

export function margin(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}

export function profit(price: number, cost: number, qty = 1): number {
  return (price - cost) * qty;
}

// Legacy: the original POS pages (/pos, /menu/manage) still use this string list
// for category dropdowns. The new admin uses the `categories` table + `Category`
// type defined further down. Keep both — they don't fight, they target different UIs.
export const CATEGORIES = [
  'Coffee',
  'Iced Latte',
  'Hot Latte',
  'Frappé',
  'Non-Coffee',
  'Iced Tea',
  'New Recipe',
  'Dessert',
] as const;
export type LegacyCategory = (typeof CATEGORIES)[number];

export const PAYMENT_METHODS = [
  'Cash',
  'Card',
  'JazzCash',
  'Easypaisa',
  'NayaPay',
  'Bank Transfer',
  'Complimentary',
] as const;

export const ORDER_TYPES = ['Pickup', 'Delivery'] as const;

// Map drink names to local photos in /public/drinks.
// 32 real product photos cover 45 of 50 menu items. The 5 remaining
// (Ice Sweetful, the 3 Desserts, and one duplicate-name disambiguation)
// have no photo yet — they'll fall back to the placeholder card on the menu.
// Items with NO own photo borrow a visually-similar representative
// (e.g. all unflavoured hot lattes borrow cappuccino.jpg).
export const DRINK_PHOTO: Record<string, string> = {
  // ─── Coffee ───────────────────────────────────────────────
  'Americano': '/drinks/americano.jpg',
  'Cappuccino': '/drinks/cappuccino.jpg',
  'Mocha Cappuccino': '/drinks/mocha-cappuccino.jpg',
  'Iced Americano': '/drinks/iced-americano.jpg',

  // ─── Iced Latte ───────────────────────────────────────────
  'Spanish Latte': '/drinks/spanish-latte.jpg',
  'French Vanilla': '/drinks/french-vanilla.jpg',
  'Caramella': '/drinks/caramella.jpg',
  'Creme Brulee': '/drinks/creme-brulee.jpg',
  'Roasted Hazelnut': '/drinks/roasted-hazelnut.jpg',
  'Tiramisu Espresso': '/drinks/tiramisu-espresso.jpg',
  'Strawberry Mocha': '/drinks/strawberry-mocha.jpg',
  'Salted Caramel Latte': '/drinks/salted-caramel-latte.jpg',
  'Brown Sugar Latte': '/drinks/brown-sugar-latte.jpg',
  'Mocha Latte': '/drinks/mocha-latte.jpg',              // Iced variant; Hot duplicates below
  'Affogato Latte': '/drinks/creme-brulee.jpg',          // reuse — closest visual match

  // ─── Hot Latte ────────────────────────────────────────────
  'Cafe Latte': '/drinks/cafe-latte.jpg',
  'Spanish Latte (Hot)': '/drinks/spanish-latte-hot.jpg',
  'French Vanilla (Hot)': '/drinks/french-vanilla-hot.jpg',
  'Hazelnut Latte (Hot)': '/drinks/hazelnut-latte-hot.jpg',
  'Caramel Latte (Hot)': '/drinks/caramel-latte-hot.jpg',
  'Creme Brulee (Hot)': '/drinks/creme-brulee-hot.jpg',
  'Salted Caramel': '/drinks/mocha-cappuccino.jpg',      // reuse — no Hot photo
  'Tiramisu': '/drinks/mocha-cappuccino.jpg',            // reuse
  // 'Mocha Latte' (Hot) duplicates the Iced name above. The DB row carries its
  // own photo column (see schema.sql / migration 004) — DRINK_PHOTO is just
  // a name-keyed fallback, so name lookups hit the iced version.

  // ─── Frappé ───────────────────────────────────────────────
  'Mocha Frappe': '/drinks/mocha-frappe.jpg',
  'Caramel Frappe': '/drinks/caramel-frappe.jpg',
  'Vanilla-Bean Frappe': '/drinks/vanilla-bean-frappe.jpg',
  'Hazelnut Frappe': '/drinks/hazelnut-frappe.jpg',
  'Strawberry Frappe': '/drinks/strawberry-frappe.jpg',
  'Oreo Frappe': '/drinks/oreo-frappe.jpg',
  // 'Strawberry Mocha' (Frappé) — duplicate name; see note above

  // ─── Non-Coffee ───────────────────────────────────────────
  'Iced Chocolate': '/drinks/iced-chocolate.jpg',
  'Hot Chocolate': '/drinks/hot-chocolate.jpg',
  'Berry Lemonade': '/drinks/berry-lemonade.jpg',
  'Mint Lemonade': '/drinks/mint-lemonade.jpg',
  'Strawberry Shake': '/drinks/strawberry-shake.jpg',
  'Chocolate Shake': '/drinks/chocolate-shake.jpg',

  // ─── Iced Tea ─────────────────────────────────────────────
  'Peach Iced Tea': '/drinks/peach-iced-tea.jpg',
  'Raspberry Iced Tea': '/drinks/raspberry-iced-tea.jpg',

  // ─── New Recipe ───────────────────────────────────────────
  'Espresso Tonic': '/drinks/espresso-tonic.jpg',        // renamed from "Espresso Bomb"
  'Mont de Creme': '/drinks/mont-de-creme.jpg',
  'Salted Mocha': '/drinks/mocha-cappuccino.jpg',        // reuse
  // 'Ice Sweetful' — no photo yet
  // 'Strawberry Mocha' (New Recipe) — duplicate name; see note above

  // ─── Dessert ──────────────────────────────────────────────
  // Real product photos. Each item also has alternate shots in /public/drinks/
  // (tiramisu-affogato-2.jpg, tiramisu-affogato-3.jpg, tiramisu-cup-2.jpg) that
  // the admin page can swap to via /admin/drinks if you want to A/B them.
  'Tiramisu Affogato': '/drinks/tiramisu-affogato.jpg',
  'Tiramisu in a Cup': '/drinks/tiramisu-cup.jpg',
  'Brownie': '/drinks/brownie.jpg',
};

export type MenuItem = {
  id: string;
  name: string;
  category: string;            // legacy text column (kept for POS compat)
  category_id: string | null;  // FK → categories.id
  description: string | null;
  price: number;
  cost: number;
  photo: string | null;
  active: boolean;
  in_stock: boolean;           // shown as "Sold out" on public menu when false
  sort_order: number;
  created_at: string;
  updated_at?: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
};

// A drink WITH its category eagerly joined — what the public menu renders.
export type DrinkWithCategory = MenuItem & {
  categories: Pick<Category, 'id' | 'name' | 'slug' | 'emoji'> | null;
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  discount_percent: number;
  notes: string | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  line_total: number;
};

export type Order = {
  id: string;
  order_number: number;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  order_type: string;
  delivery_address: string | null;
  payment_method: string;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  status: string;
  channel: string;
  created_at: string;
};

export type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  spent_at: string;
  created_at: string;
};

export type CartLine = {
  id: string;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  photo: string | null;
};
