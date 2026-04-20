import { createClient } from '@/lib/supabase/server';
import CategoriesClient from '@/components/admin/CategoriesClient';
import type { Category } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function load(): Promise<{ categories: (Category & { count: number })[] }> {
  const supabase = createClient();
  const [catsRes, countsRes] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
    supabase.from('menu_items').select('category_id').eq('active', true),
  ]);
  const counts = new Map<string, number>();
  (countsRes.data ?? []).forEach((row: any) => {
    if (!row.category_id) return;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  });
  const categories = (catsRes.data ?? []).map((c: any) => ({
    ...c,
    count: counts.get(c.id) ?? 0,
  }));
  return { categories };
}

export default async function CategoriesPage() {
  const { categories } = await load();
  return <CategoriesClient categories={categories} />;
}
