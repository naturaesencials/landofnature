"use server";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

type Res = { ok: boolean; error?: string };

async function adminClient() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "admin") return null;
  return supabase;
}

export async function adminUpdateProduct(input: {
  id: string; public_price: number; stock: number; active: boolean;
}): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const price = Number.isFinite(input.public_price) ? Math.max(0, Math.round(input.public_price * 100) / 100) : 0;
  const stock = Number.isFinite(input.stock) ? Math.max(0, Math.round(input.stock)) : 0;
  const { error } = await supabase.from("products")
    .update({ public_price: price, stock, active: input.active, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminUpdateOrderStatus(input: { id: string; status: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const allowed = ["pending_payment", "paid", "confirmed", "preparing", "shipped", "cancelled"];
  if (!allowed.includes(input.status)) return { ok: false, error: "Estado no válido." };
  const { error } = await supabase.from("orders").update({ status: input.status }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminShipOrder(input: { order_no: number; carrier: string; carrier_name?: string; tracking_number: string; tracking_url?: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (!input.tracking_number || !input.tracking_number.trim()) return { ok: false, error: "El número de seguimiento es obligatorio." };
  if (input.carrier !== "inpost" && !(input.carrier_name || "").trim()) return { ok: false, error: "Indica el nombre del transporte." };
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "Sesión no válida." };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/order-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify(input),
    });
    const d = await r.json();
    if (!r.ok || d.error) return { ok: false, error: d.error || "No se pudo marcar como enviado." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Error de red al enviar el aviso de despacho." };
  }
}

export async function adminUpdateRequest(input: { id: string; status: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const allowed = ["pending", "approved", "rejected"];
  if (!allowed.includes(input.status)) return { ok: false, error: "Estado no válido." };
  const { error } = await supabase.from("account_requests").update({ status: input.status }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminSetAgreement(input: { id: string; value: boolean }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { error } = await supabase.from("profiles").update({ commercial_agreement: input.value }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminSetTransfer(input: { id: string; value: boolean }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { error } = await supabase.from("profiles").update({ allow_transfer: input.value }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
