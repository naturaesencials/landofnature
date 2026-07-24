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

/* ============================================================
   TARIFAS
   ============================================================ */

export async function adminSetClientTariff(input: { id: string; tariff_code: string | null }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const code = input.tariff_code && input.tariff_code.trim() ? input.tariff_code.trim() : null;
  const { error } = await supabase.from("profiles").update({ tariff_code: code }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminSaveTariff(input: { code: string; name: string; sort: number }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const code = (input.code || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "El código de tarifa es obligatorio." };
  if (!/^[A-Z0-9_-]{1,12}$/.test(code)) return { ok: false, error: "Código no válido (A-Z, 0-9, máx. 12)." };
  const { error } = await supabase.from("tariffs").upsert(
    { code, name: (input.name || "").trim() || `Tarifa ${code}`, sort: Number(input.sort) || 0 },
    { onConflict: "code" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminSetTariffPrice(input: { product_id: string; tariff_code: string; price: number | null }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (input.price == null || !Number.isFinite(input.price)) {
    const { error } = await supabase.from("product_tariff_prices").delete()
      .eq("product_id", input.product_id).eq("tariff_code", input.tariff_code);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const price = Math.max(0, Math.round(input.price * 100) / 100);
  const { error } = await supabase.from("product_tariff_prices")
    .upsert({ product_id: input.product_id, tariff_code: input.tariff_code, price }, { onConflict: "product_id,tariff_code" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Recalcula toda una tarifa como un % de descuento sobre el precio público. */
export async function adminBulkTariffPrices(input: { tariff_code: string; discount_pct: number; only_missing?: boolean }): Promise<Res & { updated?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const pct = Number(input.discount_pct);
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) return { ok: false, error: "El descuento debe estar entre 0 y 99,99." };
  const { data: prods, error: e1 } = await supabase.from("products").select("id,public_price").eq("active", true);
  if (e1) return { ok: false, error: e1.message };
  let existing = new Set<string>();
  if (input.only_missing) {
    const { data: cur } = await supabase.from("product_tariff_prices").select("product_id").eq("tariff_code", input.tariff_code);
    existing = new Set((cur ?? []).map((r: { product_id: string }) => r.product_id));
  }
  const rows = (prods ?? [])
    .filter((p: { id: string; public_price: number }) => Number(p.public_price) > 0 && !existing.has(p.id))
    .map((p: { id: string; public_price: number }) => ({
      product_id: p.id,
      tariff_code: input.tariff_code,
      price: Math.round(Number(p.public_price) * (1 - pct / 100) * 100) / 100,
    }));
  if (rows.length === 0) return { ok: true, updated: 0 };
  const { error } = await supabase.from("product_tariff_prices").upsert(rows, { onConflict: "product_id,tariff_code" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, updated: rows.length };
}

/* ============================================================
   CONTRATOS
   ============================================================ */

type ContractInput = Record<string, unknown> & { id?: string; client_id: string };

export async function adminSaveContract(input: ContractInput): Promise<Res & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (!input.client_id) return { ok: false, error: "Falta el cliente." };
  if (!input.start_date) return { ok: false, error: "La fecha de inicio es obligatoria." };
  const payload = { ...input, updated_at: new Date().toISOString() };
  if (input.id) {
    const { error } = await supabase.from("client_contracts").update(payload).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: input.id };
  }
  delete (payload as { id?: string }).id;
  const { data, error } = await supabase.from("client_contracts").insert(payload).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function adminDeleteContract(input: { id: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { error } = await supabase.from("client_contracts").delete().eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminSaveTarget(input: { contract_id: string; year: number; minimum: number; objective: number }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: "Año no válido." };
  const { error } = await supabase.from("contract_targets").upsert({
    contract_id: input.contract_id, year,
    minimum: Math.max(0, Number(input.minimum) || 0),
    objective: Math.max(0, Number(input.objective) || 0),
  }, { onConflict: "contract_id,year" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminDeleteTarget(input: { contract_id: string; year: number }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { error } = await supabase.from("contract_targets").delete()
    .eq("contract_id", input.contract_id).eq("year", input.year);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminSaveCommission(input: {
  id?: string; contract_id: string; period_year: number; period_no: number;
  base_amount: number; pct: number; status: string; settled_at?: string | null; notes?: string | null;
}): Promise<Res & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const base = Math.max(0, Number(input.base_amount) || 0);
  const pct = Math.max(0, Number(input.pct) || 0);
  const row = {
    contract_id: input.contract_id,
    period_year: Number(input.period_year),
    period_no: Number(input.period_no),
    base_amount: base, pct,
    amount: Math.round(base * (pct / 100) * 100) / 100,
    status: input.status === "settled" ? "settled" : "pending",
    settled_at: input.settled_at || null,
    notes: input.notes || null,
  };
  const { data, error } = await supabase.from("contract_commissions")
    .upsert(row, { onConflict: "contract_id,period_year,period_no" }).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function adminDeleteCommission(input: { id: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { error } = await supabase.from("contract_commissions").delete().eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ============================================================
   FACTURAS Y PAGOS
   ============================================================ */

export async function adminSaveInvoice(input: Record<string, unknown> & { id?: string; direction: string }): Promise<Res & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (input.direction !== "sale" && input.direction !== "purchase") return { ok: false, error: "Tipo de factura no válido." };
  if (!input.issue_date) return { ok: false, error: "La fecha de emisión es obligatoria." };
  const payload = { ...input, updated_at: new Date().toISOString() };
  if (input.id) {
    const { error } = await supabase.from("invoices").update(payload).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: input.id };
  }
  delete (payload as { id?: string }).id;
  const { data, error } = await supabase.from("invoices").insert(payload).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function adminDeleteInvoice(input: { id: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data: inv } = await supabase.from("invoices").select("file_path").eq("id", input.id).single();
  const { error } = await supabase.from("invoices").delete().eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  if (inv?.file_path) await supabase.storage.from("invoices").remove([inv.file_path]);
  return { ok: true };
}

export async function adminAddPayment(input: {
  invoice_id: string; amount: number; paid_on: string; method?: string; reference?: string;
}): Promise<Res & { id?: string; paid_amount?: number; status?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
  if (!amount) return { ok: false, error: "El importe debe ser distinto de cero." };
  const { data, error } = await supabase.from("invoice_payments").insert({
    invoice_id: input.invoice_id, amount,
    paid_on: input.paid_on || new Date().toISOString().slice(0, 10),
    method: input.method || null, reference: input.reference || null,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  const { data: inv } = await supabase.from("invoices").select("paid_amount,status").eq("id", input.invoice_id).single();
  return { ok: true, id: data?.id, paid_amount: Number(inv?.paid_amount ?? 0), status: inv?.status };
}

export async function adminDeletePayment(input: { id: string; invoice_id: string }): Promise<Res & { paid_amount?: number; status?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { error } = await supabase.from("invoice_payments").delete().eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  const { data: inv } = await supabase.from("invoices").select("paid_amount,status").eq("id", input.invoice_id).single();
  return { ok: true, paid_amount: Number(inv?.paid_amount ?? 0), status: inv?.status };
}

/** Enlace temporal de descarga para un documento privado. */
export async function adminDocUrl(input: { bucket: "invoices" | "contracts"; path: string }): Promise<Res & { url?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error } = await supabase.storage.from(input.bucket).createSignedUrl(input.path, 300);
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: data?.signedUrl };
}
