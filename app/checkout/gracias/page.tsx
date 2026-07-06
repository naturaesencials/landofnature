"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function GraciasPage() {
  const [orderNo, setOrderNo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      setOrderNo(p.get("order"));
      localStorage.removeItem("lon_cart_v1");
    } catch { /* noop */ }
  }, []);

  return (
    <section className="page"><div className="wrap">
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="success">
          <div className="ring">✓</div>
          <h3>¡Gracias por tu compra!{orderNo ? ` — pedido nº ${orderNo}` : ""}</h3>
          <p>Hemos recibido tu pago correctamente. Te enviaremos la confirmación por correo y prepararemos tu envío enseguida.</p>
        </div>
        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/#tienda" className="btn cta">Seguir comprando</Link>
          <Link href="/" className="btn line">Ir al inicio</Link>
        </div>
      </div>
    </div></section>
  );
}
