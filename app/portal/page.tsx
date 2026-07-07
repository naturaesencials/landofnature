import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logout from "@/components/Logout";
import { euro, stockState, stockLabel, type Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Portal profesional",
  robots: { index: false, follow: false },
};

export const revalidate = 0;

export default async function Portal() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/acceso");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: prods } = await supabase.from("products").select("*").eq("active", true).order("stock", { ascending: false });
  const products = (prods ?? []) as Product[];

  const tariff = profile?.tariff_code as string | null | undefined;
  const priceMap = new Map<string, number>();
  if (tariff) {
    const { data: prices } = await supabase.from("product_tariff_prices").select("product_id,price").eq("tariff_code", tariff);
    (prices ?? []).forEach((r: { product_id: string; price: number }) => priceMap.set(r.product_id, r.price));
  }

  return (
    <section className="page"><div className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1>Portal profesional</h1>
          <p className="lead">{profile?.company ? `${profile.company} · ` : ""}{tariff ? <span className="tprice-badge">● Tu tarifa: {tariff}</span> : "Cuenta pendiente de asignar tarifa."}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/portal/domiciliacion" className="btn line">Domiciliación bancaria</Link>
          <Logout />
        </div>
      </div>

      {!profile && (
        <div className="panel"><p style={{ margin: 0 }}>Tu cuenta aún no está configurada. En cuanto el equipo la active y te asigne tarifa, verás aquí tus precios y el stock.</p></div>
      )}

      {profile && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--card)" }}>
          {products.map((p) => {
            const st = stockState(p);
            const price = priceMap.get(p.id);
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px 120px", gap: 16, alignItems: "center", padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
                <div>
                  <b style={{ fontFamily: "var(--font-serif)", fontSize: 16 }}>{p.name}</b>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{p.brand} · {p.size} · SKU {p.sku}</div>
                </div>
                <div><span className={`chip ${st}`}><span className="d" />{stockLabel(p)}</span></div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600 }}>{price != null ? euro(price) : "—"}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}> / caja · sin IVA</span></div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textDecoration: "line-through" }}>{euro(p.public_price)} PVP</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div></section>
  );
}
