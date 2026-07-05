"use client";
import { useState } from "react";
import Link from "next/link";
import { useCart, Bottle } from "@/components/ui";
import { createGuestOrder } from "@/lib/actions";
import { euro, vatOf, withVat } from "@/lib/types";

export default function CheckoutPage() {
  const { lines, subtotal, setQty, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ orderNo: number; total: number } | null>(null);

  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const res = await createGuestOrder({
      email: f.get("email") as string,
      name: f.get("name") as string,
      phone: f.get("phone") as string,
      payment_method: "transfer",
      items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
    });
    setBusy(false);
    if (res.ok && res.orderNo) { const total = withVat(subtotal); clear(); setDone({ orderNo: res.orderNo, total }); }
    else setErr(res.error || "No se pudo procesar el pedido.");
  }

  if (done) return (
    <section className="page"><div className="wrap">
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="success">
          <div className="ring">✓</div>
          <h3>Pedido recibido — nº {done.orderNo}</h3>
          <p>Gracias por tu compra. Te hemos enviado la confirmación por correo.</p>
        </div>
        <div className="transfer-box">
          <div className="row"><span>Importe a transferir</span><b>{euro(done.total)}</b></div>
          <div className="row"><span>Beneficiario</span><b>Land of Nature</b></div>
          <div className="row"><span>IBAN</span><b>ES80 1583 0001 1693 7975 2362</b></div>
          <div className="row"><span>BIC</span><b>REVOESM2</b></div>
          <div className="row"><span>Concepto</span><b>Pedido {done.orderNo}</b></div>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12 }}>En cuanto se confirme el pago, preparamos tu envío. El pago con tarjeta se activará en breve.</p>
        <div style={{ marginTop: 18 }}><Link href="/#tienda" className="btn line">Seguir comprando</Link></div>
      </div>
    </div></section>
  );

  return (
    <section className="page"><div className="wrap">
      <h1>Tu cesta</h1>
      <p className="lead">Compra como invitado. No se crea ninguna cuenta ni se te pedirá crearla.</p>

      {lines.length === 0 ? (
        <div className="panel"><p style={{ margin: "0 0 16px" }}>Tu cesta está vacía.</p><Link href="/#tienda" className="btn cta">Ver productos</Link></div>
      ) : (
        <div className="two-col">
          <div>
            {lines.map((l) => (
              <div className="co-line" key={l.product_id}>
                <div className="th"><Bottle className="bottle" /></div>
                <div className="nm"><b>{l.name}</b><span>{l.brand} · {l.size}</span></div>
                <div className="qty">
                  <button aria-label="menos" onClick={() => setQty(l.product_id, l.qty - 1)}>−</button>
                  <span>{l.qty}</span>
                  <button aria-label="más" onClick={() => setQty(l.product_id, l.qty + 1)}>+</button>
                </div>
                <div className="lp">{euro(l.price * l.qty)}</div>
              </div>
            ))}
            <div className="co-sub"><span>Subtotal (sin IVA)</span><span>{euro(subtotal)}</span></div>
            <div className="co-sub"><span>IVA 21%</span><span>{euro(vatOf(subtotal))}</span></div>
            <div className="co-total"><span>Total</span><span>{euro(withVat(subtotal))}</span></div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Precios por caja. Venta solo por caja completa.</p>
          </div>

          <form className="panel" onSubmit={pay}>
            <h3 className="serif" style={{ margin: "0 0 14px", fontSize: 20 }}>Datos y pago</h3>
            <div className="field"><label>Correo (para el recibo) *</label><input name="email" type="email" required placeholder="tu@correo.com" /></div>
            <div className="field"><label>Nombre</label><input name="name" placeholder="Nombre y apellidos" /></div>
            <div className="field"><label>Teléfono</label><input name="phone" placeholder="+34 600 000 000" /></div>
            <div className="guestnote">🔒 <div><b>Compra como invitado.</b> No se crea ninguna cuenta.</div></div>
            {err && <p className="formerr">{err}</p>}
            <button className="btn cta full" disabled={busy}>{busy ? "Procesando…" : `Confirmar pedido · ${euro(withVat(subtotal))}`}</button>
            <p style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>Pago por transferencia. La tarjeta (Revolut/Stripe) se activa en breve.</p>
          </form>
        </div>
      )}
    </div></section>
  );
}
