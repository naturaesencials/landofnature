import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { Bottle } from "@/components/ui";
import ProductBuy from "@/components/ProductBuy";
import { euro, stockState, stockLabel, boxLabel, vatOf, withVat, type Product } from "@/lib/types";

export const revalidate = 0;

const SITE = "https://www.landofnature.com";

function shortSize(s: string | null | undefined): string {
  if (!s) return "";
  const m = s.match(/(\d[\d.,]*\s?(?:mL|ml|L|g|kg))/);
  if (m) return m[1].replace(/\s?ml/i, " mL").replace(/\s+/g, " ").trim();
  return s.replace(/^Caja\s*/i, "").trim();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sb = createPublicClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await sb
    .from("products")
    .select("brand,name,size,category,family,description,image_url,slug")
    .eq("slug", params.slug)
    .eq("active", true)
    .single();
  if (!data) return { title: "Producto no encontrado", robots: { index: false, follow: true } };
  const p = data as {
    brand: string; name: string; size: string; category: string;
    family: string; description: string | null; image_url: string | null; slug: string;
  };
  const url = `${SITE}/producto/${p.slug}`;
  const sz = shortSize(p.size);
  const title = `${p.brand} ${p.name}${sz ? " " + sz : ""}`.replace(/\s+/g, " ").trim();
  const raw = (p.description || `${p.brand} ${p.name}, ${p.category} de origen natural.`).replace(/\s+/g, " ").trim();
  const clip = raw.length > 150 ? raw.slice(0, 150).replace(/[\s,;.]+\S*$/, "") + "…" : raw;
  const description = `${clip} · Formato ${p.size}.`.slice(0, 300);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · Land of Nature`,
      description,
      url,
      type: "website",
      images: p.image_url ? [{ url: p.image_url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("products").select("*").eq("slug", params.slug).eq("active", true).single();
  if (!data) notFound();
  const p = data as Product;
  const st = stockState(p);
  const unpriced = !p.public_price || p.public_price <= 0;

  return (
    <section className="pdetail">
      <div className="wrap">
        <p style={{ marginBottom: 20 }}><Link href="/#tienda" className="eyebrow">← Volver a la tienda</Link></p>
        <div className="grid2">
          <div className="big">{p.image_url ? <img src={p.image_url} alt={p.name} className="pimg" /> : <Bottle className="bottle" />}</div>
          <div>
            <div className="cat">{p.family ? `${p.family} · ` : ""}{p.category}</div>
            <h1>{p.brand} {p.name}</h1>
            <div className="fmt-badge fmt-lg" aria-label={boxLabel(p)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></svg>
              <span>{boxLabel(p)}</span>
            </div>
            <div className="sku">SKU {p.sku} · {p.size} · <span className={`chip ${st}`} style={{ background: "transparent", padding: 0 }}><span className="d" />{stockLabel(p)}</span></div>
            <p className="pintro">{p.brand} {p.name} — {p.category} de origen natural{p.family ? ` · ${p.family}` : ""}. Disponible en formato {p.size}.</p>
            {p.description && <p className="desc">{p.description}</p>}

            <div className="inci">
              <div className="h"><span>INCI · Composición</span>{!p.inci_verified && <span className="flag">pendiente de ficha técnica</span>}</div>
              <div className="list">{p.inci || "Composición no disponible."}</div>
            </div>

            <div className="buyblock">
              {unpriced ? (
                <div className="price">
                  <div className="lab">Precio</div>
                  <div className="v" style={{ color: "var(--muted)" }}>Próximamente</div>
                  <div className="lab" style={{ marginTop: 4, opacity: .8 }}>Producto en catálogo · precio por confirmar</div>
                </div>
              ) : (
                <div className="price">
                  <div className="lab">Precio por caja · sin IVA</div>
                  <div className="v">{euro(p.public_price)}</div>
                  <div className="lab" style={{ marginTop: 4 }}>
                    + IVA {Math.round(p.vat_rate * 100)}% ({euro(vatOf(p.public_price, p.vat_rate))}) · <strong>{euro(withVat(p.public_price, p.vat_rate))}</strong> con IVA
                  </div>
                  {p.units_per_box ? <div className="lab" style={{ marginTop: 2, opacity: .8 }}>{boxLabel(p)} · venta solo por caja</div> : null}
                </div>
              )}
            </div>
            {unpriced
              ? <div style={{ marginTop: 16, fontSize: 13.5, color: "var(--muted)", maxWidth: 420 }}>Este producto estará disponible próximamente. Estamos actualizando su precio y disponibilidad.</div>
              : <div style={{ marginTop: 16 }}><ProductBuy p={p} /></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
