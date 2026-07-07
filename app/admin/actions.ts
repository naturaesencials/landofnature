"use server";
import { createClient } from "@/lib/supabase/server";

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
  const allowed = ["pending_payment", "paid", "shipped", "cancelled"];
  if (!allowed.includes(input.status)) return { ok: false, error: "Estado no válido." };
  const { error } = await supabase.from("orders").update({ status: input.status }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
