export type Product = {
  id: string; slug: string; brand: string; name: string; family: string | null; category: string;
  size: string | null; sku: string; description: string | null;
  inci: string | null; inci_verified: boolean; public_price: number;
  vat_rate: number; units_per_box: number | null;
  stock: number; low_stock_threshold: number; active: boolean; image_url: string | null;
};
export const VAT = 0.21;
export const vatOf = (n: number, rate = VAT) => Math.round(n * rate * 100) / 100;
export const withVat = (n: number, rate = VAT) => Math.round(n * (1 + rate) * 100) / 100;
export type StockState = "in" | "low" | "out";
export function stockState(p: { stock: number; low_stock_threshold: number }): StockState {
  if (p.stock <= 0) return "out";
  if (p.stock <= p.low_stock_threshold) return "low";
  return "in";
}
export function stockLabel(p: { stock: number; low_stock_threshold: number }): string {
  const s = stockState(p);
  return s === "out" ? "No disponible" : s === "low" ? `Últimas ${p.stock}` : "En stock";
}
export const euro = (n: number) => n.toFixed(2).replace(".", ",") + " €";

// Formato de caja legible y claro, p. ej. "Caja · 6 botellas de 1 L"
export function boxLabel(p: { size: string | null; units_per_box: number | null }): string {
  const s = (p.size || "").toLowerCase();
  const u = p.units_per_box;
  let env = "";
  if (/\b1\s*l\b/.test(s) || /\b1l\b/.test(s)) env = "botellas de 1 L";
  else if (/300\s*ml/.test(s)) env = "botellas de 300 ml";
  else if (/450\s*ml/.test(s)) env = "botellas de 450 ml";
  else if (/bolsa/.test(s)) env = "bolsas dispensador";
  else if (/(5\s*l).*(jerrican|garrafa)|jerrican|garrafa/.test(s)) env = "garrafas de 5 L";
  else if (/bib/.test(s)) env = "BiB de 5 L";
  if (u && env) return `Caja · ${u} ${env}`;
  if (u) return `Caja · ${u} unidades`;
  return p.size || "Caja";
}
