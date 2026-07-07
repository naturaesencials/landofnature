"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

type St = { loading: boolean; loggedIn: boolean; agreement: boolean; mandate: string | null; status: string | null; msg: string; err: string; busy: boolean };

export default function DomiciliacionPage() {
  const [s, setS] = useState<St>({ loading: true, loggedIn: false, agreement: false, mandate: null, status: null, msg: "", err: "", busy: false });

  async function call(action: string) {
    const sb = createClient();
    const { data: sess } = await sb.auth.getSession();
    const token = sess.session?.access_token || "";
    const r = await fetch(`${SUPABASE_URL}/functions/v1/gocardless-mandate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ action }),
    });
    return r.json();
  }

  async function refresh(afterReturn: boolean) {
    const sb = createClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) { setS((x) => ({ ...x, loading: false, loggedIn: false })); return; }
    let msg = "";
    if (afterReturn) {
      const c = await call("complete");
      if (c.status === "active") msg = "¡Domiciliación configurada correctamente!";
      else if (c.pending) msg = c.message || "La autorización aún no se ha completado.";
      else if (c.error) msg = c.error;
    }
    const st = await call("status");
    setS((x) => ({ ...x, loading: false, loggedIn: true, agreement: !!st.commercial_agreement, mandate: st.mandate || null, status: st.mandate_status || null, msg }));
  }

  useEffect(() => {
    const estado = new URLSearchParams(window.location.search).get("estado");
    refresh(estado === "ok");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setS((x) => ({ ...x, busy: true, err: "" }));
    const d = await call("start");
    if (d.authorisation_url) { window.location.href = d.authorisation_url; return; }
    setS((x) => ({ ...x, busy: false, err: d.error || "No se pudo iniciar la domiciliación." }));
  }

  const active = s.status === "active" && s.mandate;

  return (
    <section className="page"><div className="wrap" style={{ maxWidth: 640 }}>
      <p style={{ marginBottom: 16 }}><Link href="/portal" className="eyebrow">← Volver al portal</Link></p>
      <h1>Domiciliación bancaria</h1>
      <p className="lead">Adeudo directo SEPA para clientes con acuerdo comercial. Autoriza una única vez el mandato y podrás pagar tus pedidos por domiciliación.</p>

      {s.loading ? <p>Cargando…</p> : !s.loggedIn ? (
        <div className="panel"><p>Inicia sesión para gestionar tu domiciliación.</p><Link href="/acceso" className="btn cta">Acceder</Link></div>
      ) : (
        <div className="panel">
          {s.msg && <p className="formok" style={{ color: "var(--olive)", fontWeight: 600 }}>{s.msg}</p>}
          {!s.agreement ? (
            <p>Tu cuenta todavía no tiene un <b>acuerdo comercial</b> activo con Land of Nature. Contacta con nosotros en <a href="mailto:info@landofnature.com">info@landofnature.com</a> para habilitar el pago por domiciliación.</p>
          ) : active ? (
            <>
              <p>✅ Tu domiciliación está <b>activa</b>. Ya puedes elegir «Domiciliación bancaria» al finalizar tus pedidos.</p>
              <p className="lab" style={{ marginTop: 8 }}>Mandato: {s.mandate}</p>
              <button className="btn line" disabled={s.busy} onClick={start} style={{ marginTop: 8 }}>Actualizar mandato</button>
            </>
          ) : (
            <>
              <p>Para pagar por domiciliación, autoriza el <b>mandato SEPA</b>. Te llevaremos a la pasarela segura de GoCardless para introducir los datos de tu cuenta bancaria.</p>
              {s.status && s.status !== "active" && <p className="lab">Estado actual del mandato: {s.status}</p>}
              <button className="btn cta" disabled={s.busy} onClick={start} style={{ marginTop: 10 }}>{s.busy ? "Redirigiendo…" : "Configurar domiciliación"}</button>
            </>
          )}
          {s.err && <p className="formerr">{s.err}</p>}
        </div>
      )}
    </div></section>
  );
}
