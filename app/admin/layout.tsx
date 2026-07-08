import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administración",
  description: "Panel de administración de Land of Nature. Acceso restringido.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
