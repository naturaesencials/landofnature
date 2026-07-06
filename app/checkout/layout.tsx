import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tu cesta",
  description: "Finaliza tu compra como invitado en Land of Nature.",
  robots: { index: false, follow: true },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
