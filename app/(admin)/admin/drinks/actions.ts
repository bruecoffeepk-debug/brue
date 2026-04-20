'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function bust() {
  // Refresh anything that reads menu_items
  revalidatePath('/');
  revalidatePath('/home');
  revalidatePath('/menu');
  revalidatePath('/admin');
  revalidatePath('/admin/drinks');
}

export async function createDrink(formData: FormData) {
  const supabase = createClient();
  const payload = formPayload(formData);
  const { data, error } = await supabase
    .from('menu_items')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  bust();
  redirect(`/admin/drinks/${data.id}?created=1`);
}

export async function updateDrink(id: string, formData: FormData) {
  const supabase = createClient();
  const payload = formPayload(formData);
  const { error } = await supabase.from('menu_items').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
  bust();
  revalidatePath(`/admin/drinks/${id}`);
}

export async function deleteDrink(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
  bust();
  redirect('/admin/drinks?deleted=1');
}

export async function toggleStock(id: string, nextValue: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('menu_items')
    .update({ in_stock: nextValue })
    .eq('id', id);
  if (error) throw new Error(error.message);
  bust();
}

export async function toggleActive(id: string, nextValue: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('menu_items')
    .update({ active: nextValue })
    .eq('id', id);
  if (error) throw new Error(error.message);
  bust();
}

function formPayload(fd: FormData) {
  const name = String(fd.get('name') ?? '').trim();
  const description = String(fd.get('description') ?? '').trim() || null;
  const category_id = String(fd.get('category_id') ?? '') || null;
  const category_name = String(fd.get('category_name') ?? '').trim();
  const price = Number(fd.get('price') ?? 0);
  const cost = Number(fd.get('cost') ?? 0);
  const photo = String(fd.get('photo') ?? '').trim() || null;
  const sort_order = Number(fd.get('sort_order') ?? 0);
  const in_stock = fd.get('in_stock') === 'on' || fd.get('in_stock') === 'true';
  const active = fd.get('active') === 'on' || fd.get('active') === 'true';

  if (!name) throw new Error('Name is required');
  if (!price || price < 0) throw new Error('Price must be > 0');

  return {
    name,
    description,
    category_id,
    // keep legacy text column populated so POS still works
    category: category_name || null,
    price: Math.round(price),
    cost: Math.round(cost),
    photo,
    sort_order: Math.round(sort_order),
    in_stock,
    active,
  };
}
