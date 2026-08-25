"use server";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

type Res = { ok: boolean; error?: string };

/** Escapa un término para usarlo dentro de un filtro .or() de PostgREST. Sin esto, cualquier valor
 *  con coma o paréntesis (habitual en razones sociales: "Nombre, S.L.") rompe la sintaxis del filtro
 *  con un error 400 silencioso — este fue el motivo real de que ciertas búsquedas fallaran. */
function esc(term: string): string {
  return `"${term.replace(/"/g, '\\"')}"`;
}

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

/** Edición completa de la ficha de producto (todos los campos salvo el stock, que se gestiona desde Inventario). */
export async function adminUpdateProductFull(input: {
  id: string; slug: string; brand: string; name: string; category: string; family: string | null;
  size: string | null; sku: string; barcode: string | null; description: string | null; inci: string | null;
  inci_verified: boolean; public_price: number; vat_rate: number; units_per_box: number | null;
  weight_kg: number | null; low_stock_threshold: number; active: boolean; image_url: string | null;
  cost: number | null; archived: boolean; costEstimated?: boolean;
}): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const brand = input.brand.trim(), name = input.name.trim(), category = input.category.trim(), sku = input.sku.trim();
  if (!slug || !brand || !name || !category || !sku) return { ok: false, error: "Slug, marca, nombre, categoría y SKU son obligatorios." };
  const price = Number.isFinite(input.public_price) ? Math.max(0, Math.round(input.public_price * 100) / 100) : 0;
  const vat = Number.isFinite(input.vat_rate) ? Math.max(0, input.vat_rate) : 0.21;
  const { error } = await supabase.from("products").update({
    slug, brand, name, category,
    family: input.family?.trim() || null,
    size: input.size?.trim() || null,
    sku,
    barcode: input.barcode?.trim() || null,
    description: input.description?.trim() || null,
    inci: input.inci?.trim() || null,
    inci_verified: input.inci_verified,
    public_price: price,
    vat_rate: vat,
    units_per_box: input.units_per_box || null,
    weight_kg: input.weight_kg || null,
    low_stock_threshold: Number.isFinite(input.low_stock_threshold) ? Math.max(0, Math.round(input.low_stock_threshold)) : 20,
    active: input.active,
    image_url: input.image_url?.trim() || null,
    cost: input.cost != null && Number.isFinite(input.cost) ? Math.max(0, Math.round(input.cost * 100) / 100) : null,
    archived: input.archived,
    cost_estimated: input.costEstimated ?? false,
    updated_at: new Date().toISOString(),
  }).eq("id", input.id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: error.message.includes("barcode") ? "Ese código de barras ya está en uso." : error.message.includes("sku") ? "Ese SKU ya está en uso." : "Ese slug ya está en uso." };
    return { ok: false, error: error.message };
  }
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

/* ---------------- Inventario ---------------- */

export type InvLookup = {
  id: string; brand: string; name: string; size: string | null; sku: string; barcode: string | null;
  units_per_box: number | null; image_url: string | null;
  levels: { warehouse_id: string; on_hand: number }[];
};

/** Busca un producto por código de barras o SKU exacto y devuelve su stock por almacén. */
export async function adminInventoryLookup(input: { code: string }): Promise<Res & { product?: InvLookup }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const code = input.code.trim();
  if (!code) return { ok: false, error: "Código vacío." };
  const { data: prod, error } = await supabase
    .from("products")
    .select("id,brand,name,size,sku,barcode,units_per_box,image_url")
    .or(`barcode.eq.${code},sku.eq.${code}`)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!prod) return { ok: false, error: "No se ha encontrado ningún producto con ese código." };
  const { data: levels } = await supabase.from("inventory_levels").select("warehouse_id,on_hand").eq("product_id", prod.id);
  return { ok: true, product: { ...prod, levels: levels ?? [] } };
}

/** Asigna o cambia el código de barras de un producto. */
export async function adminSetBarcode(input: { product_id: string; barcode: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const barcode = input.barcode.trim();
  const { error } = await supabase.from("products").update({ barcode: barcode || null, updated_at: new Date().toISOString() }).eq("id", input.product_id);
  if (error) return { ok: false, error: error.code === "23505" ? "Ese código de barras ya está asignado a otro producto." : error.message };
  return { ok: true };
}

/** Registra un recuento de stock para un producto en un almacén. */
export async function adminInventoryCount(input: { product_id: string; warehouse_id: string; counted_qty: number; note?: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const qty = Math.max(0, Math.round(Number(input.counted_qty) || 0));
  const { error } = await supabase.rpc("inventory_record_count", {
    p_product_id: input.product_id, p_warehouse_id: input.warehouse_id, p_counted_qty: qty, p_note: input.note || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Transfiere stock entre dos almacenes de forma atómica. */
export async function adminInventoryTransfer(input: { product_id: string; from: string; to: string; qty: number; note?: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const qty = Math.round(Number(input.qty) || 0);
  const { error } = await supabase.rpc("inventory_transfer", {
    p_product_id: input.product_id, p_from: input.from, p_to: input.to, p_qty: qty, p_note: input.note || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function adminAddWarehouse(input: { id: string; name: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const id = input.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const name = input.name.trim();
  if (!id || !name) return { ok: false, error: "Indica identificador y nombre del almacén." };
  const { error } = await supabase.from("warehouses").insert({ id, name });
  if (error) return { ok: false, error: error.code === "23505" ? "Ya existe un almacén con ese identificador." : error.message };
  return { ok: true };
}

export type InvHistoryRow = {
  id: string; created_at: string; type: "count" | "transfer";
  product_title: string | null; sku: string | null;
  warehouse_id: string | null; previous_qty: number | null; counted_qty: number | null;
  from_warehouse_id: string | null; to_warehouse_id: string | null; transfer_qty: number | null;
  from_previous_qty: number | null; to_previous_qty: number | null; note: string | null;
};

export async function adminInventoryHistory(input: { from?: string; to?: string; type?: "count" | "transfer" }): Promise<Res & { rows?: InvHistoryRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  let q = supabase.from("inventory_events").select("*").order("created_at", { ascending: false }).limit(500);
  if (input.from) q = q.gte("created_at", input.from);
  if (input.to) q = q.lte("created_at", input.to);
  if (input.type) q = q.eq("type", input.type);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as InvHistoryRow[] };
}

export type PartnerOrderRow = {
  referencia: string; fecha_pedido: string | null; estado: string | null; total: number | null; nota: string | null;
};
export async function adminPartnerOrders(partnerId: string): Promise<Res & { rows?: PartnerOrderRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error } = await supabase.from("erp_sale_orders")
    .select("referencia,fecha_pedido,estado,total,nota")
    .eq("partner_id", partnerId)
    .order("fecha_pedido", { ascending: false })
    .limit(300);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as PartnerOrderRow[] };
}

export type SaleOrderDetail = {
  order: { referencia: string; cliente: string | null; comercial: string | null; estado: string | null; fecha_pedido: string | null; total: number | null; plazos_pago: string | null; referencia_cliente: string | null; nota: string | null } | null;
  lines: { product_code: string | null; product_name: string | null; cantidad: number | null; precio_unitario: number | null; subtotal: number | null; descripcion: string | null }[];
  messages: { autor: string | null; fecha: string | null; contenido: string | null }[];
};
export async function adminSaleOrderDetail(referencia: string): Promise<Res & { detail?: SaleOrderDetail }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const [o, l, m] = await Promise.all([
    supabase.from("erp_sale_orders").select("referencia,cliente,comercial,estado,fecha_pedido,total,plazos_pago,referencia_cliente,nota").eq("referencia", referencia).maybeSingle(),
    supabase.from("erp_sale_order_lines").select("product_code,product_name,cantidad,precio_unitario,subtotal,descripcion").eq("order_referencia", referencia),
    supabase.from("erp_sale_order_messages").select("autor,fecha,contenido").eq("order_referencia", referencia).order("fecha", { ascending: true }),
  ]);
  return { ok: true, detail: { order: (o.data ?? null) as SaleOrderDetail["order"], lines: (l.data ?? []) as SaleOrderDetail["lines"], messages: (m.data ?? []) as SaleOrderDetail["messages"] } };
}

export type SaleOrderListRow = { referencia: string; cliente: string | null; fecha_pedido: string | null; estado: string | null; total: number | null; nota: string | null };
export async function adminSaleOrdersList(input: { q?: string; year?: number; limit?: number; offset?: number }): Promise<Res & { rows?: SaleOrderListRow[]; total?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;
  let query = supabase.from("erp_sale_orders").select("referencia,cliente,fecha_pedido,estado,total,nota", { count: "exact" })
    .order("fecha_pedido", { ascending: false }).range(offset, offset + limit - 1);
  if (input.q && input.q.trim().length >= 2) {
    const like = `%${input.q.trim()}%`;
    query = query.or(`referencia.ilike.${esc(like)},cliente.ilike.${esc(like)},referencia_cliente.ilike.${esc(like)},nota.ilike.${esc(like)}`);
  }
  if (input.year) {
    query = query.gte("fecha_pedido", `${input.year}-01-01`).lt("fecha_pedido", `${input.year + 1}-01-01`);
  }
  const { data, error, count } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as SaleOrderListRow[], total: count ?? 0 };
}

export async function adminSaleOrdersYears(): Promise<Res & { years?: { year: number; count: number }[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error } = await supabase.from("erp_sale_orders").select("fecha_pedido").not("fecha_pedido", "is", null).limit(20000);
  if (error) return { ok: false, error: error.message };
  const counts = new Map<number, number>();
  for (const r of data ?? []) {
    const y = new Date(r.fecha_pedido as string).getFullYear();
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  const years = Array.from(counts.entries()).map(([year, count]) => ({ year, count })).sort((a, b) => b.year - a.year);
  return { ok: true, years };
}

/** Clientes reales de la web nueva (no del ERP): agrupa los pedidos de la tabla `orders` por email,
 *  distinguiendo cuentas registradas (client_id) de compras como invitado. */
export type WebCustomer = {
  email: string; name: string | null; phone: string | null; city: string | null;
  registered: boolean; order_count: number; total_spent: number; first_order: string; last_order: string;
};
export async function adminWebCustomers(): Promise<Res & { rows?: WebCustomer[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error } = await supabase.from("orders").select("email,name,phone,city,client_id,total,created_at").order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  const map = new Map<string, WebCustomer>();
  for (const o of data ?? []) {
    if (!o.email) continue;
    const key = o.email.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        email: o.email, name: o.name, phone: o.phone, city: o.city,
        registered: !!o.client_id, order_count: 1, total_spent: Number(o.total) || 0,
        first_order: o.created_at, last_order: o.created_at,
      });
    } else {
      existing.order_count += 1;
      existing.total_spent += Number(o.total) || 0;
      existing.last_order = o.created_at;
      if (o.client_id) existing.registered = true;
      if (!existing.name && o.name) existing.name = o.name;
    }
  }
  return { ok: true, rows: Array.from(map.values()).sort((a, b) => b.last_order.localeCompare(a.last_order)) };
}

import { createManualInvoice, createCreditNote, type ManualInvoiceInput, type CreditNoteInput } from "@/lib/invoice";

/* ---------------- KPIs reales del negocio (facturación nueva + histórico Odoo) ---------------- */
export type RealDashboardStats = {
  year: number;
  ventasAnio: number; facturasAnioCount: number;
  pendienteCobro: number; pendienteCobroCount: number;
  revertidasCount: number;
  pedidosActivosCount: number; pedidosActivosTotal: number;
};
export async function adminRealDashboardStats(): Promise<Res & { stats?: RealDashboardStats }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const year = new Date().getFullYear();
  const yStart = `${year}-01-01`, yEnd = `${year + 1}-01-01`;

  const [nativeYear, erpYear, nativePend, erpPend, revertedRaw, orders] = await Promise.all([
    supabase.from("native_invoices").select("total").eq("kind", "invoice").neq("status", "cancelled").gte("issue_date", yStart).lt("issue_date", yEnd),
    supabase.from("erp_invoices_sale").select("total").neq("estado", "Cancelado").gte("fecha", yStart).lt("fecha", yEnd),
    supabase.from("native_invoices").select("total").eq("kind", "invoice").in("status", ["issued", "sent"]),
    supabase.from("erp_invoices_sale").select("total,importe_adeudado").not("estado_pago", "in", "(Pagado,En proceso de pago,Revertido,Cancelado)").limit(20000),
    supabase.from("erp_invoices_sale").select("numero,origen").eq("estado_pago", "Revertido"),
    supabase.from("orders").select("total,status").in("status", ["pending_payment", "paid", "confirmed", "preparing"]),
  ]);

  // "Revertidas a revisar" reales: sin enlace confirmado de Odoo (reversed_entry_id) ni rectificativa
  // deducible por pedido de venta compartido. El resto ya está resuelto y no necesita revisión.
  const revertedRows = revertedRaw.data ?? [];
  let revertidasCount = revertedRows.length;
  if (revertedRows.length) {
    const numeros = revertedRows.map((r) => r.numero);
    const origenes = Array.from(new Set(revertedRows.map((r) => r.origen).filter(Boolean))) as string[];
    const [linksRes, cnByOrigenRes] = await Promise.all([
      supabase.from("erp_credit_note_links").select("factura_original").in("factura_original", numeros),
      origenes.length ? supabase.from("erp_credit_notes_sale").select("origen").in("origen", origenes) : Promise.resolve({ data: [] as { origen: string | null }[] }),
    ]);
    const linkedNumeros = new Set((linksRes.data ?? []).map((l) => l.factura_original));
    const origenesConNota = new Set((cnByOrigenRes.data ?? []).map((c) => c.origen));
    revertidasCount = revertedRows.filter((r) => !linkedNumeros.has(r.numero) && !(r.origen && origenesConNota.has(r.origen))).length;
  }

  const ventasAnio = (nativeYear.data ?? []).reduce((s, i) => s + Number(i.total || 0), 0) + (erpYear.data ?? []).reduce((s, i) => s + Number(i.total || 0), 0);
  const facturasAnioCount = (nativeYear.data?.length ?? 0) + (erpYear.data?.length ?? 0);
  const pendienteCobro = (nativePend.data ?? []).reduce((s, i) => s + Number(i.total || 0), 0) + (erpPend.data ?? []).reduce((s, i) => s + Number(i.importe_adeudado ?? i.total ?? 0), 0);
  const pendienteCobroCount = (nativePend.data?.length ?? 0) + (erpPend.data?.length ?? 0);

  return {
    ok: true,
    stats: {
      year, ventasAnio: Math.round(ventasAnio * 100) / 100, facturasAnioCount,
      pendienteCobro: Math.round(pendienteCobro * 100) / 100, pendienteCobroCount,
      revertidasCount,
      pedidosActivosCount: orders.data?.length ?? 0,
      pedidosActivosTotal: Math.round((orders.data ?? []).reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100,
    },
  };
}

export type YearlyRevenue = { year: number; bruto: number; rectificativas: number; neto: number; countFacturas: number; countRectificativas: number };
export async function adminRevenueByYear(): Promise<Res & { rows?: YearlyRevenue[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const [nativeInvRes, nativeCnRes, erpInvRes, erpCnRes] = await Promise.all([
    supabase.from("native_invoices").select("issue_date,total").eq("kind", "invoice").neq("status", "cancelled").limit(20000),
    supabase.from("native_invoices").select("issue_date,total").eq("kind", "credit_note").neq("status", "cancelled").limit(20000),
    supabase.from("erp_invoices_sale").select("fecha,total").neq("estado", "Cancelado").limit(20000),
    supabase.from("erp_credit_notes_sale").select("fecha,total").limit(20000),
  ]);
  const map = new Map<number, YearlyRevenue>();
  const get = (y: number) => {
    let v = map.get(y);
    if (!v) { v = { year: y, bruto: 0, rectificativas: 0, neto: 0, countFacturas: 0, countRectificativas: 0 }; map.set(y, v); }
    return v;
  };
  for (const i of nativeInvRes.data ?? []) {
    if (!i.issue_date) continue;
    const v = get(new Date(i.issue_date).getFullYear());
    v.bruto += Number(i.total || 0); v.countFacturas += 1;
  }
  for (const i of erpInvRes.data ?? []) {
    if (!i.fecha) continue;
    const v = get(new Date(i.fecha).getFullYear());
    v.bruto += Number(i.total || 0); v.countFacturas += 1;
  }
  for (const i of nativeCnRes.data ?? []) {
    if (!i.issue_date) continue;
    const v = get(new Date(i.issue_date).getFullYear());
    v.rectificativas += Math.abs(Number(i.total || 0)); v.countRectificativas += 1;
  }
  for (const i of erpCnRes.data ?? []) {
    if (!i.fecha) continue;
    const v = get(new Date(i.fecha).getFullYear());
    v.rectificativas += Math.abs(Number(i.total || 0)); v.countRectificativas += 1;
  }
  const rows = Array.from(map.values()).map((v) => ({
    ...v, bruto: Math.round(v.bruto * 100) / 100, rectificativas: Math.round(v.rectificativas * 100) / 100,
    neto: Math.round((v.bruto - v.rectificativas) * 100) / 100,
  })).sort((a, b) => b.year - a.year);
  return { ok: true, rows };
}

export type ErpAttachment = { nombre_archivo: string; mimetype: string | null; tamano_bytes: number | null; storage_path: string };

function safeAttachmentRef(ref: string): string {
  return ref.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function adminErpAttachments(categoria: string, referencia: string): Promise<Res & { rows?: ErpAttachment[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error } = await supabase.from("erp_attachments").select("nombre_archivo,mimetype,tamano_bytes,storage_path")
    .eq("categoria", categoria).eq("referencia_normalizada", referencia);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as ErpAttachment[] };
}

export async function adminErpAttachmentUrl(storagePath: string): Promise<Res & { url?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error } = await supabase.storage.from("odoo-adjuntos").createSignedUrl(storagePath, 300);
  if (error || !data) return { ok: false, error: error?.message || "No se pudo generar el enlace." };
  return { ok: true, url: data.signedUrl };
}

export async function adminUploadAttachment(input: {
  categoria: string; referencia: string; filename: string; mimetype: string; base64: string;
}): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const safeRef = safeAttachmentRef(input.referencia);
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${input.categoria}/${safeRef}/${Date.now()}_${safeName}`;

  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.length > 50 * 1024 * 1024) return { ok: false, error: "El archivo supera el límite de 50 MB." };

  const { error: upErr } = await supabase.storage.from("odoo-adjuntos").upload(storagePath, bytes, { contentType: input.mimetype || "application/octet-stream" });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: insErr } = await supabase.from("erp_attachments").insert({
    categoria: input.categoria, referencia: safeRef, referencia_normalizada: input.referencia,
    nombre_archivo: input.filename, mimetype: input.mimetype || null, tamano_bytes: bytes.length, storage_path: storagePath,
  });
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true };
}

/* ---------------- Pendientes de pago + marcar como pagada ---------------- */

export type PendingInvoiceRow = {
  numero: string; cliente: string | null; fecha: string | null; total: number | null;
  estado: string | null; origen: "nueva" | "odoo"; id?: string; vencimiento: string | null; vencida: boolean;
};
export async function adminPendingInvoices(): Promise<Res & { rows?: PendingInvoiceRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const today = new Date().toISOString();
  const [nativeRes, erpRes] = await Promise.all([
    supabase.from("native_invoices").select("id,numero,issue_date,customer_name,total,status").eq("kind", "invoice").in("status", ["issued", "sent"]).order("issue_date", { ascending: false }),
    supabase.from("erp_invoices_sale").select("numero,fecha,partner,total,estado_pago,fecha_vencimiento")
      .not("estado_pago", "in", "(Pagado,En proceso de pago,Revertido,Cancelado)").order("fecha", { ascending: false }),
  ]);
  if (nativeRes.error) return { ok: false, error: nativeRes.error.message };
  if (erpRes.error) return { ok: false, error: erpRes.error.message };
  const rows: PendingInvoiceRow[] = [
    ...(nativeRes.data ?? []).map((i) => ({ numero: i.numero, cliente: i.customer_name, fecha: i.issue_date, total: i.total, estado: i.status, origen: "nueva" as const, id: i.id, vencimiento: null, vencida: false })),
    ...(erpRes.data ?? []).map((i) => ({ numero: i.numero, cliente: i.partner, fecha: i.fecha, total: i.total, estado: i.estado_pago, origen: "odoo" as const, vencimiento: i.fecha_vencimiento, vencida: !!i.fecha_vencimiento && i.fecha_vencimiento < today })),
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return { ok: true, rows };
}

export async function adminKnownPaymentAccounts(): Promise<Res & { accounts?: string[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const [a, b, c] = await Promise.all([
    supabase.from("erp_invoice_payments").select("cuenta_pago").limit(20000),
    supabase.from("erp_invoices_sale").select("cuenta_pago").not("cuenta_pago", "is", null).limit(20000),
    supabase.from("native_invoices").select("cuenta_pago").not("cuenta_pago", "is", null).limit(20000),
  ]);
  const set = new Set<string>();
  for (const r of a.data ?? []) if (r.cuenta_pago) set.add(r.cuenta_pago);
  for (const r of b.data ?? []) if (r.cuenta_pago) set.add(r.cuenta_pago);
  for (const r of c.data ?? []) if (r.cuenta_pago) set.add(r.cuenta_pago);
  return { ok: true, accounts: Array.from(set).sort() };
}

export async function adminMarkInvoicePaid(input: { origen: "nueva" | "odoo"; numero: string; cuentaPago: string; fechaPago: string }): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (!input.cuentaPago.trim()) return { ok: false, error: "Indica desde qué cuenta se ha pagado." };
  if (!input.fechaPago) return { ok: false, error: "Indica la fecha de pago." };
  if (input.origen === "nueva") {
    const { error } = await supabase.from("native_invoices").update({ status: "paid", cuenta_pago: input.cuentaPago.trim(), fecha_pago: input.fechaPago }).eq("numero", input.numero);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: inv } = await supabase.from("erp_invoices_sale").select("total").eq("numero", input.numero).maybeSingle();
    const { error } = await supabase.from("erp_invoices_sale").update({
      estado_pago: "Pagado", cuenta_pago: input.cuentaPago.trim(), fecha_pago: input.fechaPago,
      importe_pagado: inv?.total ?? null, importe_adeudado: null,
    }).eq("numero", input.numero);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type PaymentAccountSummary = { cuenta: string; count: number; total: number };
export async function adminPaymentAccountsSummary(): Promise<Res & { limpias?: PaymentAccountSummary[]; combinadas?: PaymentAccountSummary[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  // Fuente exacta: pagos individuales importados de Odoo (account.payment -> reconciled_invoice_ids),
  // que dan el importe real por cuenta incluso cuando una factura se pagó con varios métodos.
  const { data: pagos, error: pagosErr } = await supabase.from("erp_invoice_payments").select("cuenta_pago,importe,multiple_facturas_en_pago").limit(20000);
  const exactMap = new Map<string, { count: number; total: number }>();
  const multiPago: { count: number; total: number } = { count: 0, total: 0 };
  if (!pagosErr) {
    for (const p of pagos ?? []) {
      if (p.multiple_facturas_en_pago) { multiPago.count += 1; multiPago.total += Number(p.importe || 0); continue; }
      const cur = exactMap.get(p.cuenta_pago) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(p.importe || 0);
      exactMap.set(p.cuenta_pago, cur);
    }
  }

  // Fallback (facturas manuales / de la web nueva) que aún no tienen pago individual importado:
  // usan el texto libre cuenta_pago guardado al marcar "pagada" a mano.
  const [nativeRes, erpRes] = await Promise.all([
    supabase.from("native_invoices").select("cuenta_pago,total").not("cuenta_pago", "is", null).limit(20000),
    supabase.from("erp_invoices_sale").select("numero,cuenta_pago,total").not("cuenta_pago", "is", null).limit(20000),
  ]);
  const facturasConPagoExacto = new Set((pagos ?? []).map((p) => (p as { numero_factura?: string }).numero_factura));
  const combinadasMap = new Map<string, { count: number; total: number }>();
  for (const r of nativeRes.data ?? []) {
    if (!r.cuenta_pago) continue;
    const isCombinada = r.cuenta_pago.includes(" + ");
    if (isCombinada) {
      const cur = combinadasMap.get(r.cuenta_pago) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(r.total || 0);
      combinadasMap.set(r.cuenta_pago, cur);
    } else {
      const cur = exactMap.get(r.cuenta_pago) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(r.total || 0);
      exactMap.set(r.cuenta_pago, cur);
    }
  }
  for (const r of erpRes.data ?? []) {
    if (!r.cuenta_pago || facturasConPagoExacto.has(r.numero)) continue; // ya contabilizada vía pago exacto
    const isCombinada = r.cuenta_pago.includes(" + ");
    if (isCombinada) {
      const cur = combinadasMap.get(r.cuenta_pago) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(r.total || 0);
      combinadasMap.set(r.cuenta_pago, cur);
    } else {
      const cur = exactMap.get(r.cuenta_pago) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(r.total || 0);
      exactMap.set(r.cuenta_pago, cur);
    }
  }
  if (multiPago.count > 0) combinadasMap.set("Varias facturas en un mismo pago (ver detalle)", multiPago);

  const toRows = (m: Map<string, { count: number; total: number }>) =>
    Array.from(m.entries()).map(([cuenta, v]) => ({ cuenta, count: v.count, total: Math.round(v.total * 100) / 100 })).sort((a, b) => b.total - a.total);
  return { ok: true, limpias: toRows(exactMap), combinadas: toRows(combinadasMap) };
}

export type AccountInvoiceRow = { numero: string; cliente: string | null; fecha: string | null; total: number | null; origen: "nueva" | "odoo"; exclusiva: boolean; importePorEsteMetodo?: number | null };
/* ---------------- Margen por factura (coste vs precio de venta) ---------------- */

export type InvoiceMarginRow = {
  numero: string; cliente: string | null; fecha: string | null; total: number | null;
  costo: number | null; margen: number | null; margenPct: number | null;
  lineasTotales: number; lineasConCoste: number; origen: "nueva" | "odoo";
};

export async function adminInvoiceMarginList(input: { q?: string; year?: number; limit?: number }): Promise<Res & { rows?: InvoiceMarginRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const limit = input.year ? 1500 : (input.limit ?? 200);
  const like = input.q && input.q.trim().length >= 2 ? `%${input.q.trim()}%` : null;

  let query = supabase.from("erp_invoices_sale").select("numero,partner,fecha,total").order("fecha", { ascending: false }).limit(limit);
  if (like) query = query.or(`numero.ilike.${esc(like)},partner.ilike.${esc(like)}`);
  if (input.year) query = query.gte("fecha", `${input.year}-01-01`).lt("fecha", `${input.year + 1}-01-01`);
  const { data: invoices, error } = await query;
  if (error) return { ok: false, error: error.message };

  const numeros = (invoices ?? []).map((i) => i.numero);
  const { data: costs } = numeros.length
    ? await supabase.from("erp_invoice_costs").select("numero,costo_conocido,lineas_totales,lineas_con_coste").in("numero", numeros)
    : { data: [] as { numero: string; costo_conocido: number | null; lineas_totales: number; lineas_con_coste: number }[] };
  const costByNumero = new Map((costs ?? []).map((c) => [c.numero, c]));

  const rows: InvoiceMarginRow[] = (invoices ?? []).map((i) => {
    const c = costByNumero.get(i.numero);
    const costo = c?.costo_conocido ?? null;
    const total = Number(i.total || 0);
    const margen = costo != null ? Math.round((total - costo) * 100) / 100 : null;
    const margenPct = costo != null && total > 0 ? Math.round(((total - costo) / total) * 1000) / 10 : null;
    return {
      numero: i.numero, cliente: i.partner, fecha: i.fecha, total: i.total,
      costo: costo != null ? Math.round(costo * 100) / 100 : null, margen, margenPct,
      lineasTotales: c?.lineas_totales ?? 0, lineasConCoste: c?.lineas_con_coste ?? 0, origen: "odoo",
    };
  });
  return { ok: true, rows };
}

export async function adminInvoicesByAccount(cuenta: string): Promise<Res & { rows?: AccountInvoiceRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  // ¿Es una cuenta con pagos exactos importados?
  const { data: pagos } = await supabase.from("erp_invoice_payments").select("numero_factura,importe").eq("cuenta_pago", cuenta).eq("multiple_facturas_en_pago", false);
  if (pagos && pagos.length) {
    const numeros = Array.from(new Set(pagos.map((p) => p.numero_factura)));
    const { data: invs } = await supabase.from("erp_invoices_sale").select("numero,partner,fecha,total").in("numero", numeros);
    const byNumero = new Map((invs ?? []).map((i) => [i.numero, i]));
    const importeByNumero = new Map<string, number>();
    for (const p of pagos) importeByNumero.set(p.numero_factura, (importeByNumero.get(p.numero_factura) ?? 0) + Number(p.importe || 0));
    const rows: AccountInvoiceRow[] = numeros.map((numero) => {
      const inv = byNumero.get(numero);
      return { numero, cliente: inv?.partner ?? null, fecha: inv?.fecha ?? null, total: inv?.total ?? null, origen: "odoo" as const, exclusiva: true, importePorEsteMetodo: importeByNumero.get(numero) ?? null };
    }).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    return { ok: true, rows };
  }

  // Fallback: texto libre (facturas manuales / de la web nueva)
  const like = `%${cuenta}%`;
  const [nativeRes, erpRes] = await Promise.all([
    supabase.from("native_invoices").select("numero,customer_name,issue_date,total,cuenta_pago").ilike("cuenta_pago", esc(like)).order("issue_date", { ascending: false }),
    supabase.from("erp_invoices_sale").select("numero,partner,fecha,total,cuenta_pago").ilike("cuenta_pago", esc(like)).order("fecha", { ascending: false }),
  ]);
  const rows: AccountInvoiceRow[] = [
    ...(nativeRes.data ?? []).map((i) => ({ numero: i.numero, cliente: i.customer_name, fecha: i.issue_date, total: i.total, origen: "nueva" as const, exclusiva: i.cuenta_pago === cuenta })),
    ...(erpRes.data ?? []).map((i) => ({ numero: i.numero, cliente: i.partner, fecha: i.fecha, total: i.total, origen: "odoo" as const, exclusiva: i.cuenta_pago === cuenta })),
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return { ok: true, rows };
}

export type RevertedInvoiceRow = {
  numero: string; cliente: string | null; fecha: string | null; total: number | null; origen: string | null;
  candidatas: { numero: string; total: number | null; motivo?: string | null; real: boolean }[]; ambiguo: boolean;
};
export async function adminRevertedInvoicesWithCandidates(): Promise<Res & { rows?: RevertedInvoiceRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data: reverted, error } = await supabase.from("erp_invoices_sale")
    .select("numero,partner,fecha,total,origen").eq("estado_pago", "Revertido").order("fecha", { ascending: false });
  if (error) return { ok: false, error: error.message };

  const numeros = (reverted ?? []).map((r) => r.numero);
  const origenes = Array.from(new Set((reverted ?? []).map((r) => r.origen).filter(Boolean))) as string[];
  const [realLinksRes, creditNotesRes, invoicesSameOrigenRes] = await Promise.all([
    numeros.length ? supabase.from("erp_credit_note_links").select("rectificativa,factura_original,motivo").in("factura_original", numeros) : Promise.resolve({ data: [] as { rectificativa: string; factura_original: string; motivo: string | null }[] }),
    origenes.length ? supabase.from("erp_credit_notes_sale").select("numero,origen,total").in("origen", origenes) : Promise.resolve({ data: [] as { numero: string; origen: string | null; total: number | null }[] }),
    origenes.length ? supabase.from("erp_invoices_sale").select("numero,origen").in("origen", origenes) : Promise.resolve({ data: [] as { numero: string; origen: string | null }[] }),
  ]);

  // Totales de cada rectificativa (para mostrar importe también en los enlaces reales)
  const cnTotalsByNumero = new Map<string, number | null>();
  for (const cn of creditNotesRes.data ?? []) cnTotalsByNumero.set(cn.numero, cn.total);

  const realByFactura = new Map<string, { numero: string; total: number | null; motivo?: string | null; real: boolean }[]>();
  for (const link of realLinksRes.data ?? []) {
    const arr = realByFactura.get(link.factura_original) ?? [];
    arr.push({ numero: link.rectificativa, total: cnTotalsByNumero.get(link.rectificativa) ?? null, motivo: link.motivo, real: true });
    realByFactura.set(link.factura_original, arr);
  }

  const cnByOrigen = new Map<string, { numero: string; total: number | null }[]>();
  for (const cn of creditNotesRes.data ?? []) {
    if (!cn.origen) continue;
    const arr = cnByOrigen.get(cn.origen) ?? [];
    arr.push({ numero: cn.numero, total: cn.total });
    cnByOrigen.set(cn.origen, arr);
  }
  const invCountByOrigen = new Map<string, number>();
  for (const inv of invoicesSameOrigenRes.data ?? []) {
    if (!inv.origen) continue;
    invCountByOrigen.set(inv.origen, (invCountByOrigen.get(inv.origen) ?? 0) + 1);
  }

  const rows: RevertedInvoiceRow[] = (reverted ?? []).map((r) => {
    const real = realByFactura.get(r.numero);
    if (real && real.length) {
      return { numero: r.numero, cliente: r.partner, fecha: r.fecha, total: r.total, origen: r.origen, candidatas: real, ambiguo: false };
    }
    // sin enlace real de Odoo: fallback a la deducción por pedido de venta compartido
    const deducidas = r.origen ? (cnByOrigen.get(r.origen) ?? []).map((c) => ({ ...c, real: false })) : [];
    const ambiguo = !r.origen || deducidas.length === 0 || deducidas.length > 1 || (invCountByOrigen.get(r.origen) ?? 0) > 1;
    return { numero: r.numero, cliente: r.partner, fecha: r.fecha, total: r.total, origen: r.origen, candidatas: deducidas, ambiguo };
  });
  return { ok: true, rows };
}

/* ---------------- Facturación manual y rectificativas ---------------- */

export async function adminCreateManualInvoice(input: ManualInvoiceInput): Promise<Res & { numero?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const res = await createManualInvoice(input);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, numero: res.numero };
}

export type InvoiceForRectify = { source: "nueva" | "odoo"; id: string | null; numero: string; customer_name: string; total: number; issue_date: string; cif?: string | null };
export async function adminInvoicesForRectify(q: string): Promise<Res & { rows?: InvoiceForRectify[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (q.trim().length < 2) return { ok: true, rows: [] };
  const like = `%${q.trim()}%`;
  const [nativeRes, erpRes] = await Promise.all([
    supabase.from("native_invoices").select("id,numero,customer_name,total,issue_date,customer_cif")
      .eq("kind", "invoice").or(`numero.ilike.${esc(like)},customer_name.ilike.${esc(like)}`)
      .order("issue_date", { ascending: false }).limit(15),
    supabase.from("erp_invoices_sale").select("numero,partner,total,fecha,cif")
      .or(`numero.ilike.${esc(like)},partner.ilike.${esc(like)}`).order("fecha", { ascending: false }).limit(15),
  ]);
  if (nativeRes.error) return { ok: false, error: nativeRes.error.message };
  if (erpRes.error) return { ok: false, error: erpRes.error.message };
  const rows: InvoiceForRectify[] = [
    ...(nativeRes.data ?? []).map((i) => ({ source: "nueva" as const, id: i.id, numero: i.numero, customer_name: i.customer_name, total: i.total, issue_date: i.issue_date, cif: i.customer_cif })),
    ...(erpRes.data ?? []).map((i) => ({ source: "odoo" as const, id: null, numero: i.numero, customer_name: i.partner || "", total: i.total, issue_date: i.fecha, cif: i.cif })),
  ].sort((a, b) => (b.issue_date || "").localeCompare(a.issue_date || ""));
  return { ok: true, rows };
}

export type InvoiceLinesForRectify = { description: string; quantity: number; unit_price: number; vat_rate: number; is_note?: boolean }[];
export async function adminInvoiceLinesForRectify(source: "nueva" | "odoo", key: string): Promise<Res & { lines?: InvoiceLinesForRectify }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (source === "nueva") {
    const { data, error } = await supabase.from("native_invoice_lines").select("description,quantity,unit_price,vat_rate,is_note").eq("invoice_id", key);
    if (error) return { ok: false, error: error.message };
    return { ok: true, lines: (data ?? []).map((l) => ({ description: l.description, quantity: l.quantity ?? 0, unit_price: l.unit_price ?? 0, vat_rate: l.vat_rate ?? 0, is_note: l.is_note })) };
  }
  const { data, error } = await supabase.from("erp_invoice_sale_lines").select("product_name,product_code,cantidad,precio_unitario").eq("invoice_numero", key);
  if (error) return { ok: false, error: error.message };
  const lines = (data ?? []).map((l) => ({ description: l.product_name || l.product_code || "—", quantity: l.cantidad ?? 1, unit_price: l.precio_unitario ?? 0, vat_rate: 21 }));
  return { ok: true, lines };
}

export async function adminPartnerByName(name: string): Promise<Res & { partner?: Partner | null }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data } = await supabase.from("partners").select("*").eq("kind", "cliente").ilike("name", name).limit(1).maybeSingle();
  return { ok: true, partner: (data ?? null) as Partner | null };
}

export async function adminCreateCreditNote(input: CreditNoteInput): Promise<Res & { numero?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const res = await createCreditNote(input);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, numero: res.numero };
}

/* ---------------- Histórico de facturas (nuevas + importadas de Odoo) ---------------- */

export type InvoiceHistoryRow = {
  numero: string; fecha: string | null; cliente: string | null; total: number | null;
  estado: string | null; estadoRaw: string | null; origen: "nueva" | "odoo"; kind: "invoice" | "credit_note"; id?: string;
  importePagado?: number | null; importeAdeudado?: number | null; notaPago?: string | null;
  fechaPago?: string | null; fechaVencimiento?: string | null;
};

const NATIVE_STATUS_LABEL: Record<string, string> = { issued: "Emitida", sent: "Enviada", paid: "Pagada", cancelled: "Cancelada" };
// "En proceso de pago" se trata como pagado a efectos de negocio; "Revertido" se mantiene aparte para revisión manual.
const ERP_PAID_STATES = ["Pagado", "En proceso de pago"];
function displayEstadoPago(raw: string | null): string | null {
  if (raw === "En proceso de pago") return "Pagado";
  return raw;
}

export async function adminInvoiceHistoryList(input: { q?: string; year?: number; type?: "invoice" | "credit_note"; onlyPaid?: boolean; onlyReverted?: boolean; limit?: number }): Promise<Res & { rows?: InvoiceHistoryRow[]; nativeTotal?: number; erpTotal?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const limit = input.year || input.onlyPaid || input.onlyReverted ? 2000 : (input.limit ?? 200);
  const like = input.q && input.q.trim().length >= 2 ? `%${input.q.trim()}%` : null;
  const wantInvoices = !input.type || input.type === "invoice";
  const wantCreditNotes = !input.type || input.type === "credit_note";

  const queries: Promise<{ rows: InvoiceHistoryRow[]; count: number; src: "native" | "erp" }>[] = [];

  if (wantInvoices) {
    queries.push((async () => {
      let query = supabase.from("native_invoices").select("id,numero,issue_date,customer_name,total,status", { count: "exact" }).eq("kind", "invoice").order("issue_date", { ascending: false }).limit(limit);
      if (like) query = query.or(`numero.ilike.${esc(like)},customer_name.ilike.${esc(like)}`);
      if (input.year) query = query.gte("issue_date", `${input.year}-01-01`).lt("issue_date", `${input.year + 1}-01-01`);
      if (input.onlyPaid) query = query.eq("status", "paid");
      if (input.onlyReverted) return { rows: [], count: 0, src: "native" as const }; // no aplica a facturas nativas
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []).map((i) => ({ numero: i.numero, fecha: i.issue_date, cliente: i.customer_name, total: i.total, estado: NATIVE_STATUS_LABEL[i.status] || i.status, estadoRaw: i.status, origen: "nueva" as const, kind: "invoice" as const, id: i.id })), count: count ?? 0, src: "native" as const };
    })());
    queries.push((async () => {
      let query = supabase.from("erp_invoices_sale").select("numero,fecha,partner,total,estado_pago,importe_pagado,importe_adeudado,nota_pago,fecha_pago,fecha_vencimiento", { count: "exact" }).order("fecha", { ascending: false }).limit(limit);
      if (like) query = query.or(`numero.ilike.${esc(like)},partner.ilike.${esc(like)}`);
      if (input.year) query = query.gte("fecha", `${input.year}-01-01`).lt("fecha", `${input.year + 1}-01-01`);
      if (input.onlyPaid) query = query.in("estado_pago", ERP_PAID_STATES);
      if (input.onlyReverted) query = query.eq("estado_pago", "Revertido");
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []).map((i) => ({ numero: i.numero, fecha: i.fecha, cliente: i.partner, total: i.total, estado: displayEstadoPago(i.estado_pago), estadoRaw: i.estado_pago, origen: "odoo" as const, kind: "invoice" as const, importePagado: i.importe_pagado, importeAdeudado: i.importe_adeudado, notaPago: i.nota_pago, fechaPago: i.fecha_pago, fechaVencimiento: i.fecha_vencimiento })), count: count ?? 0, src: "erp" as const };
    })());
  }
  if (wantCreditNotes) {
    queries.push((async () => {
      let query = supabase.from("native_invoices").select("id,numero,issue_date,customer_name,total,status", { count: "exact" }).eq("kind", "credit_note").order("issue_date", { ascending: false }).limit(limit);
      if (like) query = query.or(`numero.ilike.${esc(like)},customer_name.ilike.${esc(like)}`);
      if (input.year) query = query.gte("issue_date", `${input.year}-01-01`).lt("issue_date", `${input.year + 1}-01-01`);
      if (input.onlyPaid) query = query.eq("status", "paid");
      if (input.onlyReverted) return { rows: [], count: 0, src: "native" as const };
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []).map((i) => ({ numero: i.numero, fecha: i.issue_date, cliente: i.customer_name, total: i.total, estado: NATIVE_STATUS_LABEL[i.status] || i.status, estadoRaw: i.status, origen: "nueva" as const, kind: "credit_note" as const, id: i.id })), count: count ?? 0, src: "native" as const };
    })());
    queries.push((async () => {
      let query = supabase.from("erp_credit_notes_sale").select("numero,fecha,partner,total,estado_pago", { count: "exact" }).order("fecha", { ascending: false }).limit(limit);
      if (like) query = query.or(`numero.ilike.${esc(like)},partner.ilike.${esc(like)}`);
      if (input.year) query = query.gte("fecha", `${input.year}-01-01`).lt("fecha", `${input.year + 1}-01-01`);
      if (input.onlyPaid) query = query.in("estado_pago", ERP_PAID_STATES);
      if (input.onlyReverted) query = query.eq("estado_pago", "Revertido");
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []).map((i) => ({ numero: i.numero, fecha: i.fecha, cliente: i.partner, total: i.total, estado: displayEstadoPago(i.estado_pago), estadoRaw: i.estado_pago, origen: "odoo" as const, kind: "credit_note" as const })), count: count ?? 0, src: "erp" as const };
    })());
  }

  let resultsArr;
  try { resultsArr = await Promise.all(queries); } catch (e) { return { ok: false, error: (e as Error).message }; }

  const rows = resultsArr.flatMap((r) => r.rows).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const nativeTotal = resultsArr.filter((r) => r.src === "native").reduce((s, r) => s + r.count, 0);
  const erpTotal = resultsArr.filter((r) => r.src === "erp").reduce((s, r) => s + r.count, 0);

  return { ok: true, rows: rows.slice(0, limit), nativeTotal, erpTotal };
}

export async function adminInvoiceHistoryYears(): Promise<Res & { years?: { year: number; count: number }[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const [a, b, c] = await Promise.all([
    supabase.from("native_invoices").select("issue_date").limit(20000),
    supabase.from("erp_invoices_sale").select("fecha").not("fecha", "is", null).limit(20000),
    supabase.from("erp_credit_notes_sale").select("fecha").not("fecha", "is", null).limit(20000),
  ]);
  const counts = new Map<number, number>();
  for (const src of [a, b, c]) {
    for (const r of src.data ?? []) {
      const dateVal = (r as { issue_date?: string; fecha?: string }).issue_date ?? (r as { fecha?: string }).fecha;
      if (!dateVal) continue;
      const y = new Date(dateVal).getFullYear();
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
  }
  const years = Array.from(counts.entries()).map(([year, count]) => ({ year, count })).sort((a, b) => b.year - a.year);
  return { ok: true, years };
}

export async function adminInvoicePdfUrl(invoiceId: string): Promise<Res & { url?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data: inv } = await supabase.from("native_invoices").select("pdf_path").eq("id", invoiceId).maybeSingle();
  if (!inv?.pdf_path) return { ok: false, error: "Esta factura no tiene PDF generado." };
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(inv.pdf_path, 300);
  if (error || !data) return { ok: false, error: error?.message || "No se pudo generar el enlace." };
  return { ok: true, url: data.signedUrl };
}

/* ---------------- Directorio de clientes y proveedores ---------------- */

export type Partner = {
  id: string; kind: "cliente" | "proveedor" | "ambos"; name: string; cif: string | null;
  email: string | null; phone: string | null; address: string | null; city: string | null;
  postal_code: string | null; province: string | null; country: string | null; notes: string | null;
  profile_id: string | null;
};

export async function adminPartnersCounts(): Promise<Res & { cliente?: number; proveedor?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const [c, p] = await Promise.all([
    supabase.from("partners").select("id", { count: "exact", head: true }).in("kind", ["cliente", "ambos"]),
    supabase.from("partners").select("id", { count: "exact", head: true }).in("kind", ["proveedor", "ambos"]),
  ]);
  return { ok: true, cliente: c.count ?? 0, proveedor: p.count ?? 0 };
}

export async function adminPartnersList(input: { kind?: "cliente" | "proveedor"; q?: string }): Promise<Res & { rows?: Partner[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  let query = supabase.from("partners").select("*").order("name");
  if (input.kind) query = query.in("kind", [input.kind, "ambos"]);
  if (input.q && input.q.trim().length >= 2) {
    const term = esc(`%${input.q.trim()}%`);
    query = query.or(`name.ilike.${term},cif.ilike.${term},email.ilike.${term}`);
  }
  const { data, error } = await query.limit(500);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as Partner[] };
}

export async function adminUpdatePartner(input: {
  id: string; cif: string | null; email: string | null; phone: string | null; address: string | null;
  city: string | null; postal_code: string | null; province: string | null; notes: string | null;
}): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { error } = await supabase.from("partners").update({
    cif: input.cif, email: input.email, phone: input.phone, address: input.address,
    city: input.city, postal_code: input.postal_code, province: input.province, notes: input.notes,
    updated_at: new Date().toISOString(),
  }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type PartnerInvoiceRow = { numero: string; fecha: string | null; total: number | null; estado: string | null };

/** Facturas (venta o compra) vinculadas a un partner por coincidencia de nombre en el histórico ERP. */
export async function adminPartnerInvoices(name: string, kind: "cliente" | "proveedor"): Promise<Res & { rows?: PartnerInvoiceRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const table = kind === "cliente" ? "erp_invoices_sale" : "erp_invoices_purchase";
  const { data, error } = await supabase.from(table).select("numero,fecha,total,estado").eq("partner", name).order("fecha", { ascending: false }).limit(300);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as PartnerInvoiceRow[] };
}

/* ---------------- Histórico ERP (Odoo) / Trazabilidad ---------------- */

export async function adminErpProductionOrdersYears(): Promise<Res & { years?: { year: number; count: number }[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error } = await supabase.from("erp_production_orders").select("fecha_final").not("fecha_final", "is", null).limit(20000);
  if (error) return { ok: false, error: error.message };
  const counts = new Map<number, number>();
  for (const r of data ?? []) { const y = new Date(r.fecha_final as string).getFullYear(); counts.set(y, (counts.get(y) ?? 0) + 1); }
  const years = Array.from(counts.entries()).map(([year, count]) => ({ year, count })).sort((a, b) => b.year - a.year);
  return { ok: true, years };
}

export type ProductionOrderByYearRow = { referencia: string; product_code: string | null; product_name: string | null; cantidad: number | null; estado: string | null; fecha_final: string | null; lote: string | null };
export async function adminErpProductionOrdersByYear(year: number, offset = 0, limit = 100): Promise<Res & { rows?: ProductionOrderByYearRow[]; total?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error, count } = await supabase.from("erp_production_orders")
    .select("referencia,product_code,product_name,cantidad,estado,fecha_final,lote", { count: "exact" })
    .gte("fecha_final", `${year}-01-01`).lt("fecha_final", `${year + 1}-01-01`)
    .order("fecha_final", { ascending: false }).range(offset, offset + limit - 1);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as ProductionOrderByYearRow[], total: count ?? 0 };
}

export type ErpSearchResult = {
  lots: { id: number; lote: string; product_code: string | null; product_name: string | null; cantidad: number | null; ubicacion: string | null; creado_el: string | null }[];
  orders: { referencia: string; product_code: string | null; product_name: string | null; cantidad: number | null; estado: string | null; fecha_final: string | null; lote: string | null }[];
  salesInvoices: { numero: string; partner: string | null; fecha: string | null; total: number | null; estado: string | null }[];
  purchaseInvoices: { numero: string; partner: string | null; fecha: string | null; total: number | null; estado: string | null }[];
  saleOrders: { referencia: string; cliente: string | null; fecha_pedido: string | null; total: number | null; estado: string | null; nota: string | null }[];
};

export async function adminErpSearch(query: string): Promise<Res & { result?: ErpSearchResult }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const q = query.trim();
  if (q.length < 2) return { ok: false, error: "Escribe al menos 2 caracteres." };
  const like = `%${q}%`;

  const [lots, orders, salesInvoices, purchaseInvoices, saleOrders] = await Promise.all([
    supabase.from("erp_stock_lots").select("id,lote,product_code,product_name,cantidad,ubicacion,creado_el")
      .or(`lote.ilike.${esc(like)},product_code.ilike.${esc(like)},product_name.ilike.${esc(like)}`)
      .order("creado_el", { ascending: false }).limit(30),
    supabase.from("erp_production_orders").select("referencia,product_code,product_name,cantidad,estado,fecha_final,lote")
      .or(`referencia.ilike.${esc(like)},lote.ilike.${esc(like)},product_code.ilike.${esc(like)},product_name.ilike.${esc(like)}`)
      .order("fecha_final", { ascending: false }).limit(30),
    supabase.from("erp_invoices_sale").select("numero,partner,fecha,total,estado")
      .or(`numero.ilike.${esc(like)},partner.ilike.${esc(like)}`)
      .order("fecha", { ascending: false }).limit(30),
    supabase.from("erp_invoices_purchase").select("numero,partner,fecha,total,estado")
      .or(`numero.ilike.${esc(like)},partner.ilike.${esc(like)}`)
      .order("fecha", { ascending: false }).limit(30),
    supabase.from("erp_sale_orders").select("referencia,cliente,fecha_pedido,total,estado,nota")
      .or(`referencia.ilike.${esc(like)},cliente.ilike.${esc(like)},referencia_cliente.ilike.${esc(like)}`)
      .order("fecha_pedido", { ascending: false }).limit(30),
  ]);

  return {
    ok: true,
    result: {
      lots: (lots.data ?? []) as ErpSearchResult["lots"],
      orders: (orders.data ?? []) as ErpSearchResult["orders"],
      salesInvoices: (salesInvoices.data ?? []) as ErpSearchResult["salesInvoices"],
      purchaseInvoices: (purchaseInvoices.data ?? []) as ErpSearchResult["purchaseInvoices"],
      saleOrders: (saleOrders.data ?? []) as ErpSearchResult["saleOrders"],
    },
  };
}

/** Si "lote" no tiene match exacto y es solo dígitos, busca la variante con ceros a la izquierda
 *  (Odoo suele guardar lotes numéricos como "0002448" aunque el usuario escriba "2448"). Comparación
 *  exacta por regex ^0*input$ para no confundir con lotes distintos que solo comparten sufijo. */
async function resolveCanonicalLote(
  supabase: Awaited<ReturnType<typeof adminClient>>,
  input: string
): Promise<string> {
  if (!supabase) return input;
  const [l, o, m] = await Promise.all([
    supabase.from("erp_stock_lots").select("lote").eq("lote", input).limit(1),
    supabase.from("erp_production_orders").select("lote").eq("lote", input).limit(1),
    supabase.from("erp_stock_moves").select("lote").eq("lote", input).limit(1),
  ]);
  if ((l.data ?? []).length || (o.data ?? []).length || (m.data ?? []).length) return input;
  if (!/^\d+$/.test(input)) return input;

  const pattern = `%${input}`;
  const [l2, o2, m2] = await Promise.all([
    supabase.from("erp_stock_lots").select("lote").ilike("lote", pattern).limit(50),
    supabase.from("erp_production_orders").select("lote").ilike("lote", pattern).limit(50),
    supabase.from("erp_stock_moves").select("lote").ilike("lote", pattern).limit(50),
  ]);
  const candidates = [...(l2.data ?? []), ...(o2.data ?? []), ...(m2.data ?? [])].map((r) => r.lote as string);
  const re = new RegExp(`^0*${input}$`);
  const match = candidates.find((c) => re.test(c));
  return match || input;
}

/** Historial completo de facturas de compra de un producto (materia prima/componente), independientemente
 *  del lote — para ver a qué proveedores se le ha comprado ese producto a lo largo del tiempo. */
export type PurchaseHistoryRow = {
  numero: string; referencia_proveedor: string | null; partner: string | null; fecha: string | null;
  cantidad: number | null; precio_unitario: number | null; subtotal: number | null;
};
export async function adminErpProductPurchaseHistory(productCode: string): Promise<Res & { rows?: PurchaseHistoryRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data: lines, error } = await supabase.from("erp_invoice_purchase_lines")
    .select("invoice_numero,cantidad,precio_unitario,subtotal")
    .eq("product_code", productCode)
    .limit(200);
  if (error) return { ok: false, error: error.message };
  const numeros = Array.from(new Set((lines ?? []).map((l) => l.invoice_numero).filter(Boolean))) as string[];
  if (!numeros.length) return { ok: true, rows: [] };
  const { data: invs } = await supabase.from("erp_invoices_purchase")
    .select("numero,referencia_proveedor,partner,fecha")
    .in("numero", numeros);
  const invMap = new Map((invs ?? []).map((i) => [i.numero, i]));
  const rows: PurchaseHistoryRow[] = (lines ?? []).map((l) => ({
    numero: l.invoice_numero as string,
    referencia_proveedor: invMap.get(l.invoice_numero as string)?.referencia_proveedor ?? null,
    partner: invMap.get(l.invoice_numero as string)?.partner ?? null,
    fecha: invMap.get(l.invoice_numero as string)?.fecha ?? null,
    cantidad: l.cantidad, precio_unitario: l.precio_unitario, subtotal: l.subtotal,
  })).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return { ok: true, rows };
}

export type ErpLoteDetail = {
  lote: { id: number; lote: string; product_code: string | null; product_name: string | null; cantidad: number | null; cantidad_real: number | null; ubicacion: string | null; creado_el: string | null; expiration_date: string | null; use_date: string | null; removal_date: string | null; alert_date: string | null } | null;
  orders: { referencia: string; product_code: string | null; product_name: string | null; cantidad: number | null; estado: string | null; fecha_inicio: string | null; fecha_final: string | null; bom: string | null }[];
  rawMaterials: { order_referencia: string; component_code: string | null; component_name: string | null; component_lote: string | null; cantidad: number | null }[];
  rawMaterialSales: { component_code: string | null; component_name: string | null; component_lote: string; numero: string; fecha: string | null; partner: string | null; delivery_referencia: string }[];
  components: { order_referencia: string | null; component_code: string | null; component_name: string | null; cantidad_consumida: number | null }[];
  moves: { id: number; referencia: string | null; desde: string | null; hasta: string | null; fecha: string | null; cantidad_hecha: number | null; estado: string | null }[];
  exactSales: { numero: string; fecha: string | null; partner: string | null; cantidad: number | null; product_code: string | null; product_name: string | null; delivery_referencia: string }[];
  relatedSales: { numero: string; fecha: string | null; partner: string | null; cantidad: number | null; product_code: string | null; product_name: string | null }[];
  qualityChecks: { id: number; punto_control: string | null; tipo_control: string | null; resultado: string | null; medida: number | null; nota: string | null; fecha_control: string | null; responsable: string | null; orden_fabricacion: string | null; lote: string | null; producto: string | null }[];
  qualityAlerts: { id: number; title: string | null; fecha_creacion: string | null; prioridad: string | null; causa_raiz: string | null; accion_correctiva: string | null }[];
};

/** Un mismo número de lote puede reutilizarse en distintos productos (granel reenvasado en varios
 *  formatos, etc.) — el ~34% de los lotes del histórico están compartidos. Esta función devuelve, para
 *  un número de lote (ya normalizado), los productos distintos a los que pertenece, para que el usuario
 *  desambigüe antes de generar el informe. */
export async function adminErpLoteCandidates(loteInput: string): Promise<Res & {
  canonicalLote?: string;
  candidates?: { product_code: string | null; product_name: string | null }[];
}> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const lote = await resolveCanonicalLote(supabase, loteInput.trim());
  const { data } = await supabase.from("erp_stock_lots").select("product_code,product_name").eq("lote", lote);
  let candidates = (data ?? []) as { product_code: string | null; product_name: string | null }[];
  if (!candidates.length) {
    // fallback: productos vistos en movimientos de stock para ese lote (por si no está en erp_stock_lots)
    const { data: mv } = await supabase.from("erp_stock_moves").select("product_code,product_name").eq("lote", lote).limit(200);
    const seen = new Map<string, { product_code: string | null; product_name: string | null }>();
    for (const m of mv ?? []) if (m.product_code && !seen.has(m.product_code)) seen.set(m.product_code, m);
    candidates = Array.from(seen.values());
  }
  return { ok: true, canonicalLote: lote, candidates };
}

/** Devuelve la cadena completa de trazabilidad ISO para un lote de producto (identificado por lote +
 *  código de producto, ya que el número de lote solo no es único): orden de fabricación, materias primas
 *  consumidas CON SU PROPIO LOTE (extraído de los movimientos de fabricación, no de la BOM genérica),
 *  lista de materiales de referencia, movimientos de stock y facturas de venta (exacto vía albarán →
 *  pedido de venta, con fallback aproximado por producto si no hay match exacto). */
/* ---------------- Calidad ---------------- */

export type QualityStats = {
  checksTotal: number; checksPass: number; checksFail: number; checksNone: number;
  alertsTotal: number; alertsOpen: number;
  lotsExpiredCount: number; lotsExpiringSoonCount: number;
};
export async function adminQualityStats(): Promise<Res & { stats?: QualityStats }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [pass, fail, none, alertsTotal, alertsOpen, lotsExpired, lotsSoon] = await Promise.all([
    supabase.from("erp_quality_checks").select("id", { count: "exact", head: true }).eq("resultado", "pass"),
    supabase.from("erp_quality_checks").select("id", { count: "exact", head: true }).eq("resultado", "fail"),
    supabase.from("erp_quality_checks").select("id", { count: "exact", head: true }).eq("resultado", "none"),
    supabase.from("erp_quality_alerts").select("id", { count: "exact", head: true }),
    supabase.from("erp_quality_alerts").select("id", { count: "exact", head: true }).is("fecha_cierre", null),
    supabase.from("erp_stock_lots").select("id", { count: "exact", head: true }).lt("expiration_date", today),
    supabase.from("erp_stock_lots").select("id", { count: "exact", head: true }).gte("expiration_date", today).lt("expiration_date", in30),
  ]);
  return {
    ok: true,
    stats: {
      checksTotal: (pass.count ?? 0) + (fail.count ?? 0) + (none.count ?? 0),
      checksPass: pass.count ?? 0, checksFail: fail.count ?? 0, checksNone: none.count ?? 0,
      alertsTotal: alertsTotal.count ?? 0, alertsOpen: alertsOpen.count ?? 0,
      lotsExpiredCount: lotsExpired.count ?? 0, lotsExpiringSoonCount: lotsSoon.count ?? 0,
    },
  };
}

export type QualityAlertRow = {
  id: number; title: string | null; description: string | null; fecha_creacion: string | null; fecha_cierre: string | null;
  lote: string | null; producto: string | null; orden_fabricacion: string | null; responsable: string | null;
  fase: string | null; prioridad: string | null; causa_raiz: string | null; accion_correctiva: string | null;
  accion_preventiva: string | null; proveedor: string | null; origen?: string;
};
export async function adminQualityAlerts(input: { q?: string; onlyOpen?: boolean }): Promise<Res & { rows?: QualityAlertRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  let query = supabase.from("erp_quality_alerts").select("*").order("fecha_creacion", { ascending: false }).limit(500);
  if (input.q && input.q.trim().length >= 2) {
    const like = `%${input.q.trim()}%`;
    query = query.or(`title.ilike.${esc(like)},lote.ilike.${esc(like)},orden_fabricacion.ilike.${esc(like)},producto.ilike.${esc(like)}`);
  }
  if (input.onlyOpen) query = query.is("fecha_cierre", null);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as QualityAlertRow[] };
}

export type QualityCheckRow = {
  id: number; punto_control: string | null; tipo_control: string | null; resultado: string | null;
  lote: string | null; orden_fabricacion: string | null; producto: string | null; medida: number | null;
  nota: string | null; fecha_control: string | null; responsable: string | null; origen?: string;
};
export async function adminQualityChecksSearch(input: { q?: string; resultado?: string; limit?: number }): Promise<Res & { rows?: QualityCheckRow[]; total?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (!input.q || input.q.trim().length < 2) return { ok: true, rows: [], total: 0 };
  const like = `%${input.q.trim()}%`;
  let query = supabase.from("erp_quality_checks").select("*", { count: "exact" })
    .or(`lote.ilike.${esc(like)},orden_fabricacion.ilike.${esc(like)},producto.ilike.${esc(like)}`)
    .order("fecha_control", { ascending: false }).limit(input.limit ?? 200);
  if (input.resultado) query = query.eq("resultado", input.resultado);
  const { data, error, count } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as QualityCheckRow[], total: count ?? 0 };
}

export type QualityPointRow = { codigo: string; titulo: string | null; tipo_control: string | null; norma: number | null; tolerancia_min: number | null; tolerancia_max: number | null; descripcion: string | null; origen?: string };
export async function adminQualityPoints(): Promise<Res & { rows?: QualityPointRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error } = await supabase.from("erp_quality_points").select("*").order("codigo");
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as QualityPointRow[] };
}

export async function adminChecksByPoint(codigo: string): Promise<Res & { rows?: QualityCheckRow[]; total?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const { data, error, count } = await supabase.from("erp_quality_checks").select("*", { count: "exact" })
    .eq("punto_control", codigo).order("fecha_control", { ascending: false }).limit(100);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as QualityCheckRow[], total: count ?? 0 };
}

/* ---- Crear / editar puntos de control ---- */
export async function adminSaveQualityPoint(input: {
  codigo?: string | null; titulo: string; tipo_control: string | null; norma: number | null;
  tolerancia_min: number | null; tolerancia_max: number | null; descripcion: string | null;
}): Promise<Res & { codigo?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (!input.titulo.trim()) return { ok: false, error: "El título es obligatorio." };

  if (input.codigo) {
    const { error } = await supabase.from("erp_quality_points").update({
      titulo: input.titulo.trim(), tipo_control: input.tipo_control, norma: input.norma,
      tolerancia_min: input.tolerancia_min, tolerancia_max: input.tolerancia_max, descripcion: input.descripcion,
      updated_at: new Date().toISOString(),
    }).eq("codigo", input.codigo);
    if (error) return { ok: false, error: error.message };
    return { ok: true, codigo: input.codigo };
  }

  const { count } = await supabase.from("erp_quality_points").select("codigo", { count: "exact", head: true });
  let codigo = `QCW${String((count ?? 0) + 1).padStart(5, "0")}`;
  // aseguramos que no colisione con uno existente
  for (let i = 0; i < 20; i++) {
    const { data: exists } = await supabase.from("erp_quality_points").select("codigo").eq("codigo", codigo).maybeSingle();
    if (!exists) break;
    codigo = `QCW${String((count ?? 0) + 1 + i + 1).padStart(5, "0")}`;
  }
  const { error } = await supabase.from("erp_quality_points").insert({
    codigo, titulo: input.titulo.trim(), tipo_control: input.tipo_control, norma: input.norma,
    tolerancia_min: input.tolerancia_min, tolerancia_max: input.tolerancia_max, descripcion: input.descripcion,
    origen: "web", updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, codigo };
}

/* ---- Registrar / editar controles de calidad (tests) ---- */
export async function adminSaveQualityCheck(input: {
  id?: number | null; punto_control: string; tipo_control?: string | null; resultado: string;
  lote?: string | null; orden_fabricacion?: string | null; producto?: string | null;
  medida?: number | null; nota?: string | null; fecha_control: string; responsable?: string | null;
}): Promise<Res & { id?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (!input.punto_control.trim()) return { ok: false, error: "Indica el punto de control." };
  if (!input.fecha_control) return { ok: false, error: "Indica la fecha del control." };

  const payload = {
    punto_control: input.punto_control.trim(), tipo_control: input.tipo_control || null, resultado: input.resultado,
    lote: input.lote || null, orden_fabricacion: input.orden_fabricacion || null, producto: input.producto || null,
    medida: input.medida ?? null, nota: input.nota || null, fecha_control: input.fecha_control,
    responsable: input.responsable || null, updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("erp_quality_checks").update(payload).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase.from("erp_quality_checks").insert({ ...payload, origen: "web" }).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/* ---- Crear / editar alertas de calidad ---- */
export async function adminSaveQualityAlert(input: {
  id?: number | null; title: string; description?: string | null; fecha_creacion?: string | null; fecha_cierre?: string | null;
  lote?: string | null; producto?: string | null; orden_fabricacion?: string | null; responsable?: string | null;
  fase?: string | null; prioridad?: string | null; causa_raiz?: string | null; accion_correctiva?: string | null;
  accion_preventiva?: string | null; proveedor?: string | null;
}): Promise<Res & { id?: number }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  if (!input.title.trim()) return { ok: false, error: "El título es obligatorio." };

  const payload = {
    title: input.title.trim(), description: input.description || null,
    fecha_cierre: input.fecha_cierre || null, lote: input.lote || null, producto: input.producto || null,
    orden_fabricacion: input.orden_fabricacion || null, responsable: input.responsable || null, fase: input.fase || null,
    prioridad: input.prioridad || null, causa_raiz: input.causa_raiz || null, accion_correctiva: input.accion_correctiva || null,
    accion_preventiva: input.accion_preventiva || null, proveedor: input.proveedor || null, updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("erp_quality_alerts").update(payload).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase.from("erp_quality_alerts").insert({
    ...payload, fecha_creacion: input.fecha_creacion || new Date().toISOString(), origen: "web",
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/* ---- Editar fechas de caducidad de un lote ---- */
export async function adminUpdateLotDates(input: {
  lote: string; product_code?: string | null;
  expiration_date: string | null; use_date: string | null; removal_date: string | null; alert_date: string | null;
}): Promise<Res> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  let query = supabase.from("erp_stock_lots").update({
    expiration_date: input.expiration_date, use_date: input.use_date,
    removal_date: input.removal_date, alert_date: input.alert_date,
    dates_updated_at: new Date().toISOString(),
  }).eq("lote", input.lote);
  if (input.product_code) query = query.eq("product_code", input.product_code);
  const { error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type ExpiringLotRow = { lote: string; product_name: string | null; product_code: string | null; cantidad: number | null; expiration_date: string | null; use_date: string | null; ubicacion: string | null; vencido: boolean };
export async function adminExpiringLots(input: { onlyExpired?: boolean; days?: number }): Promise<Res & { rows?: ExpiringLotRow[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + (input.days ?? 60) * 86400000).toISOString().slice(0, 10);
  let query = supabase.from("erp_stock_lots").select("lote,product_name,product_code,cantidad,expiration_date,use_date,ubicacion")
    .not("expiration_date", "is", null).gt("cantidad", 0).order("expiration_date", { ascending: true }).limit(500);
  query = input.onlyExpired ? query.lt("expiration_date", today) : query.lt("expiration_date", horizon);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []).map((l) => ({ ...l, vencido: !!l.expiration_date && l.expiration_date < today })) as ExpiringLotRow[] };
}

export async function adminErpLoteDetail(loteInput: string, productCode?: string): Promise<Res & { detail?: ErpLoteDetail; canonicalLote?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const lote = await resolveCanonicalLote(supabase, loteInput.trim());

  let lotQuery = supabase.from("erp_stock_lots").select("id,lote,product_code,product_name,cantidad,cantidad_real,ubicacion,creado_el,expiration_date,use_date,removal_date,alert_date").eq("lote", lote);
  let ordersQuery = supabase.from("erp_production_orders").select("referencia,product_code,product_name,cantidad,estado,fecha_inicio,fecha_final,bom").eq("lote", lote);
  let movesQuery = supabase.from("erp_stock_moves").select("id,referencia,desde,hasta,fecha,cantidad_hecha,estado,product_code").eq("lote", lote).order("fecha", { ascending: true }).limit(200);
  if (productCode) {
    lotQuery = lotQuery.eq("product_code", productCode);
    ordersQuery = ordersQuery.eq("product_code", productCode);
    movesQuery = movesQuery.eq("product_code", productCode);
  }
  const [lotRes, ordersRes, movesRaw] = await Promise.all([lotQuery.limit(1).maybeSingle(), ordersQuery, movesQuery]);
  const movesData = (movesRaw.data ?? []) as (ErpLoteDetail["moves"][number] & { product_code?: string | null })[];

  const orderRefs = Array.from(new Set([
    ...(ordersRes.data ?? []).map((o) => o.referencia),
    // también las órdenes vistas en los movimientos de recepción de este lote (desde=Production)
    ...movesData.filter((m) => (m.desde || "").includes("Production")).map((m) => m.referencia),
  ].filter(Boolean))) as string[];

  let components: ErpLoteDetail["components"] = [];
  let rawMaterials: ErpLoteDetail["rawMaterials"] = [];
  if (orderRefs.length) {
    const [compRes, rawRes] = await Promise.all([
      supabase.from("erp_production_components").select("order_referencia,component_code,component_name,cantidad_consumida").in("order_referencia", orderRefs),
      // consumo real de materia prima CON LOTE: movimientos hacia "Virtual Locations/Production" de esas mismas órdenes
      supabase.from("erp_stock_moves").select("referencia,product_code,product_name,lote,cantidad_hecha").in("referencia", orderRefs).ilike("hasta", "%Production%"),
    ]);
    components = (compRes.data ?? []) as ErpLoteDetail["components"];
    rawMaterials = (rawRes.data ?? []).map((m) => ({
      order_referencia: m.referencia as string,
      component_code: m.product_code,
      component_name: m.product_name,
      component_lote: m.lote,
      cantidad: m.cantidad_hecha,
    }));
  }

  // ---- Facturas de venta de los propios lotes de materia prima (por si esa materia prima/granel
  // también se vendió tal cual, además de consumirse en fabricación) — misma cadena exacta que arriba. ----
  let rawMaterialSales: ErpLoteDetail["rawMaterialSales"] = [];
  const rmPairs = Array.from(new Map(
    rawMaterials.filter((r) => r.component_lote && r.component_code)
      .map((r) => [`${r.component_lote}|${r.component_code}`, r])
  ).values());
  if (rmPairs.length) {
    const rmLotes = Array.from(new Set(rmPairs.map((r) => r.component_lote as string)));
    const { data: rmMoves } = await supabase.from("erp_stock_moves")
      .select("referencia,lote,product_code")
      .in("lote", rmLotes)
      .ilike("hasta", "%Customer%");
    const rmOutbound = (rmMoves ?? []).filter((m) =>
      rmPairs.some((p) => p.component_lote === m.lote && p.component_code === m.product_code)
    );
    const rmDeliveryRefs = Array.from(new Set(rmOutbound.map((m) => m.referencia).filter(Boolean))) as string[];
    if (rmDeliveryRefs.length) {
      const { data: rmDeliveries } = await supabase.from("erp_deliveries").select("referencia,documento_origen").in("referencia", rmDeliveryRefs);
      const rmOrigenes = Array.from(new Set((rmDeliveries ?? []).map((d) => d.documento_origen).filter(Boolean))) as string[];
      if (rmOrigenes.length) {
        const { data: rmInvs } = await supabase.from("erp_invoices_sale").select("numero,fecha,partner,origen").in("origen", rmOrigenes);
        const refToOrigen = new Map((rmDeliveries ?? []).map((d) => [d.referencia, d.documento_origen]));
        const origenToDeliveryRefs = new Map<string, string[]>();
        for (const d of rmDeliveries ?? []) {
          if (!d.documento_origen) continue;
          const arr = origenToDeliveryRefs.get(d.documento_origen) ?? [];
          arr.push(d.referencia);
          origenToDeliveryRefs.set(d.documento_origen, arr);
        }
        for (const inv of rmInvs ?? []) {
          const candidateRefs = origenToDeliveryRefs.get(inv.origen as string) ?? [];
          for (const ref of candidateRefs) {
            const moves = rmOutbound.filter((m) => m.referencia === ref);
            for (const mv of moves) {
              const pair = rmPairs.find((p) => p.component_lote === mv.lote && p.component_code === mv.product_code);
              if (!pair) continue;
              rawMaterialSales.push({
                component_code: pair.component_code, component_name: pair.component_name,
                component_lote: mv.lote as string, numero: inv.numero, fecha: inv.fecha, partner: inv.partner,
                delivery_referencia: ref,
              });
            }
          }
        }
      }
    }
  }

  // ---- Cadena EXACTA de venta: lote+producto -> albarán de salida -> documento origen -> factura ----
  const outboundMoves = movesData.filter((m) => (m.hasta || "").toLowerCase().includes("customer") && m.referencia);
  const deliveryRefs = Array.from(new Set(outboundMoves.map((m) => m.referencia as string)));
  const resolvedProductCode = productCode || lotRes.data?.product_code || (ordersRes.data ?? [])[0]?.product_code || null;
  const resolvedProductName = lotRes.data?.product_name || (ordersRes.data ?? [])[0]?.product_name || null;

  let exactSales: ErpLoteDetail["exactSales"] = [];
  const matchedInvoiceNumeros = new Set<string>();
  if (deliveryRefs.length) {
    const { data: deliveries } = await supabase.from("erp_deliveries").select("referencia,documento_origen").in("referencia", deliveryRefs);
    const origenes = Array.from(new Set((deliveries ?? []).map((d) => d.documento_origen).filter(Boolean))) as string[];
    if (origenes.length) {
      const { data: invs } = await supabase.from("erp_invoices_sale").select("numero,fecha,partner,origen").in("origen", origenes);
      const refToOrigen = new Map((deliveries ?? []).map((d) => [d.referencia, d.documento_origen]));
      for (const inv of invs ?? []) {
        const deliveryRef = deliveryRefs.find((r) => refToOrigen.get(r) === inv.origen);
        exactSales.push({
          numero: inv.numero, fecha: inv.fecha, partner: inv.partner,
          cantidad: null, product_code: resolvedProductCode, product_name: resolvedProductName,
          delivery_referencia: deliveryRef || "",
        });
        matchedInvoiceNumeros.add(inv.numero);
      }
      exactSales.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    }
  }

  // ---- Fallback aproximado por producto (solo si no hubo match exacto) ----
  let relatedSales: ErpLoteDetail["relatedSales"] = [];
  if (resolvedProductCode && !exactSales.length) {
    const { data } = await supabase.from("erp_invoice_sale_lines")
      .select("invoice_numero,cantidad,product_code,product_name")
      .eq("product_code", resolvedProductCode)
      .limit(100);
    const numeros = Array.from(new Set((data ?? []).map((l) => l.invoice_numero).filter((n) => n && !matchedInvoiceNumeros.has(n)))) as string[];
    if (numeros.length) {
      const { data: invs } = await supabase.from("erp_invoices_sale").select("numero,fecha,partner").in("numero", numeros);
      const invMap = new Map((invs ?? []).map((i) => [i.numero, i]));
      relatedSales = (data ?? [])
        .filter((l) => l.invoice_numero && !matchedInvoiceNumeros.has(l.invoice_numero))
        .map((l) => ({
          numero: l.invoice_numero as string,
          fecha: invMap.get(l.invoice_numero as string)?.fecha ?? null,
          partner: invMap.get(l.invoice_numero as string)?.partner ?? null,
          cantidad: l.cantidad,
          product_code: l.product_code,
          product_name: l.product_name,
        })).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    }
  }

  // ---- Controles y alertas de calidad de este lote / sus órdenes de fabricación ----
  const qualityRefs = Array.from(new Set([lote, ...orderRefs].filter(Boolean))) as string[];
  const [qcRes, qaRes] = await Promise.all([
    supabase.from("erp_quality_checks").select("id,punto_control,tipo_control,resultado,medida,nota,fecha_control,responsable,orden_fabricacion,lote,producto")
      .or(`lote.eq.${esc(lote)},orden_fabricacion.in.(${orderRefs.map((r) => `"${r}"`).join(",") || '""'})`)
      .order("fecha_control", { ascending: true }).limit(200),
    supabase.from("erp_quality_alerts").select("id,title,fecha_creacion,prioridad,causa_raiz,accion_correctiva")
      .or(`lote.eq.${esc(lote)},orden_fabricacion.in.(${orderRefs.map((r) => `"${r}"`).join(",") || '""'})`)
      .order("fecha_creacion", { ascending: false }),
  ]);

  return {
    ok: true,
    canonicalLote: lote,
    detail: {
      lote: (lotRes.data ?? null) as ErpLoteDetail["lote"],
      orders: (ordersRes.data ?? []) as ErpLoteDetail["orders"],
      rawMaterials,
      rawMaterialSales,
      components,
      moves: movesData,
      exactSales,
      relatedSales,
      qualityChecks: (qcRes.data ?? []) as ErpLoteDetail["qualityChecks"],
      qualityAlerts: (qaRes.data ?? []) as ErpLoteDetail["qualityAlerts"],
    },
  };
}
