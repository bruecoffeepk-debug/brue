import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { pkr } from '@/lib/utils';
import PrintButton from './print-button';

export const dynamic = 'force-dynamic';

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: order } = await supabase.from('orders').select('*').eq('id', params.id).single();
  if (!order) notFound();
  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', params.id);

  const date = new Date(order.created_at);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center">
      <div className="w-full max-w-md flex justify-between items-center mb-6 print:hidden">
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-charcoal/60 hover:text-terracotta">
          <ArrowLeft size={14} /> Back
        </Link>
        <PrintButton />
      </div>

      <div className="receipt">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <Image src="/Brue.png" alt="BRUE" width={120} height={36} style={{ height: 30, width: 'auto', display: 'inline-block' }} />
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, marginBottom: 4 }}>Cold · Coffee · Juices</p>
        <p style={{ textAlign: 'center', fontSize: 10 }}>Karachi, Pakistan</p>
        <hr />
        <div className="row"><span>Order</span><span>#{order.order_number}</span></div>
        <div className="row"><span>Date</span><span>{date.toLocaleDateString('en-PK')}</span></div>
        <div className="row"><span>Time</span><span>{date.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}</span></div>
        <div className="row"><span>Type</span><span style={{ textTransform: 'capitalize' }}>{order.order_type}</span></div>
        <div className="row"><span>Pay</span><span>{order.payment_method}</span></div>
        {order.customer_name && (
          <div className="row"><span>For</span><span>{order.customer_name}</span></div>
        )}
        <hr />
        {(items || []).map((it: any) => (
          <div key={it.id} style={{ marginBottom: 4 }}>
            <div className="row">
              <span>{it.quantity}× {it.name}</span>
              <span>{pkr(it.line_total)}</span>
            </div>
          </div>
        ))}
        <hr />
        <div className="row"><span>Subtotal</span><span>{pkr(order.subtotal)}</span></div>
        {order.discount > 0 && (
          <div className="row"><span>Discount</span><span>−{pkr(order.discount)}</span></div>
        )}
        <div className="row" style={{ fontSize: 16, fontWeight: 'bold', marginTop: 6 }}>
          <span>TOTAL</span><span>{pkr(order.total)}</span>
        </div>
        <hr />
        <p style={{ textAlign: 'center', fontSize: 11, marginTop: 8 }}>Made in Karachi.</p>
        <p style={{ textAlign: 'center', fontSize: 11 }}>Made for Karachi.</p>
        <p style={{ textAlign: 'center', fontSize: 10, marginTop: 8 }}>@bruecoffeepk</p>
      </div>

      <p className="mt-6 text-xs text-charcoal/40 print:hidden">Tap print, or Ctrl/Cmd + P</p>
    </div>
  );
}
