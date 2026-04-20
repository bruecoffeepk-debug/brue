import PosNav from '@/components/pos/PosNav';

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand">
      <PosNav />
      <div className="md:pl-64">
        <main className="p-5 md:p-8 max-w-[1600px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
