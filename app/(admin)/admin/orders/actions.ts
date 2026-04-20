'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Move an order along its lifecycle. Valid values:
 *   pending → accepted → preparing → out → completed
 *   any → cancelled
 *
 * We stamp the matching *_at timestamp so the timeline on the receipt / dashboard
 * reflects reality without adding a second table.
 */
export async function setStatus(id: string, next: string) {
  const supabase = createClient();
  const patch: Record<string, any> = { status: next };
  if (next === 'accepted') patch.accepted_at = new Date().toISOString();
  if (next === 'preparing') patch.ready_at = new Date().toISOString();
  if (next === 'out') patch.out_for_delivery_at = new Date().toISOString();
  if (next === 'completed') patch.completed_at = new Date().toISOString();

  const { error } = await supabase.from('orders').update(patch).eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin');
  revalidatePath(`/r/${id}`);
}

export async function setPayment(id: string, method: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('orders')
    .update({ payment_method: method })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${id}`);
}
