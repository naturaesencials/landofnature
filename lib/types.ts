export type Product = {
  id: string; slug: string; brand: string; name: string; category: string;
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
  return s === "out" ? "Agotado" : s === "low" ? `Últimas ${p.stock}` : "En stock";
}
export const euro = (n: number) => n.toFixed(2).replace(".", ",") + " €";
