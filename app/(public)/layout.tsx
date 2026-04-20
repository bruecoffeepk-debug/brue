import Nav from '@/components/public/Nav';
import Footer from '@/components/public/Footer';
import WhatsAppFab from '@/components/public/WhatsAppFab';
import { ClosedShopModal } from '@/components/public/OpenStatus';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main>{children}</main>
      <Footer />
      <WhatsAppFab />
      <ClosedShopModal />
    </>
  );
}
