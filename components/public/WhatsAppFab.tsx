'use client';

import { MessageCircle } from 'lucide-react';

export default function WhatsAppFab() {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  if (!number) return null;
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 px-5 py-3 rounded-full transition-all hover:-translate-y-0.5"
      style={{
        background: 'var(--ink)',
        color: 'var(--bone)',
        boxShadow: '0 16px 36px -12px rgba(28,23,18,0.45)',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '0.04em',
      }}
    >
      <MessageCircle size={16} style={{ color: 'var(--mustard)' }} />
      WhatsApp
    </a>
  );
}
