'use client';

export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, DRINK_PHOTO, margin, pkr, type MenuItem } from '@/lib/utils';

const EMPTY: Partial<MenuItem> = {
  name: '',
  category: 'Coffee',
  description: '',
  price: 0,
  cost: 0,
  photo: '',
  active: true,
  sort_order: 100,
};

export default function ManageMenu() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [filter, setFilter] = useState('All');

  const load = async () => {
    const { data } = await supabase.from('menu_items').select('*').order('sort_order', { ascending: true });
    setItems((data as MenuItem[]) || []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name,
      category: editing.category,
      description: editing.description || null,
      price: Number(editing.price) || 0,
      cost: Number(editing.cost) || 0,
      photo: editing.photo || null,
      active: editing.active ?? true,
      sort_order: Number(editing.sort_order) || 100,
    };
    if (editing.id) {
      await supabase.from('menu_items').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('menu_items').insert(payload);
    }
    setEditing(null);
    load();
  };

  const toggleActive = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ active: !item.active }).eq('id', item.id);
    load();
  };

  const cats = ['All', ...CATEGORIES];
  const filtered = filter === 'All' ? items : items.filter((i) => i.category === filter);

  return (
    <div>
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <span className="sticker text-sage border-sage mb-3">{items.length} items</span>
          <h1 className="h-display text-5xl mt-3">Menu</h1>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
          <Plus size={16} /> Add item
        </button>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {cats.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`chip ${filter === c ? 'active' : ''}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="bg-cream rounded-3xl border-[1.5px] border-charcoal/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-deep-sand text-charcoal/60 uppercase tracking-widest text-xs">
            <tr>
              <th className="text-left p-3"></th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3 hidden md:table-cell">Category</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3 hidden md:table-cell">Cost</th>
              <th className="text-right p-3 hidden md:table-cell">Margin</th>
              <th className="text-center p-3">Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const photo = item.photo ?? DRINK_PHOTO[item.name] ?? null;
              return (
                <tr key={item.id} className="border-t border-charcoal/5 hover:bg-sand/40 transition">
                  <td className="p-2">
                    <div className="w-12 h-12 rounded-xl bg-deep-sand overflow-hidden">
                      {photo && <Image src={photo} alt="" width={60} height={60} className="object-cover w-full h-full" />}
                    </div>
                  </td>
                  <td className="p-3 font-semibold">{item.name}</td>
                  <td className="p-3 hidden md:table-cell">{item.category}</td>
                  <td className="p-3 text-right text-terracotta font-semibold">{pkr(item.price)}</td>
                  <td className="p-3 text-right hidden md:table-cell text-charcoal/60">{pkr(item.cost)}</td>
                  <td className="p-3 text-right hidden md:table-cell">{margin(item.price, item.cost)}%</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => toggleActive(item)}
                      className={`px-3 py-1 rounded-full text-xs ${item.active ? 'bg-sage text-cream' : 'bg-charcoal/10 text-charcoal/60'}`}
                    >
                      {item.active ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td className="p-3">
                    <button onClick={() => setEditing(item)} className="text-charcoal/60 hover:text-terracotta">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-5" onClick={(e) => e.currentTarget === e.target && setEditing(null)}>
          <div className="bg-cream rounded-t-3xl md:rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="h-display text-3xl">{editing.id ? 'Edit item' : 'New item'}</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <input className="field" placeholder="Name" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <select className="field" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <textarea className="field" rows={2} placeholder="Description" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-charcoal/60">Price (PKR)</label>
                  <input className="field" type="number" value={editing.price || 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-charcoal/60">Cost (PKR)</label>
                  <input className="field" type="number" value={editing.cost || 0} onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })} />
                </div>
              </div>
              <input className="field" placeholder="Photo path (e.g. /drinks/spanish-latte.jpg)" value={editing.photo || ''} onChange={(e) => setEditing({ ...editing, photo: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-charcoal/60">Sort</label>
                  <input className="field" type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
                <label className="flex items-end gap-2 pb-3">
                  <input
                    type="checkbox"
                    checked={editing.active ?? true}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    className="w-5 h-5"
                  />
                  Active
                </label>
              </div>
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
