import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso profesional",
  description: "Acceso restringido a clientes autorizados de Land of Nature.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.landofnature.com/acceso" },
};

export default function AccesoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
