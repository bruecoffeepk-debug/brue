'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary !text-xs !py-2 !px-4">
      <Printer size={14} /> Print
    </button>
  );
}
