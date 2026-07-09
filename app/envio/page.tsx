import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones de preparación y envío",
  description: "Plazos de preparación (72 h), envío a Punto de Recogida InPost para pedidos individuales y entrega a domicilio acordada para pedidos grandes o de gran volumen (más de 20 cajas o palets).",
};

export default function Page() {
  return (
    <section className="page"><div className="wrap">
      <p style={{ marginBottom: 18 }}><a href="/" className="eyebrow">← Volver a la tienda</a></p>
      <h1>Términos y condiciones de preparación y envío</h1>
      <p className="lead">Última actualización: julio de 2026</p>
      <div className="legal">
        <h2>1. Preparación del pedido</h2>
        <p>Los pedidos se preparan en un plazo de <strong>72 horas</strong> desde la confirmación del pago. En periodos de alta demanda, festivos o por causas ajenas a Land of Nature, este plazo podrá ampliarse; en tal caso se informará al cliente.</p>

        <h2>2. Envíos individuales — Punto de Recogida InPost</h2>
        <p>Los pedidos individuales se envían a un <strong>Punto de Recogida (Punto Pack o Locker) de InPost</strong>, asignado en función de la dirección facilitada por el cliente. El destinatario recibirá una notificación cuando su pedido esté disponible y dispondrá del plazo indicado por el transportista para recogerlo. <strong>No se realizan entregas en domicilio</strong> para este tipo de envíos.</p>

        <h2>3. Pedidos grandes o de gran volumen</h2>
        <p>Cuando el pedido es grande o de gran volumen —<strong>múltiples cajas (más de 20 cajas) o palets</strong>—, el envío se <strong>acuerda directamente con el cliente para la entrega en su domicilio</strong>. En estos casos, la modalidad de transporte, el plazo de entrega y el coste se pactan según el volumen, el peso y el destino del pedido, y pueden diferir de las tarifas estándar mostradas en la tienda.</p>

        <h2>4. Gastos de envío</h2>
        <p>Los gastos de envío se calculan en función del <strong>peso del pedido</strong> conforme a las tarifas del transportista y se muestran antes de finalizar la compra, añadiéndose al importe del pedido. En los pedidos grandes o de gran volumen, los gastos de envío se comunicarán al cliente al acordar la entrega.</p>

        <h2>5. Envíos no retirados</h2>
        <p>Si el destinatario no recoge el envío en el plazo indicado por el transportista, el pedido será devuelto a Land of Nature. Los gastos de un nuevo envío correrán por cuenta del cliente.</p>

        <p style={{ marginTop: 24, fontSize: 13.5, color: "var(--muted)" }}>Estos términos de preparación y envío complementan los <a href="/terminos">Términos y Condiciones de venta</a> de Land of Nature, S.L.</p>
      </div>
    </div></section>
  );
}
