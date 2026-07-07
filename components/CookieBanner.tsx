"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "lon_cookie_consent_v1";

export default function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true); } catch { /* ignore */ }
  }, []);
  const decide = (value: "accepted" | "rejected") => {
    try { localStorage.setItem(KEY, value); } catch { /* ignore */ }
    setShow(false);
  };
  if (!show) return null;
  return (
    <div className="cookie-banner" role="dialog" aria-label="Aviso de cookies">
      <p>
        Usamos únicamente <strong>cookies técnicas necesarias</strong> para el funcionamiento del sitio (sesión, seguridad y cesta de la compra). No utilizamos cookies de análisis ni de publicidad.{" "}
        <Link href="/privacidad#cookies">Más información</Link>.
      </p>
      <div className="cb-actions">
        <button className="cb-rej" onClick={() => decide("rejected")}>Rechazar</button>
        <button className="cb-acc" onClick={() => decide("accepted")}>Aceptar</button>
      </div>
    </div>
  );
}
