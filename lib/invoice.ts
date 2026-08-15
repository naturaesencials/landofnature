import { createServiceClient } from "./supabase/service";
import { generateInvoicePdf, type InvoicePdfLine } from "./invoice-pdf";

const VAT_RATE = 21;

/** Genera y emite la factura de un pedido: numeración legal, PDF, subida a storage y envío por email.
 *  Se llama justo tras crear el pedido ("al momento de la compra"). No lanza excepción hacia arriba:
 *  si algo falla, el pedido sigue existiendo igualmente y el fallo queda registrado en consola para
 *  que el admin pueda regenerar la factura manualmente. */
export async function generateInvoiceForOrder(orderId: string): Promise<{ ok: boolean; numero?: string; error?: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    console.error("generateInvoiceForOrder: falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
    return { ok: false, error: "missing_service_role_key" };
  }

  const { data: order, error: orderErr } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (orderErr || !order) return { ok: false, error: orderErr?.message || "Pedido no encontrado." };

  const { data: items, error: itemsErr } = await supabase.from("order_items").select("*").eq("order_id", orderId);
  if (itemsErr || !items?.length) return { ok: false, error: itemsErr?.message || "Pedido sin líneas." };

  const now = new Date(order.created_at || Date.now());
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const counterKey = `INV-${year}-${String(month).padStart(2, "0")}`;

  const { data: seq, error: seqErr } = await supabase.rpc("next_invoice_seq", { p_key: counterKey });
  if (seqErr) return { ok: false, error: seqErr.message };
  const numero = `INV/${year}/${String(month).padStart(2, "0")}/${String(seq).padStart(4, "0")}`;

  const lines: InvoicePdfLine[] = items.map((it) => {
    const lineSubtotal = it.unit_price * it.qty;
    return {
      description: `${it.name_snapshot}${it.size_snapshot ? ` (${it.size_snapshot})` : ""}`,
      quantity: it.qty, unit_price: it.unit_price, vat_rate: VAT_RATE, subtotal: lineSubtotal,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const vatAmount = Math.round(subtotal * (VAT_RATE / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  // partner (opcional, para enlazar con el directorio si ya existe una ficha con ese nombre/email)
  let partnerId: string | null = null;
  if (order.name) {
    const { data: p } = await supabase.from("partners").select("id").eq("kind", "cliente").ilike("name", order.name).limit(1).maybeSingle();
    partnerId = p?.id ?? null;
  }

  const { data: invoice, error: invErr } = await supabase.from("native_invoices").insert({
    numero, kind: "invoice", status: "issued", issue_date: now.toISOString(),
    order_id: orderId, partner_id: partnerId,
    customer_name: order.name || order.email, customer_cif: order.cif || null, customer_email: order.email,
    customer_address: order.address, customer_city: order.city, customer_postal_code: order.postal_code, customer_province: order.province,
    subtotal, vat_amount: vatAmount, total,
  }).select().single();
  if (invErr || !invoice) return { ok: false, error: invErr?.message || "No se pudo crear la factura." };

  await supabase.from("native_invoice_lines").insert(
    items.map((it, idx) => ({
      invoice_id: invoice.id, product_id: it.product_id,
      description: lines[idx].description, quantity: it.qty, unit_price: it.unit_price,
      vat_rate: VAT_RATE, subtotal: lines[idx].subtotal,
    }))
  );

  // PDF
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateInvoicePdf({
      numero, kind: "invoice", issue_date: now.toISOString(),
      customer_name: invoice.customer_name, customer_cif: invoice.customer_cif, customer_email: invoice.customer_email,
      customer_address: invoice.customer_address, customer_city: invoice.customer_city,
      customer_postal_code: invoice.customer_postal_code, customer_province: invoice.customer_province,
      lines, subtotal, vat_amount: vatAmount, total,
      payment_method: order.payment_method, order_no: order.order_no,
    });
  } catch (e) {
    console.error("generateInvoicePdf error", e);
  }

  let pdfPath: string | null = null;
  if (pdfBuffer) {
    pdfPath = `sale/${invoice.id}.pdf`;
    const { error: upErr } = await supabase.storage.from("invoices").upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (upErr) { console.error("storage upload error", upErr); pdfPath = null; }
    else await supabase.from("native_invoices").update({ pdf_path: pdfPath }).eq("id", invoice.id);
  }

  // Email
  if (pdfBuffer && order.email) {
    try {
      const { data: cfg } = await supabase.from("app_config").select("key,value").in("key", ["resend_api_key", "notify_from"]);
      const m = Object.fromEntries((cfg ?? []).map((c) => [c.key, c.value]));
      const RESEND = m["resend_api_key"];
      const FROM = m["notify_from"] || "Land of Nature <facturacion@landofnature.com>";
      if (RESEND) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM, to: order.email, subject: `Tu factura ${numero} — Land of Nature`,
            html: `<p>Hola ${order.name || ""},</p><p>Adjuntamos la factura de tu pedido #${order.order_no}.</p><p>Gracias por tu compra en Land of Nature.</p>`,
            attachments: [{ filename: `${numero.replace(/\//g, "-")}.pdf`, content: pdfBuffer.toString("base64") }],
          }),
        });
        if (r.ok) await supabase.from("native_invoices").update({ email_sent_at: new Date().toISOString() }).eq("id", invoice.id);
        else console.error("resend error", r.status, await r.text());
      }
    } catch (e) {
      console.error("email send error", e);
    }
  }

  return { ok: true, numero };
}
