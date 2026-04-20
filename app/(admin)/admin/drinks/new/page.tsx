import Link from 'next/link';
import DrinkForm from '@/components/admin/DrinkForm';
import { createClient } from '@/lib/supabase/server';
import type { Category } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function getCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  return (data ?? []) as any;
}

export default async function NewDrinkPage() {
  const categories = await getCategories();

  return (
    <div className="px-10 py-12 max-w-[1100px]">
      <div className="mb-8">
        <Link href="/admin/drinks" className="eyebrow" style={{ color: 'var(--ink-muted)' }}>
          ← Drinks
        </Link>
        <h1 className="display mt-3" style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4rem)' }}>
          New <span className="ital">drink</span>.
        </h1>
        <p className="mt-2" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Add a fresh item to the menu. It goes live as soon as you tick &quot;show on public menu&quot;.
        </p>
      </div>

      {categories.length === 0 ? (
        <div
          className="px-5 py-8 rounded-xl text-center"
          style={{
            border: '1px dashed var(--line-strong)',
            background: 'var(--paper)',
            color: 'var(--ink-soft)',
          }}
        >
          You need at least one category first.{' '}
          <Link href="/admin/categories" style={{ color: 'var(--terra)' }}>Create one →</Link>
        </div>
      ) : (
        <DrinkForm mode="new" categories={categories} />
      )}
    </div>
  );
}
