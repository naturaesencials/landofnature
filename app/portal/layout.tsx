import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal profesional",
  description: "Área privada de clientes profesionales de Land of Nature: tarifa, stock y pedidos.",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
