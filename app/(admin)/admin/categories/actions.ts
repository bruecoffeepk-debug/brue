'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

/**
 * Defense-in-depth: every admin server action must call this first.
 * RLS alone is not enough — explicit auth check protects against
 * misconfigured policies turning these into public endpoints.
 */
async function requireStaff() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Unauthorised — please sign in');
  }
  return supabase;
}

function bust() {
  revalidatePath('/');
  revalidatePath('/home');
  revalidatePath('/menu');
  revalidatePath('/admin');
  revalidatePath('/admin/drinks');
  revalidatePath('/admin/categories');
}

export async function createCategory(formData: FormData) {
  const supabase = await requireStaff();
  const name = String(formData.get('name') ?? '').trim();
  const emoji = String(formData.get('emoji') ?? '').trim() || null;
  const sort_order = Number(formData.get('sort_order') ?? 100);
  if (!name) throw new Error('Name required');

  const { error } = await supabase.from('categories').insert({
    name,
    slug: slugify(name),
    emoji,
    sort_order: Math.round(sort_order),
    active: true,
  });
  if (error) throw new Error(error.message);
  bust();
}

export async function updateCategory(id: string, formData: FormData) {
  const supabase = await requireStaff();
  const name = String(formData.get('name') ?? '').trim();
  const emoji = String(formData.get('emoji') ?? '').trim() || null;
  const sort_order = Number(formData.get('sort_order') ?? 100);
  const active = formData.get('active') === 'true' || formData.get('active') === 'on';
  if (!name) throw new Error('Name required');

  const { error } = await supabase
    .from('categories')
    .update({
      name,
      slug: slugify(name),
      emoji,
      sort_order: Math.round(sort_order),
      active,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  bust();
}

export async function deleteCategory(id: string) {
  const supabase = await requireStaff();
  // SQL FK is `on delete set null`, so drinks remain — they just lose their category.
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
  bust();
}
