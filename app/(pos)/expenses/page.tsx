'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { pkr, type Expense } from '@/lib/utils';

const EMPTY: Partial<Expense> = {
  amount: 0,
  category: 'Supplies',
  description: '',
  spent_at: new Date().toISOString().slice(0, 10),
};

const CATEGORIES = ['Supplies', 'Salaries', 'Rent', 'Utilities', 'Marketing', 'Equipment', 'Other'];

export default function ExpensesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<Expense[]>([]);
  const [editing, setEditing] = useState<Partial<Expense> | null>(null);

  const load = async () => {
    const { data } = await supabase.from('expenses').select('*').order('spent_at', { ascending: false });
    setList((data as Expense[]) || []);
  };

  useEffect(() => { load(); }, []);

  const total = list.reduce((s, e) => s + e.amount, 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const monthTotal = list.filter((e) => e.spent_at >= monthStart).reduce((s, e) => s + e.amount, 0);

  const save = async () => {
    if (!editing || !editing.amount) return;
    const payload = {
      amount: Number(editing.amount),
      category: editing.category || 'Other',
      description: editing.description || null,
      spent_at: editing.spent_at || new Date().toISOString().slice(0, 10),
    };
    if (editing.id) {
      await supabase.from('expenses').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('expenses').insert(payload);
    }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="sticker text-sage border-sage mb-3">Cash out</span>
          <h1 className="h-display text-5xl mt-3">Expenses</h1>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
          <Plus size={16} /> Add expense
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-amber text-charcoal rounded-3xl p-6 grain">
          <p className="text-xs uppercase tracking-widest opacity-60">This month</p>
          <p className="h-display text-4xl mt-1">{pkr(monthTotal)}</p>
        </div>
        <div className="bg-charcoal text-cream rounded-3xl p-6 grain">
          <p className="text-xs uppercase tracking-widest opacity-60">All time</p>
          <p className="h-display text-4xl mt-1">{pkr(total)}</p>
        </div>
      </div>

      <div className="bg-cream rounded-3xl border-[1.5px] border-charcoal/10 overflow-hidden">
        {list.length === 0 ? (
          <p className="text-charcoal/50 text-center py-16">No expenses logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-deep-sand text-charcoal/60 uppercase tracking-widest text-xs">
              <tr>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Category</th>
                <th className="text-left p-4 hidden md:table-cell">Description</th>
                <th className="text-right p-4">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-t border-charcoal/5 hover:bg-sand/40">
                  <td className="p-4 text-charcoal/70">{e.spent_at}</td>
                  <td className="p-4">
                    <span className="sticker !text-[10px] !py-1 text-terracotta border-terracotta">{e.category}</span>
                  </td>
                  <td className="p-4 hidden md:table-cell text-charcoal/70">{e.description || '—'}</td>
                  <td className="p-4 text-right font-semibold text-terracotta">{pkr(e.amount)}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => setEditing(e)} className="text-charcoal/60 hover:text-terracotta mr-3 text-xs uppercase tracking-widest">Edit</button>
                    <button onClick={() => remove(e.id)} className="text-charcoal/60 hover:text-terracotta"><Trash2 size={14} /></button>
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
              <h3 className="h-display text-3xl">{editing.id ? 'Edit expense' : 'New expense'}</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-charcoal/60">Amount (PKR)</label>
                <input className="field" type="number" value={editing.amount || 0} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} />
              </div>
              <select className="field" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="date" className="field" value={editing.spent_at || ''} onChange={(e) => setEditing({ ...editing, spent_at: e.target.value })} />
              <textarea className="field" rows={2} placeholder="Description" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
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
