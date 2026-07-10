"use client";
import { useState } from "react";
import Link from "next/link";
import { confirmAccountRequest } from "@/lib/actions";

export default function VerificarClient({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const valid = token.length >= 10;

  async function confirm() {
    setState("busy");
    const res = await confirmAccountRequest(token);
    setState(res.ok ? "ok" : "err");
  }

  if (!valid || state === "err") return (
    <div className="acc-form"><div className="success">
      <div className="ring" style={{ background: "#C2452F" }}>!</div>
      <h3>Enlace no válido</h3>
      <p>Este enlace de confirmación no es válido o ya se ha utilizado. Si crees que es un error, vuelve a solicitar tu cuenta.</p>
      <p style={{ marginTop: 12 }}><Link href="/#cuenta" style={{ color: "var(--copper-d)", textDecoration: "underline" }}>Volver a solicitar tu cuenta →</Link></p>
    </div></div>
  );

  if (state === "ok") return (
    <div className="acc-form"><div className="success">
      <div className="ring">✓</div>
      <h3>Correo confirmado</h3>
      <p>¡Gracias! Hemos recibido tu solicitud de cuenta profesional. Nuestro equipo la revisará y te contactaremos para activarla y asignarte tu tarifa.</p>
      <p style={{ marginTop: 12 }}><Link href="/" style={{ color: "var(--copper-d)", textDecoration: "underline" }}>Volver a la tienda →</Link></p>
    </div></div>
  );

  return (
    <div className="acc-form">
      <p className="fsub">Pulsa el botón para confirmar tu correo y enviar tu solicitud a nuestro equipo.</p>
      <button className="btn cta full" style={{ marginTop: 8 }} disabled={state === "busy"} onClick={confirm}>
        {state === "busy" ? "Confirmando…" : "Confirmar mi solicitud"}
      </button>
    </div>
  );
}
