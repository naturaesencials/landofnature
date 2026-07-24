/* Tipos y cálculos de contratos de distribución y facturación.
   Las fórmulas replican las cláusulas del contrato de delegación:
   compra mínima, objetivos anuales, descuentos por volumen, plazos de pago
   y comisión por ventas directas del proveedor en el territorio. */

export type Tariff = { code: string; name: string; sort: number };

export type Contract = {
  id: string;
  client_id: string;
  title: string;
  contract_type: "delegacion" | "distribucion" | "subdistribucion" | "cliente";
  territory: string | null;
  channel: string | null;
  exclusive: boolean;
  start_date: string;
  duration_months: number;
  renewal_months: number;
  notice_days: number;
  tariff_code: string | null;
  resale_floor_tariff_code: string | null;
  discount_pct: number;
  discount_threshold: number | null;
  discount_pct_above: number | null;
  min_purchase_amount: number;
  min_purchase_period: "month" | "quarter" | "semester" | "year";
  grace_months: number;
  compensation_period: "quarter" | "semester" | "year";
  payment_terms_days: number;
  payment_note: string | null;
  direct_sales_commission_pct: number;
  commission_settlement: "monthly" | "quarterly" | "yearly";
  commission_excludes_shipping: boolean;
  noncompete_years: number | null;
  hub_min_pct: number | null;
  hub_max_pct: number | null;
  min_stock_note: string | null;
  notes: string | null;
  status: "draft" | "active" | "expired" | "terminated";
  document_path: string | null;
};

export type ContractTarget = { id: string; contract_id: string; year: number; minimum: number; objective: number };

export type Commission = {
  id: string; contract_id: string; period_year: number; period_no: number;
  base_amount: number; pct: number; amount: number;
  status: "pending" | "settled"; settled_at: string | null; notes: string | null;
};

export type Invoice = {
  id: string;
  direction: "sale" | "purchase";
  number: string | null;
  client_id: string | null;
  counterparty: string | null;
  concept: string | null;
  category: string | null;
  issue_date: string;
  due_date: string | null;
  base: number; vat: number; total: number; paid_amount: number;
  status: "pending" | "partial" | "paid" | "cancelled";
  file_path: string | null;
  notes: string | null;
};

export type Payment = { id: string; invoice_id: string; paid_on: string; amount: number; method: string | null; reference: string | null };

/* ---------- utilidades de fecha ---------- */

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); // corrige meses cortos
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const fdateES = (iso: string | null) =>
  !iso ? "—" : new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

export const today = () => new Date().toISOString().slice(0, 10);

/* ---------- vigencia (cl. 25) ---------- */

export function contractEnd(c: Pick<Contract, "start_date" | "duration_months">): string {
  return addMonths(c.start_date, c.duration_months || 0);
}
export function contractRenewalEnd(c: Pick<Contract, "start_date" | "duration_months" | "renewal_months">): string {
  return addMonths(contractEnd(c), c.renewal_months || 0);
}
export function daysLeft(iso: string): number {
  const ms = new Date(iso + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime();
  return Math.round(ms / 86400000);
}

/* ---------- compra mínima (cl. 3) ---------- */

export const PERIOD_MONTHS: Record<string, number> = { month: 1, quarter: 3, semester: 6, year: 12 };
export const PERIOD_LABEL: Record<string, string> = { month: "mensual", quarter: "trimestral", semester: "semestral", year: "anual" };

/** Inicio del periodo de compra mínima que contiene la fecha dada. */
export function periodStart(period: string, ref = today()): string {
  const d = new Date(ref + "T00:00:00");
  const step = PERIOD_MONTHS[period] || 1;
  const m = Math.floor(d.getMonth() / step) * step;
  return `${d.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`;
}
export function periodEnd(period: string, ref = today()): string {
  return addDays(addMonths(periodStart(period, ref), PERIOD_MONTHS[period] || 1), -1);
}

/** ¿Sigue el contrato dentro de la carencia inicial? (cl. 3: carencia de 3 meses) */
export function inGrace(c: Pick<Contract, "start_date" | "grace_months">, ref = today()): boolean {
  if (!c.grace_months) return false;
  return ref < addMonths(c.start_date, c.grace_months);
}

export type MinPurchaseStatus = {
  required: number; purchased: number; deficit: number; pct: number;
  from: string; to: string; grace: boolean;
};

export function minPurchaseStatus(c: Contract, purchasedInPeriod: number, ref = today()): MinPurchaseStatus {
  const grace = inGrace(c, ref);
  const required = grace ? 0 : Number(c.min_purchase_amount || 0);
  const purchased = Number(purchasedInPeriod || 0);
  return {
    required, purchased,
    deficit: Math.max(0, round2(required - purchased)),
    pct: required > 0 ? Math.round((purchased / required) * 100) : 100,
    from: periodStart(c.min_purchase_period, ref),
    to: periodEnd(c.min_purchase_period, ref),
    grace,
  };
}

/* ---------- descuentos por volumen (cl. 3) ---------- */

/** Descuento aplicable según el acumulado de compras del año. */
export function applicableDiscount(c: Contract, accumulatedYear: number): { pct: number; next: number | null; toNext: number } {
  const base = Number(c.discount_pct || 0);
  const th = c.discount_threshold != null ? Number(c.discount_threshold) : null;
  const above = c.discount_pct_above != null ? Number(c.discount_pct_above) : null;
  if (th == null || above == null) return { pct: base, next: null, toNext: 0 };
  if (accumulatedYear >= th) return { pct: above, next: null, toNext: 0 };
  return { pct: base, next: above, toNext: round2(th - accumulatedYear) };
}

export const applyDiscount = (amount: number, pct: number) => round2(amount * (1 - pct / 100));

/* ---------- objetivos anuales (cl. 3) ---------- */

export type TargetProgress = { year: number; minimum: number; objective: number; sales: number; pctMin: number; pctObj: number };

export function targetProgress(t: ContractTarget, sales: number): TargetProgress {
  const min = Number(t.minimum || 0), obj = Number(t.objective || 0);
  return {
    year: t.year, minimum: min, objective: obj, sales: round2(sales),
    pctMin: min > 0 ? Math.round((sales / min) * 100) : 0,
    pctObj: obj > 0 ? Math.round((sales / obj) * 100) : 0,
  };
}

/* ---------- comisión por ventas directas (cl. 15, 19, 21) ---------- */

export const COMMISSION_PERIODS: Record<string, number> = { monthly: 12, quarterly: 4, yearly: 1 };

export function commissionAmount(base: number, pct: number): number {
  return round2(Number(base || 0) * (Number(pct || 0) / 100));
}

/** Liquidación: a más tardar al final del mes siguiente al cierre del periodo (cl. 21). */
export function commissionDueDate(settlement: string, year: number, periodNo: number): string {
  const per = COMMISSION_PERIODS[settlement] || 4;
  const monthsPerPeriod = 12 / per;
  const endMonth = Math.min(12, Math.round(periodNo * monthsPerPeriod)); // 1..12
  const start = `${year}-${String(endMonth).padStart(2, "0")}-01`;
  return addDays(addMonths(start, 2), -1); // fin del mes siguiente al cierre
}

export function commissionPeriodLabel(settlement: string, year: number, periodNo: number): string {
  if (settlement === "yearly") return `Año ${year}`;
  if (settlement === "monthly") {
    const d = new Date(`${year}-${String(periodNo).padStart(2, "0")}-01T00:00:00`);
    return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  }
  return `T${periodNo} ${year}`;
}

export function currentPeriodNo(settlement: string, ref = today()): number {
  const m = new Date(ref + "T00:00:00").getMonth() + 1;
  if (settlement === "yearly") return 1;
  if (settlement === "monthly") return m;
  return Math.ceil(m / 3);
}

/* ---------- facturas ---------- */

export function invoiceDueDate(issue: string, termsDays: number): string {
  return addDays(issue, Math.max(0, termsDays || 0));
}

export const invoiceOutstanding = (i: Invoice) =>
  i.status === "cancelled" ? 0 : Math.max(0, round2(Number(i.total || 0) - Number(i.paid_amount || 0)));

export function isOverdue(i: Invoice, ref = today()): boolean {
  if (i.status === "paid" || i.status === "cancelled") return false;
  return !!i.due_date && i.due_date < ref && invoiceOutstanding(i) > 0;
}

export const INVOICE_STATUS: Record<string, string> = {
  pending: "Pendiente", partial: "Parcial", paid: "Pagada", cancelled: "Anulada",
};

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
