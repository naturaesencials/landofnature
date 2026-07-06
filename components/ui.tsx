"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { euro, stockState, stockLabel, boxLabel, type Product } from "@/lib/types";
import { submitAccountRequest, submitContactMessage, subscribeStock } from "@/lib/actions";

/* ---------------- Carrito ---------------- */
export type CartLine = { product_id: string; slug: string; name: string; brand: string; size: string | null; price: number; qty: number };
type CartCtx = {
  lines: CartLine[]; count: number; subtotal: number;
  add: (p: Product, qty?: number) => void; setQty: (id: string, qty: number) => void;
  remove: (id: string) => void; clear: () => void;
};
const Ctx = createContext<CartCtx | null>(null);
const KEY = "lon_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => { try { const r = localStorage.getItem(KEY); if (r) setLines(JSON.parse(r)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {} }, [lines]);
  const add = useCallback((p: Product, qty = 1) => setLines(prev => {
    const i = prev.findIndex(l => l.product_id === p.id);
    if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qty: c[i].qty + qty }; return c; }
    return [...prev, { product_id: p.id, slug: p.slug, name: p.name, brand: p.brand, size: p.size, price: p.public_price, qty }];
  }), []);
  const setQty = useCallback((id: string, qty: number) => setLines(prev => qty <= 0 ? prev.filter(l => l.product_id !== id) : prev.map(l => l.product_id === id ? { ...l, qty } : l)), []);
  const remove = useCallback((id: string) => setLines(prev => prev.filter(l => l.product_id !== id)), []);
  const clear = useCallback(() => setLines([]), []);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.qty * l.price, 0);
  return <Ctx.Provider value={{ lines, count, subtotal, add, setQty, remove, clear }}>{children}</Ctx.Provider>;
}
export const useCart = () => { const c = useContext(Ctx); if (!c) throw new Error("useCart fuera de CartProvider"); return c; };

/* ---------------- Botella (placeholder de imagen) ---------------- */
export function Bottle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 100" fill="none" className={className} aria-hidden>
      <rect x="18" y="6" width="24" height="10" rx="2" fill="currentColor" />
      <path d="M14 20h32v66a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V20z" fill="currentColor" opacity=".92" />
      <rect x="20" y="42" width="20" height="26" rx="2" fill="#FCF8F0" />
    </svg>
  );
}

/* ---------------- Contador del carrito (cabecera) ---------------- */
export function CartCount() {
  const { count } = useCart();
  if (!count) return null;
  return <span style={{ position: "absolute", top: -7, right: -7, background: "var(--copper)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 11, minWidth: 19, height: 19, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{count}</span>;
}

/* ---------------- Tarjeta de producto ---------------- */
export function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  const router = useRouter();
  const st = stockState(p);
  const out = st === "out";
  return (
    <article className="pcard">
      <Link href={`/producto/${p.slug}`} className="art" aria-label={`${p.brand} ${p.name} · ${p.size}`}>
        <span className="tag">{p.category}</span>
        <span className={`chip ${st} stockpill`}><span className="d" />{stockLabel(p)}</span>
        {p.image_url ? <img src={p.image_url} alt={`${p.brand} ${p.name} · ${p.size}`} className="pimg" loading="lazy" /> : <Bottle className="bottle" />}
      </Link>
      <div className="pbody">
        <div className="cat">{p.brand} · {p.size}</div>
        <Link href={`/producto/${p.slug}`} aria-label={`${p.brand} ${p.name} · ${p.size}`}><h4>{p.brand} {p.name}</h4></Link>
        <div className="fmt-badge" aria-label={boxLabel(p)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></svg>
          <span>{boxLabel(p)}</span>
        </div>
        <Link href={`/producto/${p.slug}`} className="info" aria-label={`Ver composición INCI de ${p.brand} ${p.name} · ${p.size}`}>Ver composición (INCI)</Link>
        <div className="pfoot">
          <div className="price"><div className="lab">Precio caja · sin IVA</div><div className="v">{euro(p.public_price)}</div><div className="lab" style={{ marginTop: 2, opacity: .8 }}>+ IVA 21%</div></div>
          {!out && (
            <div className="buyrow">
              <button className="icon-add" aria-label="Añadir" onClick={() => add(p, 1)}>+</button>
              <button className="buy1" onClick={() => { add(p, 1); router.push("/checkout"); }}>Comprar</button>
            </div>
          )}
        </div>
        {out && <div className="notify-wrap"><NotifyStock productId={p.id} compact /></div>}
      </div>
    </article>
  );
}

/* ---------------- Widget WhatsApp ---------------- */
const WA_NUMBER = "34600000000"; // provisional — sustituir por el número real del asistente
export function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const go = (msg: string) => window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  return (
    <>
      {open && (
        <div className="wa-panel">
          <div className="wa-top">
            <div className="wa-av"><WaIcon /></div>
            <div><b>Asistente Land of Nature</b><span><i className="wa-on" />Por WhatsApp · responde al momento</span></div>
          </div>
          <div className="wa-body">
            <div className="wa-msg"><small>Asistente</small>Hola 👋 Puedo ayudarte con stock, pedidos y dudas de producto. ¿Qué necesitas?</div>
            <div className="wa-quick">
              <button onClick={() => go("Hola, ¿tenéis stock de un producto?")}>¿Tenéis stock de un producto?</button>
              <button onClick={() => go("Quiero info de un producto y su INCI")}>Info y composición (INCI)</button>
              <button onClick={() => go("¿Cómo me doy de alta como profesional?")}>Darme de alta como profesional</button>
              <button onClick={() => go("Estado de mi pedido")}>Estado de mi pedido</button>
            </div>
          </div>
          <div className="wa-foot">
            <button className="btn full" style={{ background: "var(--wa)", borderColor: "var(--wa)", color: "#fff" }} onClick={() => go("Hola, quiero hacer una consulta")}>Abrir en WhatsApp</button>
            <small>Conversación gestionada por el asistente virtual Albion.</small>
          </div>
        </div>
      )}
      <button className="wa-launch" aria-label="Asistente de WhatsApp" onClick={() => setOpen(o => !o)}><WaIcon /></button>
    </>
  );
}
function WaIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M12 2a10 10 0 0 0-8.7 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11.5 11.5 0 0 1-4.6-4c-.3-.5-1.2-1.7-1.2-3.2s.8-2.3 1.1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c0 .2.1.4 0 .6l-.5.6c-.2.2-.3.4-.1.7.7 1.2 1.5 1.9 2.7 2.5.3.1.5.1.7-.1l.7-.8c.2-.2.4-.2.6-.1l2 1c.3.1.4.2.5.3.1.3.1.7-.1 1.4z" /></svg>;
}

/* ---------------- Formulario crear cuenta ---------------- */
export function AccountForm() {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const f = new FormData(e.currentTarget);
    if (!(f.get("priv") as string)) { setErr("Marca la casilla de privacidad."); return; }
    setBusy(true);
    const res = await submitAccountRequest({
      contact_name: f.get("contact_name") as string, company: f.get("company") as string,
      cif: f.get("cif") as string, business_type: f.get("business_type") as string,
      email: f.get("email") as string, phone: f.get("phone") as string, message: f.get("message") as string,
    });
    setBusy(false);
    if (res.ok) setSent(true); else setErr(res.error || "Error al enviar.");
  }
  if (sent) return (
    <div className="acc-form"><div className="success">
      <div className="ring">✓</div><h3>Solicitud enviada</h3>
      <p>Gracias. Revisaremos tus datos y te contactaremos para activar tu cuenta y asignarte tu tarifa.</p>
    </div></div>
  );
  return (
    <form className="acc-form" onSubmit={onSubmit}>
      <h3>Solicita tu cuenta</h3>
      <p className="fsub">Rellena tus datos y te contactamos para activarla.</p>
      <div className="frow">
        <div className="field"><label>Nombre de contacto *</label><input name="contact_name" required placeholder="Nombre y apellidos" /></div>
        <div className="field"><label>Empresa / razón social *</label><input name="company" required placeholder="Tu empresa" /></div>
      </div>
      <div className="frow">
        <div className="field"><label>CIF / NIF *</label><input name="cif" required placeholder="B12345678" /></div>
        <div className="field"><label>Tipo de negocio</label>
          <select name="business_type" defaultValue="Distribuidor">
            <option>Distribuidor</option><option>Tienda / retail</option><option>Profesional / salón</option><option>Hostelería</option><option>Otro</option>
          </select>
        </div>
      </div>
      <div className="frow">
        <div className="field"><label>Correo *</label><input name="email" type="email" required placeholder="pedidos@tunegocio.com" /></div>
        <div className="field"><label>Teléfono *</label><input name="phone" required placeholder="+34 600 000 000" /></div>
      </div>
      <div className="field"><label>Mensaje (opcional)</label><textarea name="message" placeholder="Cuéntanos sobre tu negocio o qué productos te interesan." /></div>
      <label className="acc-check"><input type="checkbox" name="priv" value="1" /> Acepto la política de privacidad y el tratamiento de mis datos para gestionar mi solicitud.</label>
      {err && <p className="formerr">{err}</p>}
      <button className="btn cta full" style={{ marginTop: 8 }} disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}</button>
      <p className="acc-note">🔒 Tu solicitud se revisa antes de activar la cuenta. No se crea ninguna cuenta hasta la aprobación.</p>
    </form>
  );
}

/* ---------------- Formulario de contacto ---------------- */
export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const f = new FormData(e.currentTarget);
    if (!(f.get("priv") as string)) { setErr("Marca la casilla de privacidad."); return; }
    setBusy(true);
    const res = await submitContactMessage({
      name: f.get("name") as string, email: f.get("email") as string,
      phone: f.get("phone") as string, subject: f.get("subject") as string,
      message: f.get("message") as string,
    });
    setBusy(false);
    if (res.ok) setSent(true); else setErr(res.error || "Error al enviar.");
  }
  if (sent) return (
    <div className="acc-form"><div className="success">
      <div className="ring">✓</div><h3>Mensaje enviado</h3>
      <p>Gracias por escribirnos. Te responderemos lo antes posible.</p>
    </div></div>
  );
  return (
    <form className="acc-form" onSubmit={onSubmit}>
      <h3>Escríbenos</h3>
      <p className="fsub">¿Dudas sobre un producto, un pedido o tu cuenta? Cuéntanos.</p>
      <div className="frow">
        <div className="field"><label>Nombre</label><input name="name" placeholder="Nombre y apellidos" /></div>
        <div className="field"><label>Correo *</label><input name="email" type="email" required placeholder="tu@correo.com" /></div>
      </div>
      <div className="frow">
        <div className="field"><label>Teléfono</label><input name="phone" placeholder="+34 600 000 000" /></div>
        <div className="field"><label>Asunto</label><input name="subject" placeholder="Motivo de tu consulta" /></div>
      </div>
      <div className="field"><label>Mensaje *</label><textarea name="message" required placeholder="Escribe aquí tu consulta." /></div>
      <label className="acc-check"><input type="checkbox" name="priv" value="1" /> Acepto la política de privacidad y el tratamiento de mis datos para gestionar mi consulta.</label>
      {err && <p className="formerr">{err}</p>}
      <button className="btn cta full" style={{ marginTop: 8 }} disabled={busy}>{busy ? "Enviando…" : "Enviar mensaje"}</button>
      <p className="acc-note">🔒 Tus datos se usan solo para responder a tu consulta.</p>
    </form>
  );
}

/* ---------- Aviso de reposición (avísame cuando vuelva) ---------- */
export function NotifyStock({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  async function submit() {
    if (!email.trim() || !email.includes("@")) { setState("err"); return; }
    setState("busy");
    const r = await subscribeStock({ product_id: productId, email });
    setState(r.ok ? "done" : "err");
  }
  if (state === "done") return <p className="notify-done">✓ Te avisaremos por correo cuando vuelva.</p>;
  if (!open) return (
    <button type="button" className={compact ? "buy1 notify-open" : "btn cta"} onClick={() => setOpen(true)}>
      Avísame cuando vuelva
    </button>
  );
  return (
    <div className="notify">
      <input type="email" inputMode="email" placeholder="tu@correo.com" value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === "err") setState("idle"); }}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }} aria-label="Tu correo" />
      <button type="button" className="btn cta" disabled={state === "busy"} onClick={submit}>
        {state === "busy" ? "…" : "Avisar"}
      </button>
      {state === "err" && <span className="notify-err">Revisa el correo.</span>}
    </div>
  );
}
