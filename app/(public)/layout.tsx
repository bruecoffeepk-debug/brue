import Nav from '@/components/public/Nav';
import Footer from '@/components/public/Footer';
import WhatsAppFab from '@/components/public/WhatsAppFab';
import { ClosedShopModal } from '@/components/public/OpenStatus';
import WelcomeGate from '@/components/public/WelcomeGate';
import { ZoneProvider } from '@/lib/zone-context';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ZoneProvider>
      <Nav />
      <main>{children}</main>
      <Footer />
      <WhatsAppFab />
      <ClosedShopModal />
      <WelcomeGate />
    </ZoneProvider>
  );
}
