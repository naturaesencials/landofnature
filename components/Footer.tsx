import Link from "next/link";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <img src="/logo-cream.png" alt="Land of Nature — Innovando Naturalmente" />
        <div className="fmeta">
          <div className="fl">
            <Link href="/#cuenta">Crear cuenta</Link>
            <Link href="/acceso">Acceso profesional</Link>
            <Link href="/checkout">Cesta</Link>
          </div>
          <small>© 2026 Land of Nature · Origen natural</small>
        </div>
      </div>
    </footer>
  );
}
