import type { Metadata } from "next";
import "./globals.css";
import { CartProvider, WhatsAppWidget } from "@/components/ui";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.landofnature.com"),
  title: {
    default: "Land of Nature — Cosmética y cuidado natural",
    template: "%s · Land of Nature",
  },
  description: "Cosmética y cuidado de origen natural. Compra como invitado o accede a tu tarifa profesional.",
  openGraph: {
    type: "website",
    siteName: "Land of Nature",
    locale: "es_ES",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Land of Nature" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Land of Nature — Cosmética y cuidado natural",
    description: "Cosmética y cuidado de origen natural.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <CartProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          <WhatsAppWidget />
          <CookieBanner />
        </CartProvider>
      </body>
    </html>
  );
}
