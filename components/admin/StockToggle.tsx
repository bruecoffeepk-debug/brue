'use client';

import { useTransition, useState } from 'react';
import { toggleStock } from '@/app/(admin)/admin/drinks/actions';

export default function StockToggle({ id, initial }: { id: string; initial: boolean }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();

  function flip() {
    const next = !value;
    setValue(next); // optimistic
    start(async () => {
      try {
        await toggleStock(id, next);
      } catch (e) {
        setValue(!next); // rollback
        alert('Could not update stock — try again.');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-pressed={value}
      disabled={pending}
      className="inline-flex items-center gap-2 transition-opacity"
      style={{ opacity: pending ? 0.5 : 1, cursor: 'pointer' }}
    >
      <span
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 999,
          background: value ? 'var(--sage)' : 'rgba(28,23,18,0.18)',
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: 'var(--bone)',
            boxShadow: '0 2px 4px rgba(28,23,18,0.2)',
            transition: 'left 0.2s',
          }}
        />
      </span>
      <span style={{ fontSize: 12, color: value ? 'var(--ink-soft)' : 'var(--terra)', fontWeight: 500 }}>
        {value ? 'In stock' : 'Sold out'}
      </span>
    </button>
  );
}
