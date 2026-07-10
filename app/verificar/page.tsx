import type { Metadata } from "next";
import VerificarClient from "./VerificarClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirmar solicitud · Land of Nature",
  robots: { index: false, follow: false },
};

export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <section className="page"><div className="wrap">
      <h1>Confirmar solicitud de cuenta</h1>
      <VerificarClient token={(searchParams.token || "").trim()} />
    </div></section>
  );
}
