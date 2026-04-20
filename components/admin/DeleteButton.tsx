'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteDrink } from '@/app/(admin)/admin/drinks/actions';

export default function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    start(async () => {
      try {
        await deleteDrink(id);
      } catch (e: any) {
        alert('Could not delete: ' + (e?.message ?? 'unknown error'));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Delete ${name}`}
      className="inline-flex items-center justify-center rounded-full p-2 transition-colors"
      style={{
        border: '1px solid var(--line-strong)',
        color: 'var(--terra)',
        opacity: pending ? 0.5 : 1,
      }}
    >
      <Trash2 size={13} />
    </button>
  );
}
