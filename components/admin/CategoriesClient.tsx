'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, X } from 'lucide-react';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/app/(admin)/admin/categories/actions';
import type { Category } from '@/lib/utils';

type CatRow = Category & { count: number };

export default function CategoriesClient({ categories }: { categories: CatRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function refresh() {
    router.refresh();
  }

  function onCreate(fd: FormData) {
    start(async () => {
      try {
        await createCategory(fd);
        setCreating(false);
        refresh();
      } catch (e: any) {
        alert(e?.message ?? 'Could not create');
      }
    });
  }

  function onUpdate(id: string, fd: FormData) {
    start(async () => {
      try {
        await updateCategory(id, fd);
        setEditing(null);
        refresh();
      } catch (e: any) {
        alert(e?.message ?? 'Could not update');
      }
    });
  }

  function onDelete(c: CatRow) {
    if (c.count > 0) {
      if (!confirm(`"${c.name}" has ${c.count} drink(s). They'll keep working but lose their category. Continue?`))
        return;
    } else if (!confirm(`Delete "${c.name}"?`)) return;
    start(async () => {
      try {
        await deleteCategory(c.id);
        refresh();
      } catch (e: any) {
        alert(e?.message ?? 'Could not delete');
      }
    });
  }

  return (
    <div className="px-10 py-12 max-w-[1100px]">
      <header className="flex items-end justify-between gap-6 mb-10 flex-wrap">
        <div>
          <span className="eyebrow">Menu structure · {categories.length} categories</span>
          <h1 className="display mt-3" style={{ fontSize: 'clamp(2.4rem, 4.4vw, 4rem)' }}>
            <span className="ital">Categories</span>.
          </h1>
          <p className="mt-2" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            Group drinks into sections like Coffee, Frappés, or Sweets. Reorder with the sort
            number — lower numbers show first.
          </p>
        </div>
        <button onClick={() => setCreating((v) => !v)} className="btn btn-primary">
          {creating ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New category</>}
        </button>
      </header>

      {creating && (
        <form
          action={onCreate}
          className="mb-6 grid grid-cols-1 md:grid-cols-[1.5fr_80px_120px_auto] gap-3 items-end px-5 py-5 rounded-xl"
          style={{ background: 'var(--paper)', border: '1px dashed var(--line-strong)' }}
        >
          <div className="field-group">
            <label htmlFor="new-name">Name</label>
            <input id="new-name" name="name" required className="input" placeholder="e.g. Sweets" />
          </div>
          <div className="field-group">
            <label htmlFor="new-emoji">Emoji</label>
            <input id="new-emoji" name="emoji" className="input" placeholder="🍰" maxLength={4} />
          </div>
          <div className="field-group">
            <label htmlFor="new-sort">Sort order</label>
            <input id="new-sort" name="sort_order" type="number" defaultValue={100} className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary">
            <Save size={14} /> Create
          </button>
        </form>
      )}

      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <div
          className="grid items-center px-5 py-3"
          style={{
            gridTemplateColumns: '60px 2fr 1fr 100px 110px 140px',
            gap: 16,
            borderBottom: '1px solid var(--line-strong)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          <span>Emoji</span>
          <span>Name</span>
          <span>Slug</span>
          <span>Drinks</span>
          <span>Sort</span>
          <span />
        </div>

        {categories.length === 0 && (
          <div className="px-5 py-12 text-center" style={{ color: 'var(--ink-muted)' }}>
            No categories yet. Click &quot;New category&quot; above.
          </div>
        )}

        {categories.map((c) =>
          editing === c.id ? (
            <form
              key={c.id}
              action={(fd) => onUpdate(c.id, fd)}
              className="grid items-center px-5 py-3"
              style={{
                gridTemplateColumns: '60px 2fr 1fr 100px 110px 140px',
                gap: 16,
                borderBottom: '1px solid var(--line)',
                background: 'rgba(196,69,38,0.04)',
              }}
            >
              <input
                name="emoji"
                defaultValue={c.emoji ?? ''}
                className="input"
                style={{ padding: '8px 10px' }}
                maxLength={4}
              />
              <input
                name="name"
                defaultValue={c.name}
                className="input"
                style={{ padding: '8px 10px' }}
                required
              />
              <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>auto from name</span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{c.count}</span>
              <input
                name="sort_order"
                type="number"
                defaultValue={c.sort_order}
                className="input"
                style={{ padding: '8px 10px' }}
              />
              <input type="hidden" name="active" value="true" />
              <div className="flex items-center gap-1 justify-end">
                <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
                  <Save size={12} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="btn btn-outline btn-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div
              key={c.id}
              className="grid items-center px-5 py-3"
              style={{
                gridTemplateColumns: '60px 2fr 1fr 100px 110px 140px',
                gap: 16,
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span
                className="serif"
                style={{ fontSize: 22, color: c.emoji ? 'var(--ink)' : 'var(--ink-muted)' }}
              >
                {c.emoji || '·'}
              </span>
              <button
                type="button"
                onClick={() => setEditing(c.id)}
                className="serif text-left"
                style={{ fontSize: 18, letterSpacing: '-0.01em' }}
              >
                {c.name}
              </button>
              <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{c.slug}</span>
              <span className="serif" style={{ fontSize: 16, color: 'var(--ink-soft)' }}>
                {c.count}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{c.sort_order}</span>
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => setEditing(c.id)}
                  className="px-3 py-1.5 text-xs rounded-full"
                  style={{ border: '1px solid var(--line-strong)', color: 'var(--ink-soft)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(c)}
                  disabled={pending}
                  aria-label={`Delete ${c.name}`}
                  className="inline-flex items-center justify-center rounded-full p-2"
                  style={{
                    border: '1px solid var(--line-strong)',
                    color: 'var(--terra)',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
