'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-primary btn-sm"
      aria-label="Save as PDF"
    >
      <Printer size={12} /> Save as PDF
    </button>
  );
}
