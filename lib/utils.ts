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

// Map drink names to local photos in /public/drinks
export const DRINK_PHOTO: Record<string, string> = {
  'Americano': '/drinks/americano.jpg',
  'Cappuccino': '/drinks/cappuccino.jpg',
  'Mocha Cappuccino': '/drinks/mocha-cappuccino.jpg',
  'Spanish Latte': '/drinks/spanish-latte.jpg',
  'French Vanilla': '/drinks/french-vanilla.jpg',
  'Caramella': '/drinks/caramella.jpg',
  'Creme Brulee': '/drinks/creme-brulee.jpg',
  'Roasted Hazelnut': '/drinks/roasted-hazelnut.jpg',
  'Tiramisu Espresso': '/drinks/tiramisu-espresso.jpg',
  'Mocha Frappe': '/drinks/mocha-frappe.jpg',
  'Caramel Frappe': '/drinks/caramel-frappe.jpg',
  'Vanilla-Bean Frappe': '/drinks/vanilla-bean-frappe.jpg',
  'Iced Chocolate': '/drinks/iced-chocolate.jpg',
  'Hot Chocolate': '/drinks/hot-chocolate.jpg',
  'Berry Lemonade': '/drinks/berry-lemonade.jpg',
  'Mint Lemonade': '/drinks/mint-lemonade.jpg',
  'Peach Iced Tea': '/drinks/peach-iced-tea.jpg',
  'Raspberry Iced Tea': '/drinks/raspberry-iced-tea.jpg',
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
