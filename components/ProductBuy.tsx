"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./ui";
import { stockState, type Product } from "@/lib/types";

export default function ProductBuy({ p }: { p: Product }) {
  const { add } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const out = stockState(p) === "out";
  return (
    <div className="buyrow" style={{ gap: 10 }}>
      <div className="qty" style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 3 }}>
        <button aria-label="menos" onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 44, border: 0, background: "transparent", fontSize: 17, cursor: "pointer" }}>−</button>
        <span style={{ width: 34, textAlign: "center", fontFamily: "var(--font-mono)" }}>{qty}</span>
        <button aria-label="más" onClick={() => setQty(q => q + 1)} style={{ width: 36, height: 44, border: 0, background: "transparent", fontSize: 17, cursor: "pointer" }}>+</button>
      </div>
      <button className="btn line" disabled={out} onClick={() => add(p, qty)}>Añadir a la cesta</button>
      <button className="btn cta" disabled={out} onClick={() => { add(p, qty); router.push("/checkout"); }}>{out ? "No disponible" : "Comprar"}</button>
    </div>
  );
}
