import Link from "next/link";
import { ContactForm } from "@/components/ui";

export const metadata = {
  title: "Contacto",
  description: "Contacta con Land of Nature: dudas sobre productos, composición (INCI), pedidos o alta como cliente profesional.",
  alternates: { canonical: "https://www.landofnature.com/contacto" },
};

export default function ContactoPage() {
  return (
    <section className="account">
      <div className="wrap">
        <div className="acc-intro">
          <p className="eyebrow">Contacto</p>
          <h1>¿Hablamos? Contacta con Land of Nature</h1>
          <p>Estamos aquí para ayudarte con productos, composición (INCI), pedidos o el alta como profesional. Escríbenos y te respondemos lo antes posible.</p>
          <ul className="acc-steps">
            <li><span>@</span><div><b>Correo</b><small>Rellena el formulario y te contestamos por correo.</small></div></li>
            <li><span>◱</span><div><b>Profesionales</b><small>¿Quieres tarifa y stock en vivo? <Link href="/#cuenta" style={{ color: "var(--copper-d)", textDecoration: "underline" }}>Solicita tu cuenta</Link>.</small></div></li>
            <li><span>♦</span><div><b>Pedidos</b><small>Para dudas de un pedido, indícanos el número en el mensaje.</small></div></li>
          </ul>
          <p className="acc-login">¿Ya eres cliente? <Link href="/acceso">Accede al portal profesional</Link>.</p>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
