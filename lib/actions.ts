"use server";

import { createClient } from "./supabase/server";

export type ActionResult = { ok: boolean; error?: string; orderNo?: number };

export async function submitAccountRequest(form: {
  contact_name: string; company: string; cif: string; business_type?: string;
  email: string; phone: string; message?: string;
}): Promise<ActionResult> {
  const required = ["contact_name", "company", "cif", "email", "phone"] as const;
  for (const k of required) {
    if (!form[k] || !String(form[k]).trim()) return { ok: false, error: "Faltan datos obligatorios." };
  }
  const supabase = createClient();
  const { error } = await supabase.from("account_requests").insert({
    contact_name: form.contact_name.trim(),
    company: form.company.trim(),
    cif: form.cif.trim(),
    business_type: form.business_type || null,
    email: form.email.trim(),
    phone: form.phone.trim(),
    message: form.message?.trim() || null,
    status: "pending",
  });
  if (error) return { ok: false, error: "No se pudo enviar la solicitud. Inténtalo de nuevo." };
  return { ok: true };
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
}): Promise<ActionResult> {
  if (!form.email || !String(form.email).trim()) return { ok: false, error: "El correo es obligatorio." };
  if (!form.message || !String(form.message).trim()) return { ok: false, error: "Escribe tu mensaje." };
  const supabase = createClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: form.name?.trim() || null,
    email: form.email.trim(),
    phone: form.phone?.trim() || null,
    subject: form.subject?.trim() || null,
    message: form.message.trim(),
    status: "new",
  });
  if (error) return { ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo." };
  return { ok: true };
}

export async function createGuestOrder(payload: {
  email: string; name: string; phone: string; payment_method: string;
  items: { product_id: string; qty: number }[];
}): Promise<ActionResult> {
  if (!payload.email?.trim()) return { ok: false, error: "El correo es obligatorio." };
  if (!payload.items?.length) return { ok: false, error: "El carrito está vacío." };
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_guest_order", {
    p_email: payload.email.trim(),
    p_name: payload.name?.trim() || "",
    p_phone: payload.phone?.trim() || "",
    p_payment_method: payload.payment_method,
    p_items: payload.items,
  });
  if (error) return { ok: false, error: error.message || "No se pudo crear el pedido." };
  return { ok: true, orderNo: data as number };
}
