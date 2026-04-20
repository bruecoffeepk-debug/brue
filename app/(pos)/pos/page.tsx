'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, Trash2, User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  CATEGORIES,
  DRINK_PHOTO,
  PAYMENT_METHODS,
  ORDER_TYPES,
  pkr,
  type CartLine,
  type Customer,
  type MenuItem,
} from '@/lib/utils';

export default function PosPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [cat, setCat] = useState<string>('All');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<(typeof ORDER_TYPES)[number]>('Pickup');
  const [payment, setPayment] = useState<string>('Cash');
  const [notes, setNotes] = useState('');
  const [showCustomers, setShowCustomers] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: c }] = await Promise.all([
        supabase.from('menu_items').select('*').eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('customers').select('*').order('name', { ascending: true }),
      ]);
      setItems((m as MenuItem[]) || []);
      setCustomers((c as Customer[]) || []);
      setLoaded(true);
    })();
  }, [supabase]);

  const customer = customers.find((c) => c.id === customerId) || null;
  const discountPct = customer?.discount_percent ?? 0;

  const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const discount = Math.round((subtotal * discountPct) / 100);
  const total = subtotal - discount;

  const filtered = useMemo(() => {
    let out = items;
    if (cat !== 'All') out = out.filter((i) => i.category === cat);
    if (q.trim()) {
      const n = q.toLowerCase();
      out = out.filter((i) => i.name.toLowerCase().includes(n));
    }
    return out;
  }, [items, cat, q]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const ex = prev.find((l) => l.id === item.id);
      if (ex) return prev.map((l) => (l.id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          cost: item.cost,
          quantity: 1,
          photo: item.photo ?? DRINK_PHOTO[item.name] ?? null,
        },
      ];
    });
  };

  const updateQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev.map((l) => (l.id === id ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0)
    );

  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.id !== id));

  const placeOrder = async () => {
    if (cart.length === 0 || busy) return;
    setBusy(true);
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          customer_id: customerId,
          customer_name: customer?.name ?? null,
          customer_phone: customer?.phone ?? null,
          order_type: orderType.toLowerCase(),
          payment_method: payment,
          subtotal,
          discount,
          total,
          notes: notes || null,
          status: 'completed',
          channel: 'pos',
        })
        .select('id')
        .single();
      if (error) throw error;

      const rows = cart.map((l) => ({
        order_id: order.id,
        menu_item_id: l.id,
        name: l.name,
        price: l.price,
        cost: l.cost,
        quantity: l.quantity,
        line_total: l.price * l.quantity,
      }));
      await supabase.from('order_items').insert(rows);

      router.push(`/receipt/${order.id}`);
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  };

  const cats = ['All', ...CATEGORIES];

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-6">
      {/* Catalog */}
      <div>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="h-display text-4xl">Order Terminal</h1>
            <p className="text-charcoal/60 text-sm">Tap items to add — checkout is on the right.</p>
          </div>
          <div className="relative w-64">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40" />
            <input
              className="field pl-10 !py-2 !text-sm"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto -mx-1 px-1">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip ${cat === c ? 'active' : ''}`}>
              {c}
            </button>
          ))}
        </div>

        {!loaded ? (
          <div className="py-16 text-center text-charcoal/40">Loading menu…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-charcoal/60">
            No menu items. Run <code className="bg-cream px-2 py-1 rounded">supabase/schema.sql</code> first.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => {
              const photo = item.photo ?? DRINK_PHOTO[item.name] ?? null;
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-cream rounded-2xl border-[1.5px] border-charcoal/10 overflow-hidden text-left hover:border-terracotta hover:shadow-lg transition active:scale-95"
                >
                  <div className="aspect-square bg-deep-sand relative overflow-hidden">
                    {photo ? (
                      <Image src={photo} alt={item.name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image src="/Brue_DP_Orange.png" alt="" width={80} height={26} className="opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="h-display text-lg leading-tight line-clamp-2">{item.name}</p>
                    <p className="text-terracotta font-semibold text-sm mt-1">{pkr(item.price)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <aside className="bg-cream rounded-3xl border-[1.5px] border-charcoal/10 p-5 lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="h-display text-2xl">Cart</h2>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-charcoal/60 hover:text-terracotta uppercase tracking-widest"
            >
              Clear
            </button>
          )}
        </div>

        {/* Customer */}
        <button
          onClick={() => setShowCustomers(true)}
          className="w-full flex items-center justify-between bg-deep-sand rounded-2xl px-4 py-3 mb-3 hover:bg-deep-sand/70 transition"
        >
          <div className="flex items-center gap-3">
            <User size={18} className="text-terracotta" />
            <div className="text-left">
              <p className="text-xs uppercase tracking-widest text-charcoal/50">Customer</p>
              <p className="font-semibold text-sm">
                {customer ? customer.name : 'Walk-in'}
                {discountPct > 0 && (
                  <span className="ml-2 text-sage">−{discountPct}%</span>
                )}
              </p>
            </div>
          </div>
          <span className="text-xs uppercase text-charcoal/50">change</span>
        </button>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {cart.length === 0 ? (
            <div className="py-12 text-center text-charcoal/40 text-sm">Tap an item to add.</div>
          ) : (
            <ul className="space-y-2">
              {cart.map((l) => (
                <li key={l.id} className="flex items-center gap-3 bg-sand rounded-2xl p-2 pr-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-deep-sand shrink-0">
                    {l.photo ? <Image src={l.photo} alt={l.name} width={80} height={80} className="object-cover w-full h-full" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="h-display text-base leading-tight truncate">{l.name}</p>
                    <p className="text-xs text-charcoal/60">{pkr(l.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(l.id, -1)} className="w-7 h-7 rounded-full bg-cream border border-charcoal/15 flex items-center justify-center">
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{l.quantity}</span>
                    <button onClick={() => updateQty(l.id, 1)} className="w-7 h-7 rounded-full bg-charcoal text-cream flex items-center justify-center">
                      <Plus size={12} />
                    </button>
                  </div>
                  <button onClick={() => removeLine(l.id)} className="text-charcoal/40 hover:text-terracotta ml-1">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Order options */}
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-charcoal/50 mb-2">Order type</p>
            <div className="flex gap-2">
              {ORDER_TYPES.map((t) => (
                <button key={t} onClick={() => setOrderType(t)} className={`chip flex-1 justify-center ${orderType === t ? 'active' : ''}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-charcoal/50 mb-2">Payment</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPayment(p)}
                  className={`text-xs px-2 py-2 rounded-xl border-[1.5px] transition ${
                    payment === p
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'border-charcoal/15 hover:border-charcoal/40'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <input
            className="field !py-2 !text-sm"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Totals */}
        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-charcoal/60">Subtotal</span><span>{pkr(subtotal)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-sage">
              <span>Discount ({discountPct}%)</span><span>−{pkr(discount)}</span>
            </div>
          )}
          <div className="dotted-rule my-2 text-charcoal" />
          <div className="flex justify-between items-end">
            <span className="text-charcoal/60 uppercase tracking-widest text-xs">Total</span>
            <span className="h-display text-3xl text-terracotta">{pkr(total)}</span>
          </div>
        </div>

        <button
          onClick={placeOrder}
          disabled={cart.length === 0 || busy}
          className="btn-primary w-full justify-center mt-4 disabled:opacity-50"
        >
          {busy ? 'Placing…' : 'Place Order & Print'}
        </button>
      </aside>

      {/* Customer picker modal */}
      {showCustomers && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm flex items-center justify-center z-50 p-5" onClick={(e) => e.currentTarget === e.target && setShowCustomers(false)}>
          <div className="bg-cream rounded-3xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="h-display text-2xl">Pick customer</h3>
              <button onClick={() => setShowCustomers(false)}><X size={18} /></button>
            </div>
            <button
              onClick={() => { setCustomerId(null); setShowCustomers(false); }}
              className="w-full text-left p-3 rounded-2xl hover:bg-sand mb-2"
            >
              <p className="font-semibold">Walk-in</p>
              <p className="text-xs text-charcoal/50">No discount</p>
            </button>
            <div className="max-h-80 overflow-y-auto divide-y divide-charcoal/5">
              {customers.length === 0 && (
                <p className="py-6 text-center text-charcoal/50 text-sm">
                  No customers yet. Add one in <a href="/customers" className="underline">Customers</a>.
                </p>
              )}
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCustomerId(c.id); setShowCustomers(false); }}
                  className="w-full text-left p-3 hover:bg-sand rounded-xl"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-charcoal/50">{c.phone || '—'}</p>
                    </div>
                    {c.discount_percent > 0 && (
                      <span className="sticker !text-[10px] !py-1 text-sage border-sage">−{c.discount_percent}%</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
