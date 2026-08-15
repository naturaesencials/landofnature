"use server";

import { createClient } from "./supabase/server";
import { generateInvoiceForOrder } from "./invoice";

export type ActionResult = { ok: boolean; error?: string; orderNo?: number };

export async function submitAccountRequest(form: {
  contact_name: string; company: string; cif: string; business_type?: string;
  email: string; phone: string; message?: string; website?: string; turnstileToken?: string;
}): Promise<ActionResult> {
  const required = ["contact_name", "company", "cif", "email", "phone"] as const;
  for (const k of required) {
    if (!form[k] || !String(form[k]).trim()) return { ok: false, error: "Faltan datos obligatorios." };
  }
  // La solicitud entra por la edge function, que valida honeypot + Turnstile,
  // la registra como "sin verificar" y envía el correo de confirmación.
  // No llega al panel de admin hasta que el solicitante confirma su correo.
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("account-submit", {
    body: {
      contact_name: form.contact_name.trim(),
      company: form.company.trim(),
      cif: form.cif.trim(),
      business_type: form.business_type || null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      message: form.message?.trim() || null,
      website: form.website || "",
      turnstileToken: form.turnstileToken || "",
    },
  });
  if (error) return { ok: false, error: "No se pudo enviar la solicitud. Inténtalo de nuevo." };
  if (data && data.ok === false) return { ok: false, error: data.error || "No se pudo enviar la solicitud." };
  return { ok: true };
}

export async function confirmAccountRequest(token: string): Promise<{ ok: boolean }> {
  if (!token || token.trim().length < 10) return { ok: false };
  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_account_request", { p_token: token.trim() });
  if (error) return { ok: false };
  return { ok: data === "ok" };
}

export async function subscribeStock(input: { product_id: string; email: string }): Promise<ActionResult> {
  if (!input.email || !input.email.trim()) return { ok: false, error: "Introduce tu correo." };
  const supabase = createClient();
  const { error } = await supabase.from("stock_notifications").insert({
    product_id: input.product_id, email: input.email.trim().toLowerCase(),
  });
  if (error && !/duplicate|unique|conflict/i.test(error.message)) {
    return { ok: false, error: "No se pudo registrar el aviso. Inténtalo de nuevo." };
  }
  return { ok: true }; // duplicado = ya estaba suscrito, lo tratamos como éxito
}

export async function submitContactMessage(form: {
  name?: string; email: string; phone?: string; subject?: string; message: string;
  website?: string; turnstileToken?: string;
}): Promise<ActionResult> {
  if (!form.email || !String(form.email).trim()) return { ok: false, error: "El correo es obligatorio." };
  if (!form.message || !String(form.message).trim()) return { ok: false, error: "Escribe tu mensaje." };
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("contact-submit", {
    body: {
      name: form.name?.trim() || null,
      email: form.email.trim(),
      phone: form.phone?.trim() || null,
      subject: form.subject?.trim() || null,
      message: form.message.trim(),
      website: form.website || "",
      turnstileToken: form.turnstileToken || "",
    },
  });
  if (error) return { ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo." };
  if (data && data.ok === false) return { ok: false, error: data.error || "No se pudo enviar el mensaje." };
  return { ok: true };
}

export async function createGuestOrder(payload: {
  email: string; name: string; phone: string; payment_method: string;
  address: string; postal_code: string; city: string; province: string; country?: string;
  items: { product_id: string; qty: number }[];
}): Promise<ActionResult> {
  if (!payload.email?.trim()) return { ok: false, error: "El correo es obligatorio." };
  if (!payload.phone?.trim()) return { ok: false, error: "El teléfono móvil es obligatorio." };
  if (!payload.address?.trim() || !payload.postal_code?.trim() || !payload.city?.trim())
    return { ok: false, error: "La dirección de envío completa es obligatoria." };
  if (!payload.items?.length) return { ok: false, error: "El carrito está vacío." };
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_guest_order", {
    p_email: payload.email.trim(),
    p_name: payload.name?.trim() || "",
    p_phone: payload.phone.trim(),
    p_address: payload.address.trim(),
    p_postal_code: payload.postal_code.trim(),
    p_city: payload.city.trim(),
    p_province: payload.province?.trim() || "",
    p_country: payload.country?.trim() || "España",
    p_payment_method: payload.payment_method,
    p_items: payload.items,
  });
  if (error) return { ok: false, error: error.message || "No se pudo crear el pedido." };
  const orderNo = data as number;

  // Factura al momento de la compra: no bloquea la confirmación del pedido si falla,
  // pero queda registrado en consola para regenerarla manualmente desde el admin si hace falta.
  try {
    const { data: ord } = await supabase.from("orders").select("id").eq("order_no", orderNo).single();
    if (ord?.id) {
      const inv = await generateInvoiceForOrder(ord.id);
      if (!inv.ok) console.error("Factura no generada para pedido", orderNo, inv.error);
    }
  } catch (e) {
    console.error("Error generando factura para pedido", orderNo, e);
  }

  return { ok: true, orderNo };
}
