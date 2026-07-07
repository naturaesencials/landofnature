import Link from "next/link";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="fbrand">
          <img src="/brand-cream.png" alt="Land of Nature" />
          <span><b>Land of Nature</b><i>Transformando Positivamente</i></span>
        </div>
        <div className="fmeta">
          <div className="fl">
            <Link href="/#cuenta">Crear cuenta</Link>
            <Link href="/acceso">Acceso profesional</Link>
            <Link href="/contacto">Contacto</Link>
            <Link href="/checkout">Cesta</Link>
          </div>
          <div className="fl fl-legal">
            <Link href="/terminos">Términos y condiciones</Link>
            <Link href="/privacidad">Aviso legal y privacidad</Link>
            <Link href="/privacidad#cookies">Cookies</Link>
          </div>
          <small>© 2026 Land of Nature · Origen natural · CIF B05422639</small>
        </div>
      </div>
    </footer>
  );
}
