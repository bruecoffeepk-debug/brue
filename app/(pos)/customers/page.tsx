'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Customer } from '@/lib/utils';

const EMPTY: Partial<Customer> = { name: '', phone: '', discount_percent: 0, notes: '' };

export default function CustomersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);

  const load = async () => {
    const { data } = await supabase.from('customers').select('*').order('name', { ascending: true });
    setList((data as Customer[]) || []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing || !editing.name) return;
    const payload = {
      name: editing.name,
      phone: editing.phone || null,
      discount_percent: Number(editing.discount_percent) || 0,
      notes: editing.notes || null,
    };
    if (editing.id) {
      await supabase.from('customers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('customers').insert(payload);
    }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    await supabase.from('customers').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="sticker text-sage border-sage mb-3">{list.length} regulars</span>
          <h1 className="h-display text-5xl mt-3">Customers</h1>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
          <Plus size={16} /> Add customer
        </button>
      </div>

      <div className="bg-cream rounded-3xl border-[1.5px] border-charcoal/10 overflow-hidden">
        {list.length === 0 ? (
          <p className="text-charcoal/50 text-center py-16">No customers yet. Add your first regular.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-deep-sand text-charcoal/60 uppercase tracking-widest text-xs">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4 hidden md:table-cell">Phone</th>
                <th className="text-right p-4">Discount</th>
                <th className="text-left p-4 hidden md:table-cell">Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-charcoal/5 hover:bg-sand/40">
                  <td className="p-4 font-semibold">{c.name}</td>
                  <td className="p-4 hidden md:table-cell text-charcoal/70">{c.phone || '—'}</td>
                  <td className="p-4 text-right">
                    {c.discount_percent > 0 ? (
                      <span className="sticker !text-[10px] !py-1 text-sage border-sage">−{c.discount_percent}%</span>
                    ) : '—'}
                  </td>
                  <td className="p-4 hidden md:table-cell text-charcoal/60">{c.notes || '—'}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => setEditing(c)} className="text-charcoal/60 hover:text-terracotta mr-3"><Pencil size={14} /></button>
                    <button onClick={() => remove(c.id)} className="text-charcoal/60 hover:text-terracotta"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-5" onClick={(e) => e.currentTarget === e.target && setEditing(null)}>
          <div className="bg-cream rounded-t-3xl md:rounded-3xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="h-display text-3xl">{editing.id ? 'Edit customer' : 'New customer'}</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input className="field" placeholder="Name" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <input className="field" placeholder="Phone (e.g. 03001234567)" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              <div>
                <label className="text-xs uppercase tracking-widest text-charcoal/60">Discount %</label>
                <input className="field" type="number" min={0} max={100} value={editing.discount_percent || 0} onChange={(e) => setEditing({ ...editing, discount_percent: Number(e.target.value) })} />
              </div>
              <textarea className="field" rows={2} placeholder="Notes (optional)" value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
            <button onClick={save} className="btn-primary w-full justify-center mt-6">
              <Save size={16} /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
