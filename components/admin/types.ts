export type Prod = {
  id: string; brand: string; name: string; size: string | null; sku: string;
  public_price: number; stock: number; active: boolean; units_per_box: number | null;
  family: string | null; category: string; barcode?: string | null; image_url?: string | null;
};

export type Warehouse = { id: string; name: string; sort: number };
export type InventoryLevel = { product_id: string; warehouse_id: string; on_hand: number };

export type OrderItem = { name_snapshot: string; qty: number; unit_price: number };

export type Order = {
  id: string; order_no: number; created_at: string; client_id: string | null;
  name: string | null; email: string | null; phone: string | null;
  address: string | null; postal_code: string | null; city: string | null;
  province: string | null; country: string | null;
  payment_method: string | null; status: string; total: number; shipping: number | null;
  carrier: string | null; carrier_name: string | null; tracking_number: string | null;
  tracking_url: string | null; shipped_at: string | null; order_items: OrderItem[];
};

export type Req = {
  id: string; contact_name: string | null; company: string | null; cif: string | null;
  business_type: string | null; email: string | null; phone: string | null;
  message: string | null; status: string; created_at: string;
};

export type Client = {
  id: string; full_name: string | null; company: string | null; cif: string | null;
  phone: string | null; tariff_code: string | null; status: string | null;
  allow_transfer: boolean; commercial_agreement: boolean;
  gc_mandate_status: string | null; created_at: string;
};

export type TariffPrice = { product_id: string; tariff_code: string; price: number };

/** Pedido reducido para los cálculos de contrato (compras del cliente). */
export type ClientOrder = { client_id: string; created_at: string; total: number; status: string };

export const fdate = (s: string) =>
  new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

export const ORDER_STATES: Record<string, string> = {
  pending_payment: "Pendiente de pago", paid: "Pagado", confirmed: "Recepción confirmada",
  preparing: "En preparación", shipped: "Enviado", cancelled: "Cancelado",
};

/** Estados que cuentan como compra efectiva a efectos de mínimos y objetivos. */
export const COUNTS_AS_PURCHASE = ["paid", "confirmed", "preparing", "shipped"];

export const num = (s: string) => {
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const clientLabel = (c: Client) => c.company || c.full_name || "—";
