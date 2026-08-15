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

/** Edición completa de la ficha de producto (todos los campos salvo el stock, que se gestiona desde Inventario). */
export async function adminUpdateProductFull(input: {
  id: string; slug: string; brand: string; name: string; category: string; family: string | null;
  size: string | null; sku: string; barcode: string | null; description: string | null; inci: string | null;
  inci_verified: boolean; public_price: number; vat_rate: number; units_per_box: number | null;
  weight_kg: number | null; low_stock_threshold: number; active: boolean; image_url: string | null;
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

/* ---------------- Directorio de clientes y proveedores ---------------- */

export type Partner = {
  id: string; kind: "cliente" | "proveedor" | "ambos"; name: string; cif: string | null;
  email: string | null; phone: string | null; address: string | null; city: string | null;
  postal_code: string | null; province: string | null; country: string | null; notes: string | null;
  profile_id: string | null;
};

export async function adminPartnersList(input: { kind?: "cliente" | "proveedor"; q?: string }): Promise<Res & { rows?: Partner[] }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  let query = supabase.from("partners").select("*").order("name");
  if (input.kind) query = query.in("kind", [input.kind, "ambos"]);
  if (input.q && input.q.trim().length >= 2) query = query.or(`name.ilike.%${input.q}%,cif.ilike.%${input.q}%,email.ilike.%${input.q}%`);
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

export type ErpSearchResult = {
  lots: { id: number; lote: string; product_code: string | null; product_name: string | null; cantidad: number | null; ubicacion: string | null; creado_el: string | null }[];
  orders: { referencia: string; product_code: string | null; product_name: string | null; cantidad: number | null; estado: string | null; fecha_final: string | null; lote: string | null }[];
  salesInvoices: { numero: string; partner: string | null; fecha: string | null; total: number | null; estado: string | null }[];
  purchaseInvoices: { numero: string; partner: string | null; fecha: string | null; total: number | null; estado: string | null }[];
};

export async function adminErpSearch(query: string): Promise<Res & { result?: ErpSearchResult }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const q = query.trim();
  if (q.length < 2) return { ok: false, error: "Escribe al menos 2 caracteres." };
  const like = `%${q}%`;

  const [lots, orders, salesInvoices, purchaseInvoices] = await Promise.all([
    supabase.from("erp_stock_lots").select("id,lote,product_code,product_name,cantidad,ubicacion,creado_el")
      .or(`lote.ilike.${like},product_code.ilike.${like},product_name.ilike.${like}`)
      .order("creado_el", { ascending: false }).limit(30),
    supabase.from("erp_production_orders").select("referencia,product_code,product_name,cantidad,estado,fecha_final,lote")
      .or(`referencia.ilike.${like},lote.ilike.${like},product_code.ilike.${like},product_name.ilike.${like}`)
      .order("fecha_final", { ascending: false }).limit(30),
    supabase.from("erp_invoices_sale").select("numero,partner,fecha,total,estado")
      .or(`numero.ilike.${like},partner.ilike.${like}`)
      .order("fecha", { ascending: false }).limit(30),
    supabase.from("erp_invoices_purchase").select("numero,partner,fecha,total,estado")
      .or(`numero.ilike.${like},partner.ilike.${like}`)
      .order("fecha", { ascending: false }).limit(30),
  ]);

  return {
    ok: true,
    result: {
      lots: (lots.data ?? []) as ErpSearchResult["lots"],
      orders: (orders.data ?? []) as ErpSearchResult["orders"],
      salesInvoices: (salesInvoices.data ?? []) as ErpSearchResult["salesInvoices"],
      purchaseInvoices: (purchaseInvoices.data ?? []) as ErpSearchResult["purchaseInvoices"],
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
  lote: { id: number; lote: string; product_code: string | null; product_name: string | null; cantidad: number | null; cantidad_real: number | null; ubicacion: string | null; creado_el: string | null } | null;
  orders: { referencia: string; product_code: string | null; product_name: string | null; cantidad: number | null; estado: string | null; fecha_inicio: string | null; fecha_final: string | null; bom: string | null }[];
  rawMaterials: { order_referencia: string; component_code: string | null; component_name: string | null; component_lote: string | null; cantidad: number | null }[];
  rawMaterialSales: { component_code: string | null; component_name: string | null; component_lote: string; numero: string; fecha: string | null; partner: string | null; delivery_referencia: string }[];
  components: { order_referencia: string | null; component_code: string | null; component_name: string | null; cantidad_consumida: number | null }[];
  moves: { id: number; referencia: string | null; desde: string | null; hasta: string | null; fecha: string | null; cantidad_hecha: number | null; estado: string | null }[];
  exactSales: { numero: string; fecha: string | null; partner: string | null; cantidad: number | null; product_code: string | null; product_name: string | null; delivery_referencia: string }[];
  relatedSales: { numero: string; fecha: string | null; partner: string | null; cantidad: number | null; product_code: string | null; product_name: string | null }[];
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
export async function adminErpLoteDetail(loteInput: string, productCode?: string): Promise<Res & { detail?: ErpLoteDetail; canonicalLote?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "No autorizado." };
  const lote = await resolveCanonicalLote(supabase, loteInput.trim());

  let lotQuery = supabase.from("erp_stock_lots").select("id,lote,product_code,product_name,cantidad,cantidad_real,ubicacion,creado_el").eq("lote", lote);
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
    },
  };
}
