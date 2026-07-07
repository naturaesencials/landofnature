"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart, Bottle } from "@/components/ui";
import { createGuestOrder } from "@/lib/actions";
import { euro, vatOf, withVat } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { RevolutCheckout?: any } }

type Method = "revolut" | "revolut_pay" | "transfer" | "gocardless";

function loadRevolut(env: string): Promise<any> {
  const src = env === "production"
    ? "https://merchant.revolut.com/embed.js"
    : "https://sandbox-merchant.revolut.com/embed.js";
  return new Promise((resolve, reject) => {
    if (window.RevolutCheckout) return resolve(window.RevolutCheckout);
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => window.RevolutCheckout ? resolve(window.RevolutCheckout) : reject(new Error("SDK"));
    s.onerror = () => reject(new Error("No se pudo cargar el pago"));
    document.head.appendChild(s);
  });
}

async function createRevolutOrder(orderNo: number) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/revolut-create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ order_no: orderNo }),
  });
  return r.json();
}

export default function CheckoutPage() {
  const { lines, subtotal, setQty, clear } = useCart();
  const [method, setMethod] = useState<Method>("revolut");
  const [allowTransfer, setAllowTransfer] = useState(false);
  const [canDD, setCanDD] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ orderNo: number; total: number } | null>(null);
  const [ddDone, setDdDone] = useState<{ orderNo: number; total: number } | null>(null);
  const [paid, setPaid] = useState<{ orderNo: number; total: number } | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await sb.from("profiles").select("allow_transfer, commercial_agreement, gc_mandate_status").eq("id", data.user.id).maybeSingle();
      if (p?.allow_transfer) setAllowTransfer(true);
      if (p?.commercial_agreement && p?.gc_mandate_status === "active") setCanDD(true);
    }).catch(() => {});
  }, []);

  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const f = new FormData(e.currentTarget);
    const email = f.get("email") as string;
    const name = f.get("name") as string;
    const phone = f.get("phone") as string;
    const address = f.get("address") as string;
    const postal_code = f.get("postal_code") as string;
    const city = f.get("city") as string;
    const province = f.get("province") as string;
    const country = ((f.get("country") as string) || "España").trim();
    const total = withVat(subtotal);
    setBusy(true);

    const res = await createGuestOrder({
      email, name, phone, address, postal_code, city, province, country,
      payment_method: method,
      items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
    });
    if (!res.ok || !res.orderNo) { setBusy(false); setErr(res.error || "No se pudo crear el pedido."); return; }
    const orderNo = res.orderNo;

    // Transferencia: mostramos los datos bancarios
    if (method === "transfer") { setBusy(false); clear(); setDone({ orderNo, total }); return; }

    // Domiciliación bancaria (GoCardless)
    if (method === "gocardless") {
      try {
        const { data: sess } = await createClient().auth.getSession();
        const token = sess.session?.access_token || "";
        const r = await fetch(`${SUPABASE_URL}/functions/v1/gocardless-charge`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_ANON_KEY },
          body: JSON.stringify({ order_no: orderNo }),
        });
        const d = await r.json();
        if (!r.ok || d.error) { setBusy(false); setErr(d.error || "No se pudo iniciar la domiciliación."); return; }
        setBusy(false); clear(); setDdDone({ orderNo, total }); return;
      } catch { setBusy(false); setErr("No se pudo iniciar la domiciliación."); return; }
    }

    // Tarjeta / Revolut Pay: creamos el pedido en Revolut
    try {
      const data = await createRevolutOrder(orderNo);
      if (data.error || (!data.token && !data.checkout_url)) { setBusy(false); setErr("No se pudo iniciar el pago con tarjeta."); return; }

      if (method === "revolut_pay") {
        if (data.checkout_url) { window.location.href = data.checkout_url; return; }
        setBusy(false); setErr("No se pudo abrir Revolut Pay."); return;
      }

      // Tarjeta: widget on-site
      const RC = await loadRevolut(data.env);
      const instance = await RC(data.token, { locale: "es" });
      setBusy(false);
      instance.payWithPopup({
        savePaymentMethodForMerchant: false,
        onSuccess() { clear(); setPaid({ orderNo, total }); },
        onError() { setErr("El pago no se completó. Puedes intentarlo de nuevo."); },
        onCancel() { setErr("Pago cancelado."); },
      });
    } catch {
      setBusy(false); setErr("No se pudo iniciar el pago con tarjeta.");
    }
  }

  if (paid) return (
    <section className="page"><div className="wrap">
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="success">
          <div className="ring">✓</div>
          <h3>Pago recibido — pedido nº {paid.orderNo}</h3>
          <p>Gracias por tu compra. Hemos recibido tu pago de <b>{euro(paid.total)}</b> y te hemos enviado la confirmación por correo. Estamos preparando tu envío.</p>
        </div>
        <div style={{ marginTop: 18 }}><Link href="/#tienda" className="btn line">Seguir comprando</Link></div>
      </div>
    </div></section>
  );

  if (ddDone) return (
    <section className="page"><div className="wrap">
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="success">
          <div className="ring">✓</div>
          <h3>Pedido registrado — nº {ddDone.orderNo}</h3>
          <p>Tu pedido de <b>{euro(ddDone.total)}</b> se cobrará por <b>domiciliación bancaria</b> en la cuenta asociada a tu mandato SEPA. Recibirás la confirmación por correo cuando se complete el cargo, y prepararemos tu envío.</p>
        </div>
        <div style={{ marginTop: 18 }}><Link href="/#tienda" className="btn line">Seguir comprando</Link></div>
      </div>
    </div></section>
  );

  if (done) return (
    <section className="page"><div className="wrap">
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="success">
          <div className="ring">✓</div>
          <h3>Pedido recibido — nº {done.orderNo}</h3>
          <p>Gracias por tu compra. Realiza la transferencia con estos datos y prepararemos tu envío en cuanto se confirme el pago.</p>
        </div>
        <div className="transfer-box">
          <div className="row"><span>Importe a transferir</span><b>{euro(done.total)}</b></div>
          <div className="row"><span>Beneficiario</span><b>Land of Nature</b></div>
          <div className="row"><span>IBAN</span><b>ES80 1583 0001 1693 7975 2362</b></div>
          <div className="row"><span>BIC</span><b>REVOESM2</b></div>
          <div className="row"><span>Concepto</span><b>Pedido {done.orderNo}</b></div>
        </div>
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
            <h3 className="serif" style={{ margin: "0 0 4px", fontSize: 20 }}>Datos de envío</h3>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted)" }}>Todos los campos son obligatorios para poder enviarte el pedido.</p>
            <div className="field"><label>Nombre y apellidos *</label><input name="name" required placeholder="Nombre y apellidos" /></div>
            <div className="field"><label>Dirección completa (calle, número, piso, puerta) *</label><input name="address" required placeholder="Calle, número, piso, puerta" /></div>
            <div className="field2">
              <div className="field"><label>Código postal *</label><input name="postal_code" required inputMode="numeric" placeholder="29670" /></div>
              <div className="field"><label>Población *</label><input name="city" required placeholder="Ciudad / población" /></div>
            </div>
            <div className="field2">
              <div className="field"><label>Provincia *</label><input name="province" required placeholder="Provincia" /></div>
              <div className="field"><label>País *</label><input name="country" required defaultValue="España" /></div>
            </div>
            <div className="field2">
              <div className="field"><label>Correo electrónico *</label><input name="email" type="email" required placeholder="tu@correo.com" /></div>
              <div className="field"><label>Teléfono móvil *</label><input name="phone" type="tel" required inputMode="tel" placeholder="+34 600 000 000" /></div>
            </div>

            <div className="paylabel">Método de pago</div>
            <div className="payopts">
              <label className={`payopt ${method === "revolut" ? "on" : ""}`}>
                <input type="radio" name="pm" checked={method === "revolut"} onChange={() => setMethod("revolut")} />
                <span className="po-t">Tarjeta</span>
                <span className="po-s">Visa · Mastercard · Apple&nbsp;Pay · Google&nbsp;Pay</span>
              </label>
              <label className={`payopt ${method === "revolut_pay" ? "on" : ""}`}>
                <input type="radio" name="pm" checked={method === "revolut_pay"} onChange={() => setMethod("revolut_pay")} />
                <span className="po-t">Revolut Pay</span>
                <span className="po-s">Paga con tu cuenta Revolut</span>
              </label>
              {allowTransfer && (
                <label className={`payopt ${method === "transfer" ? "on" : ""}`}>
                  <input type="radio" name="pm" checked={method === "transfer"} onChange={() => setMethod("transfer")} />
                  <span className="po-t">Transferencia bancaria</span>
                  <span className="po-s">Te damos el IBAN al confirmar</span>
                </label>
              )}
              {canDD && (
                <label className={`payopt ${method === "gocardless" ? "on" : ""}`}>
                  <input type="radio" name="pm" checked={method === "gocardless"} onChange={() => setMethod("gocardless")} />
                  <span className="po-t">Domiciliación bancaria</span>
                  <span className="po-s">Adeudo directo SEPA · acuerdo comercial</span>
                </label>
              )}
            </div>

            <div className="guestnote">🔒 <div><b>Pago seguro.</b> Los pagos con tarjeta se procesan por Revolut con 3D Secure. No se crea ninguna cuenta.</div></div>
            {err && <p className="formerr">{err}</p>}
            <button className="btn cta full" disabled={busy}>
              {busy ? "Procesando…" : (method === "transfer" || method === "gocardless") ? `Confirmar pedido · ${euro(withVat(subtotal))}` : `Pagar ${euro(withVat(subtotal))}`}
            </button>
          </form>
        </div>
      )}
    </div></section>
  );
}
