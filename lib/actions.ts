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

export async function createGuestOrder(payload: {
  email: string; name: string; phone: string; payment_method: "transfer" | "card";
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
