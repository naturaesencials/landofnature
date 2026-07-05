"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Acceso() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: (f.get("email") as string).trim(),
      password: f.get("password") as string,
    });
    setBusy(false);
    if (error) { setErr("Correo o contraseña incorrectos."); return; }
    router.push("/portal"); router.refresh();
  }
  return (
    <section className="page"><div className="wrap">
      <h1>Portal profesional</h1>
      <p className="lead">Acceso restringido a clientes autorizados. Proceso independiente de la tienda pública.</p>
      <form className="panel" onSubmit={login}>
        <div className="field"><label>Correo de empresa</label><input name="email" type="email" required placeholder="pedidos@tunegocio.com" /></div>
        <div className="field"><label>Contraseña</label><input name="password" type="password" required placeholder="••••••••" /></div>
        {err && <p className="formerr">{err}</p>}
        <button className="btn cta full" disabled={busy}>{busy ? "Entrando…" : "Entrar al portal"}</button>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 16 }}>¿Aún no eres cliente? <Link href="/#cuenta" style={{ color: "var(--copper-d)", textDecoration: "underline" }}>Crear cuenta</Link></p>
      </form>
    </div></section>
  );
}
