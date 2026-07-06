import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductCard, AccountForm } from "@/components/ui";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: "Land of Nature — Cosmética y cuidado natural artesanal" },
  description: "Cosmética, higiene y detergencia de origen natural: Ubuntu, Uniku, Muntu, Shikoba y Hoop Natural. Compra como invitado sin cuenta o accede a tu tarifa profesional.",
  alternates: { canonical: "https://www.landofnature.com/" },
  openGraph: {
    title: "Land of Nature — Cosmética y cuidado natural artesanal",
    description: "Cosmética, higiene y detergencia de origen natural. Compra como invitado o accede a tu tarifa profesional.",
    url: "https://www.landofnature.com/",
  },
};

export const revalidate = 0;

export default async function Home() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  const products = (data ?? []) as Product[];

  const FAMILIES = ["Cosmética", "Detergencia", "Cuidado Animal"] as const;
  const SUBORDER: Record<string, string[]> = {
    "Cosmética": ["Cabello", "Piel"],
    "Detergencia": ["Textil", "Vajilla", "Limpieza"],
    "Cuidado Animal": ["Perro", "Gato", "Higiene"],
  };
  const FID: Record<string, string> = {
    "Cosmética": "cosmetica", "Detergencia": "detergencia", "Cuidado Animal": "cuidado-animal",
  };
  const byFam = (fam: string) => {
    const items = products.filter((p) => (p.family || "Otros") === fam);
    const subs = SUBORDER[fam] ?? [];
    const extra = [...new Set(items.map((p) => p.category))].filter((c) => !subs.includes(c));
    return [...subs, ...extra]
      .map((sc) => ({ sc, list: items.filter((p) => p.category === sc) }))
      .filter((g) => g.list.length > 0);
  };

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">Cosmética y cuidado de origen natural</div>
          <h1>Naturaleza artesanal, <em>directa</em> a tu cesta.</h1>
          <p>Compra al momento y como invitado, sin cuenta. ¿Eres profesional? Entra a tu tarifa.</p>
          <div className="hero-cta">
            <a href="#tienda" className="btn pale">Ver productos ↓</a>
            <Link href="/acceso" className="btn ghost">Soy profesional</Link>
          </div>
        </div>
      </section>

      <section className="store" id="tienda">
        <div className="wrap">
          <div className="store-head">
            <h2>Productos</h2>
            <span className="note">Precio público · compra como invitado</span>
          </div>
          <p className="store-sub">Toca un producto para ver su composición (INCI). Compra en un clic; el pago es con tarjeta o transferencia y no se crea ninguna cuenta.</p>

          <nav className="catnav" aria-label="Categorías">
            {FAMILIES.map((f) => <a key={f} href={`#${FID[f]}`} className="catchip">{f}</a>)}
          </nav>

          {FAMILIES.map((fam) => {
            const groups = byFam(fam);
            if (groups.length === 0) return null;
            return (
              <div className="family" id={FID[fam]} key={fam}>
                <h3 className="family-title">{fam}</h3>
                {groups.map(({ sc, list }) => (
                  <div className="subcat" key={sc}>
                    <h4 className="subcat-title">{sc}</h4>
                    <div className="grid">
                      {list.map((p) => <ProductCard key={p.id} p={p} />)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className="account" id="cuenta">
        <div className="wrap">
          <div className="acc-intro">
            <div className="eyebrow">Cuenta profesional</div>
            <h2>¿Quieres crear tu cuenta?</h2>
            <p>Si eres distribuidor, tienda o profesional, solicita tu cuenta. Es un proceso aparte de la compra pública: revisamos tus datos y te asignamos tu tarifa antes de activarla.</p>
            <ol className="acc-steps">
              <li><span>1</span><div><b>Solicitas tu cuenta</b><small>Con tus datos fiscales y de negocio.</small></div></li>
              <li><span>2</span><div><b>Revisamos y aprobamos</b><small>Te asignamos tu tarifa: A, B, C o D.</small></div></li>
              <li><span>3</span><div><b>Compras a tu precio</b><small>Con tu tarifa y el stock real a la vista.</small></div></li>
            </ol>
            <p className="acc-login">¿Ya tienes cuenta? <Link href="/acceso">Accede al portal →</Link></p>
          </div>
          <AccountForm />
        </div>
      </section>
    </>
  );
}
