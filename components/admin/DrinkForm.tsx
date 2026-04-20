'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ImageUpload from './ImageUpload';
import { createDrink, updateDrink } from '@/app/(admin)/admin/drinks/actions';
import type { Category, MenuItem } from '@/lib/utils';
import { Save, ArrowLeft } from 'lucide-react';

type Mode = 'new' | 'edit';

export default function DrinkForm({
  mode,
  categories,
  drink,
}: {
  mode: Mode;
  categories: Category[];
  drink?: MenuItem | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // controlled photo URL so user can paste a path AND upload swaps it
  const [photo, setPhoto] = useState<string>(drink?.photo ?? '');
  const [categoryId, setCategoryId] = useState<string>(drink?.category_id ?? categories[0]?.id ?? '');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    // The hidden ImageUpload field writes to "photo_uploaded" — prefer that, else use the text input "photo".
    const uploaded = String(fd.get('photo_uploaded') ?? '');
    const typed = String(fd.get('photo') ?? '');
    fd.set('photo', uploaded || typed || '');
    // attach category name (text col, for POS compat)
    const cat = categories.find((c) => c.id === fd.get('category_id'));
    fd.set('category_name', cat?.name ?? '');

    start(async () => {
      try {
        if (mode === 'new') {
          await createDrink(fd);
        } else if (drink) {
          await updateDrink(drink.id, fd);
          router.refresh();
        }
      } catch (e: any) {
        setErr(e?.message ?? 'Something went wrong');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-12 grid-cols-1 lg:grid-cols-[280px_1fr]">
      <div>
        <label className="eyebrow block mb-3">Photo</label>
        <ImageUpload name="photo_uploaded" defaultUrl={photo} />
      </div>

      <div className="space-y-5">
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          <div className="field-group md:col-span-2">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              required
              defaultValue={drink?.name ?? ''}
              className="input"
              placeholder="e.g. Spanish Latte"
            />
          </div>

          <div className="field-group md:col-span-2">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              defaultValue={drink?.description ?? ''}
              className="textarea"
              placeholder="Espresso, condensed milk, a single ice clink."
            />
          </div>

          <div className="field-group">
            <label htmlFor="category_id">Category</label>
            <select
              id="category_id"
              name="category_id"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="select"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? c.emoji + '  ' : ''}{c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="sort_order">Sort order</label>
            <input
              id="sort_order"
              name="sort_order"
              type="number"
              defaultValue={drink?.sort_order ?? 100}
              className="input"
            />
          </div>

          <div className="field-group">
            <label htmlFor="price">Price (PKR)</label>
            <input
              id="price"
              name="price"
              type="number"
              required
              min="0"
              defaultValue={drink?.price ?? ''}
              className="input"
              placeholder="650"
            />
          </div>

          <div className="field-group">
            <label htmlFor="cost">Cost (PKR)</label>
            <input
              id="cost"
              name="cost"
              type="number"
              min="0"
              defaultValue={drink?.cost ?? 0}
              className="input"
              placeholder="260"
            />
          </div>

          <div className="field-group md:col-span-2">
            <label htmlFor="photo">Photo URL <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-muted)' }}>(optional, overridden by upload)</span></label>
            <input
              id="photo"
              name="photo"
              type="text"
              defaultValue={photo}
              onChange={(e) => setPhoto(e.target.value)}
              className="input"
              placeholder="/drinks/spanish-latte.jpg or https://…"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-8 pt-2">
            <Toggle name="in_stock" defaultChecked={drink?.in_stock ?? true} label="In stock" />
            <Toggle name="active" defaultChecked={drink?.active ?? true} label="Show on public menu" />
          </div>
        </div>

        {err && (
          <div
            className="px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(196,69,38,0.08)',
              color: 'var(--terra-deep)',
              border: '1px solid rgba(196,69,38,0.2)',
            }}
          >
            {err}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary"
            style={{ opacity: pending ? 0.6 : 1 }}
          >
            <Save size={14} /> {pending ? 'Saving…' : mode === 'new' ? 'Create drink' : 'Save changes'}
          </button>
          <Link href="/admin/drinks" className="btn btn-outline">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>
    </form>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  const [on, setOn] = useState(defaultChecked);
  // Two inputs: a hidden "false" baseline + the real checkbox emitting "on" when checked.
  // FormData ends up with the LAST value if both share a name, which is "on" when checked.
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input type="hidden" name={name} value="false" />
      <input
        type="checkbox"
        name={name}
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="sr-only"
      />
      <span
        className="relative block transition-colors"
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: on ? 'var(--sage)' : 'rgba(28,23,18,0.18)',
        }}
      >
        <span
          className="absolute top-0.5 transition-all"
          style={{
            left: on ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: 'var(--bone)',
            boxShadow: '0 2px 4px rgba(28,23,18,0.2)',
          }}
        />
      </span>
      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{label}</span>
    </label>
  );
}
