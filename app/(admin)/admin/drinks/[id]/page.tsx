import Link from 'next/link';
import { notFound } from 'next/navigation';
import DrinkForm from '@/components/admin/DrinkForm';
import { createClient } from '@/lib/supabase/server';
import type { Category, MenuItem } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function load(id: string): Promise<{ drink: MenuItem | null; categories: Category[] }> {
  const supabase = createClient();
  const [d, c] = await Promise.all([
    supabase.from('menu_items').select('*').eq('id', id).single(),
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
  ]);
  return { drink: (d.data ?? null) as any, categories: (c.data ?? []) as any };
}

export default async function EditDrinkPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string };
}) {
  const { drink, categories } = await load(params.id);
  if (!drink) notFound();

  return (
    <div className="px-10 py-12 max-w-[1100px]">
      <div className="mb-8">
        <Link href="/admin/drinks" className="eyebrow" style={{ color: 'var(--ink-muted)' }}>
          ← Drinks
        </Link>
        <h1
          className="display mt-3"
          style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4rem)', maxWidth: 800 }}
        >
          {drink.name}
        </h1>
        <p className="mt-2" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Edit any field — saves go live within 60 seconds on the public menu.
        </p>
        {searchParams.created && (
          <div
            className="mt-5 px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(107,122,83,0.12)',
              border: '1px solid rgba(107,122,83,0.3)',
              color: 'var(--sage)',
            }}
          >
            Drink created — you can keep editing or head back to the list.
          </div>
        )}
      </div>

      <DrinkForm mode="edit" categories={categories} drink={drink} />
    </div>
  );
}
