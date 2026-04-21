import { createClient } from '@/lib/supabase/server';
import MenuClient from '@/components/public/MenuClient';
import type { Category, DrinkWithCategory } from '@/lib/utils';

// While debugging empty menu — query Supabase on every request.
// Switch back to `export const revalidate = 30` once stable for ISR caching.
export const dynamic = 'force-dynamic';

async function loadMenu(): Promise<{ drinks: DrinkWithCategory[]; categories: Category[] }> {
  const supabase = createClient();
  const [drinksRes, catsRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('*, categories ( id, name, slug, emoji )')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);
  return {
    drinks: (drinksRes.data ?? []) as any,
    categories: (catsRes.data ?? []) as any,
  };
}

export default async function MenuPage() {
  const { drinks, categories } = await loadMenu();
  return <MenuClient initialDrinks={drinks} categories={categories} />;
}
