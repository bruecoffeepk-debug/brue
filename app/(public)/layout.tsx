import Nav from '@/components/public/Nav';
import Footer from '@/components/public/Footer';
import WhatsAppFab from '@/components/public/WhatsAppFab';
import { ClosedShopModal } from '@/components/public/OpenStatus';
import WelcomeGate from '@/components/public/WelcomeGate';
import { ZoneProvider } from '@/lib/zone-context';
import { CartProvider } from '@/lib/cart-context';
import PublicShell from '@/components/public/PublicShell';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ZoneProvider>
      <CartProvider>
        <Nav />
        <main>{children}</main>
        <Footer />
        <WhatsAppFab />
        <ClosedShopModal />
        <WelcomeGate />
        {/* Mounts the global cart UI: drink detail modal, checkout drawer,
            floating "open cart" pill. Lives at the layout level so any
            public page can open the modal / drawer via cart-context. */}
        <PublicShell />
      </CartProvider>
    </ZoneProvider>
  );
}
