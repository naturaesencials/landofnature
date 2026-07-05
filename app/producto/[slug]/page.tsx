import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Bottle } from "@/components/ui";
import ProductBuy from "@/components/ProductBuy";
import { euro, stockState, stockLabel, vatOf, withVat, type Product } from "@/lib/types";

export const revalidate = 0;

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("products").select("*").eq("slug", params.slug).eq("active", true).single();
  if (!data) notFound();
  const p = data as Product;
  const st = stockState(p);

  return (
    <section className="pdetail">
      <div className="wrap">
        <p style={{ marginBottom: 20 }}><Link href="/#tienda" className="eyebrow">← Volver a la tienda</Link></p>
        <div className="grid2">
          <div className="big">{p.image_url ? <img src={p.image_url} alt={p.name} className="pimg" /> : <Bottle className="bottle" />}</div>
          <div>
            <div className="cat">{p.brand}</div>
            <h1>{p.name}</h1>
            <div className="sku">SKU {p.sku} · {p.size} · <span className={`chip ${st}`} style={{ background: "transparent", padding: 0 }}><span className="d" />{stockLabel(p)}</span></div>
            {p.description && <p className="desc">{p.description}</p>}

            <div className="inci">
              <div className="h"><span>INCI · Composición</span>{!p.inci_verified && <span className="flag">pendiente de ficha técnica</span>}</div>
              <div className="list">{p.inci || "Composición no disponible."}</div>
            </div>

            <div className="buyblock">
              <div className="price">
                <div className="lab">Precio por caja · sin IVA</div>
                <div className="v">{euro(p.public_price)}</div>
                <div className="lab" style={{ marginTop: 4 }}>
                  + IVA {Math.round(p.vat_rate * 100)}% ({euro(vatOf(p.public_price, p.vat_rate))}) · <strong>{euro(withVat(p.public_price, p.vat_rate))}</strong> con IVA
                </div>
                {p.units_per_box ? <div className="lab" style={{ marginTop: 2, opacity: .8 }}>Caja de {p.units_per_box} uds · venta solo por caja</div> : null}
              </div>
            </div>
            <div style={{ marginTop: 16 }}><ProductBuy p={p} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
