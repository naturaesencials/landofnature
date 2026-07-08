"use client";
import Link from "next/link";
import { CartCount } from "./ui";

export default function Header() {
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link className="brand" href="/">
          <img src="/mark.png" alt="Land of Nature" />
          <span className="brand-txt"><span className="bn">Land of Nature</span><i>Transformando Positivamente</i></span>
        </Link>
        <div className="htools">
          <Link className="pro-link" href="/contacto">Contacto</Link>
          <Link className="pro-link" href="/acceso">Acceso profesional</Link>
          <Link className="cart-btn" href="/checkout" aria-label="Cesta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 6h15l-1.5 9h-12z" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M6 6 5 3H2" /></svg>
            <CartCount />
          </Link>
        </div>
      </div>
    </header>
  );
}
