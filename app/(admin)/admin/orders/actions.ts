'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Defense-in-depth: every admin server action must call this first. Without it,
 * we rely entirely on RLS — a single misconfigured policy could turn every
 * action below into a public mutation endpoint. Explicit > implicit.
 */
async function requireStaff() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Unauthorised — please sign in');
  }
  return supabase;
}

const VALID_STATUSES = new Set([
  'pending', 'accepted', 'preparing', 'out', 'completed', 'cancelled',
]);
const VALID_PAYMENTS = new Set([
  'unpaid', 'cash', 'card', 'jazzcash', 'easypaisa', 'nayapay', 'bank transfer', 'complimentary',
]);

/**
 * Move an order along its lifecycle. Valid values:
 *   pending → accepted → preparing → out → completed
 *   any → cancelled
 *
 * We stamp the matching *_at timestamp so the timeline on the receipt / dashboard
 * reflects reality without adding a second table.
 */
export async function setStatus(id: string, next: string) {
  if (!VALID_STATUSES.has(next)) throw new Error('Invalid status');
  const supabase = await requireStaff();
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
  if (!VALID_PAYMENTS.has(method.toLowerCase())) throw new Error('Invalid payment method');
  const supabase = await requireStaff();
  const { error } = await supabase
    .from('orders')
    .update({ payment_method: method })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${id}`);
}
