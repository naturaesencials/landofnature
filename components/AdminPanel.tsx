"use client";
import { useState, Fragment } from "react";
import { euro, boxLabel } from "@/lib/types";
import type { Tariff, Contract, ContractTarget, Commission, Invoice, Payment } from "@/lib/contracts";
import type { Prod, Order, Req, Client, TariffPrice, ClientOrder, Warehouse, InventoryLevel } from "./admin/types";
import { fdate, ORDER_STATES, num } from "./admin/types";
import Resumen from "./admin/Resumen";
import Facturas from "./admin/Facturas";
import Inventario from "./admin/Inventario";
import Trazabilidad from "./admin/Trazabilidad";
import Directorio from "./admin/Directorio";
import HistorialPedidos from "./admin/HistorialPedidos";
import ClientesWeb from "./admin/ClientesWeb";
import { adminUpdateProductFull, adminUpdateOrderStatus, adminShipOrder } from "@/app/admin/actions";

type Props = {
  products: Prod[]; orders: Order[]; requests: Req[]; clients: Client[];
  tariffs: Tariff[]; tariffPrices: TariffPrice[];
  contracts: Contract[]; targets: ContractTarget[]; commissions: Commission[];
  invoices: Invoice[]; payments: Payment[]; clientOrders: ClientOrder[];
  warehouses: Warehouse[]; inventoryLevels: InventoryLevel[];
};

type Tab = "resumen" | "productos" | "pedidos" | "facturas" | "clientes" | "inventario" | "trazabilidad" | "directorio";

export default function AdminPanel(p: Props) {
  const [tab, setTab] = useState<Tab>("resumen");
  const openInvoices = p.invoices.filter((i) => i.status === "pending" || i.status === "partial").length;

  return (
    <div>
      <div className="adm-tabs">
        <button className={tab === "resumen" ? "on" : ""} onClick={() => setTab("resumen")}>Resumen</button>
        <button className={tab === "productos" ? "on" : ""} onClick={() => setTab("productos")}>Productos <span>{p.products.length}</span></button>
        <button className={tab === "inventario" ? "on" : ""} onClick={() => setTab("inventario")}>Inventario</button>
        <button className={tab === "trazabilidad" ? "on" : ""} onClick={() => setTab("trazabilidad")}>Trazabilidad</button>
        <button className={tab === "pedidos" ? "on" : ""} onClick={() => setTab("pedidos")}>Pedidos <span>{p.orders.length}</span></button>
        <button className={tab === "facturas" ? "on" : ""} onClick={() => setTab("facturas")}>Facturas {openInvoices > 0 ? <span>{openInvoices}</span> : null}</button>
        <button className={tab === "clientes" ? "on" : ""} onClick={() => setTab("clientes")}>Clientes</button>
        <button className={tab === "directorio" ? "on" : ""} onClick={() => setTab("directorio")}>Directorio</button>
      </div>

      {tab === "resumen" && (
        <Resumen
          invoices={p.invoices} orders={p.orders} clients={p.clients}
          contracts={p.contracts} commissions={p.commissions} clientOrders={p.clientOrders}
          onGo={(t) => setTab(t)}
        />
      )}
      {tab === "productos" && <Productos products={p.products} />}
      {tab === "inventario" && <Inventario products={p.products} warehouses={p.warehouses} levels={p.inventoryLevels} />}
      {tab === "trazabilidad" && <Trazabilidad />}
      {tab === "pedidos" && <PedidosSection orders={p.orders} />}
      {tab === "facturas" && <Facturas invoices={p.invoices} payments={p.payments} clients={p.clients} contracts={p.contracts} />}
      {tab === "clientes" && <ClientesWeb />}
      {tab === "directorio" && <Directorio />}
    </div>
  );
}

/* ---------------- Productos ---------------- */
function Productos({ products }: { products: Prod[] }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Prod[]>(products);
  const [open, setOpen] = useState<string | null>(null);
  const filtered = list.filter((r) => `${r.brand} ${r.name} ${r.sku} ${r.barcode ?? ""} ${r.family} ${r.category}`.toLowerCase().includes(q.toLowerCase()));

  function onSaved(updated: Prod) {
    setList((rs) => rs.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }

  return (
    <div>
      <div className="adm-bar">
        <input className="adm-search" placeholder="Buscar por nombre, marca, SKU o código de barras…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="adm-hint">Pulsa un producto para ver y editar toda su ficha. El stock se gestiona desde la pestaña Inventario.</span>
      </div>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr><th>Producto</th><th>SKU</th><th className="r">Precio € (sin IVA)</th><th className="r">Stock</th><th className="c">Activo</th><th></th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <Fragment key={r.id}>
                <tr className={r.public_price <= 0 ? "warn" : ""}>
                  <td><b>{r.brand} {r.name}</b><span className="sub">{boxLabel(r)}</span></td>
                  <td className="mono">{r.sku}</td>
                  <td className="r">{euro(r.public_price)}</td>
                  <td className="r">{r.stock}</td>
                  <td className="c">{r.active ? "✓" : "—"}</td>
                  <td className="c"><button className="adm-link" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Ocultar" : "Editar"}</button></td>
                </tr>
                {open === r.id && (
                  <tr className="adm-detail"><td colSpan={6}>
                    <ProductoDetalle product={r} onSaved={(u) => { onSaved(u); setOpen(null); }} onCancel={() => setOpen(null)} />
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductoDetalle({ product, onSaved, onCancel }: { product: Prod; onSaved: (p: Prod) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    slug: product.slug || "", brand: product.brand, name: product.name, category: product.category,
    family: product.family || "", size: product.size || "", sku: product.sku, barcode: product.barcode || "",
    description: product.description || "", inci: product.inci || "", inci_verified: !!product.inci_verified,
    public_price: String(product.public_price ?? 0), vat_rate: String(product.vat_rate ?? 0.21),
    units_per_box: String(product.units_per_box ?? ""), weight_kg: String(product.weight_kg ?? ""),
    low_stock_threshold: String(product.low_stock_threshold ?? 20), active: product.active,
    image_url: product.image_url || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  async function save() {
    setBusy(true); setErr("");
    const res = await adminUpdateProductFull({
      id: product.id, slug: f.slug, brand: f.brand, name: f.name, category: f.category,
      family: f.family || null, size: f.size || null, sku: f.sku, barcode: f.barcode || null,
      description: f.description || null, inci: f.inci || null, inci_verified: f.inci_verified,
      public_price: num(f.public_price), vat_rate: num(f.vat_rate),
      units_per_box: f.units_per_box.trim() ? parseInt(f.units_per_box) : null,
      weight_kg: f.weight_kg.trim() ? num(f.weight_kg) : null,
      low_stock_threshold: parseInt(f.low_stock_threshold) || 20, active: f.active, image_url: f.image_url || null,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error || "Error"); return; }
    onSaved({
      ...product, slug: f.slug, brand: f.brand, name: f.name, category: f.category,
      family: f.family || null, size: f.size || null, sku: f.sku, barcode: f.barcode || null,
      description: f.description || null, inci: f.inci || null, inci_verified: f.inci_verified,
      public_price: num(f.public_price), vat_rate: num(f.vat_rate),
      units_per_box: f.units_per_box.trim() ? parseInt(f.units_per_box) : null,
      weight_kg: f.weight_kg.trim() ? num(f.weight_kg) : null,
      low_stock_threshold: parseInt(f.low_stock_threshold) || 20, active: f.active, image_url: f.image_url || null,
    });
  }

  return (
    <div className="adm-detail-grid">
      <label>Marca<input className="adm-input" value={f.brand} onChange={(e) => set({ brand: e.target.value })} /></label>
      <label>Nombre<input className="adm-input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></label>
      <label>Categoría<input className="adm-input" value={f.category} onChange={(e) => set({ category: e.target.value })} /></label>
      <label>Familia<input className="adm-input" value={f.family} onChange={(e) => set({ family: e.target.value })} /></label>
      <label>Tamaño / formato<input className="adm-input" value={f.size} onChange={(e) => set({ size: e.target.value })} /></label>
      <label>Unidades por caja<input className="adm-input" inputMode="numeric" value={f.units_per_box} onChange={(e) => set({ units_per_box: e.target.value })} /></label>
      <label>SKU<input className="adm-input mono" value={f.sku} onChange={(e) => set({ sku: e.target.value })} /></label>
      <label>Código de barras<input className="adm-input mono" value={f.barcode} onChange={(e) => set({ barcode: e.target.value })} placeholder="Se puede asignar también desde Inventario → Escanear" /></label>
      <label>Slug (URL)<input className="adm-input mono" value={f.slug} onChange={(e) => set({ slug: e.target.value })} /></label>
      <label>Imagen (URL)<input className="adm-input" value={f.image_url} onChange={(e) => set({ image_url: e.target.value })} /></label>
      <label>Precio € (sin IVA)<input className="adm-input" inputMode="decimal" value={f.public_price} onChange={(e) => set({ public_price: e.target.value })} /></label>
      <label>IVA (ej. 0,21)<input className="adm-input" inputMode="decimal" value={f.vat_rate} onChange={(e) => set({ vat_rate: e.target.value })} /></label>
      <label>Peso (kg)<input className="adm-input" inputMode="decimal" value={f.weight_kg} onChange={(e) => set({ weight_kg: e.target.value })} /></label>
      <label>Umbral de stock bajo<input className="adm-input" inputMode="numeric" value={f.low_stock_threshold} onChange={(e) => set({ low_stock_threshold: e.target.value })} /></label>
      <label style={{ gridColumn: "1 / -1" }}>Descripción<textarea className="adm-input" rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} /></label>
      <label style={{ gridColumn: "1 / -1" }}>INCI<textarea className="adm-input" rows={2} value={f.inci} onChange={(e) => set({ inci: e.target.value })} /></label>
      <label className="adm-check"><input type="checkbox" checked={f.inci_verified} onChange={(e) => set({ inci_verified: e.target.checked })} /> INCI verificado</label>
      <label className="adm-check"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Activo (visible en la tienda)</label>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}>
        <button className="adm-save" disabled={busy} onClick={save}>{busy ? "…" : "Guardar cambios"}</button>
        <button className="adm-link" onClick={onCancel}>Cancelar</button>
        {err && <span className="adm-err">{err}</span>}
      </div>
    </div>
  );
}

/* ---------------- Pedidos (activos + historial importado) ---------------- */
function PedidosSection({ orders }: { orders: Order[] }) {
  const [sub, setSub] = useState<"activos" | "historial">("activos");
  return (
    <div>
      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={sub === "activos" ? "on" : ""} onClick={() => setSub("activos")}>Pedidos <span>{orders.length}</span></button>
        <button className={sub === "historial" ? "on" : ""} onClick={() => setSub("historial")}>Historial de Pedidos</button>
      </div>
      {sub === "activos" && <PedidosActivos orders={orders} />}
      {sub === "historial" && <HistorialPedidos />}
    </div>
  );
}

function PedidosActivos({ orders }: { orders: Order[] }) {
  const [rows, setRows] = useState(() => orders.map((o) => ({ ...o, _busy: false })));
  const [open, setOpen] = useState<string | null>(null);
  function patch(id: string, data: Partial<Order>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...data } : r)));
  }
  async function setStatus(id: string, status: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _busy: true } : r)));
    const res = await adminUpdateOrderStatus({ id, status });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: res.ok ? status : r.status, _busy: false } : r)));
  }
  if (rows.length === 0) return <p className="adm-empty">Aún no hay pedidos.</p>;
  return (
    <div className="adm-tablewrap">
      <table className="adm-table">
        <thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th className="r">Total</th><th>Pago</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {rows.map((o) => (
            <Fragment key={o.id}>
              <tr>
                <td className="mono">#{o.order_no}</td>
                <td>{fdate(o.created_at)}</td>
                <td><b>{o.name || "—"}</b><span className="sub">{o.email}</span></td>
                <td className="r"><b>{euro(Number(o.total))}</b></td>
                <td>{o.payment_method === "card" ? "Tarjeta" : o.payment_method === "transfer" ? "Transferencia" : o.payment_method === "gocardless" ? "Domiciliación" : o.payment_method || "—"}</td>
                <td>
                  <select className="adm-select" value={o.status} disabled={o._busy} onChange={(e) => setStatus(o.id, e.target.value)}>
                    {Object.entries(ORDER_STATES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="c"><button className="adm-link" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? "Ocultar" : "Ver"}</button></td>
              </tr>
              {open === o.id && (
                <tr className="adm-detail"><td colSpan={7}>
                  <div className="adm-detail-grid">
                    <div>
                      <div className="adm-dt">Envío</div>
                      <div>{o.name}</div>
                      <div>{[o.address, [o.postal_code, o.city].filter(Boolean).join(" "), o.province, o.country].filter(Boolean).join(", ")}</div>
                      <div>{o.phone}</div>
                    </div>
                    <div>
                      <div className="adm-dt">Líneas</div>
                      {o.order_items?.map((it, i) => <div key={i}>{it.qty} × {it.name_snapshot} · {euro(Number(it.unit_price))}</div>)}
                      {o.shipping != null && <div style={{ marginTop: 6, color: "#64705A" }}>Envío: {euro(Number(o.shipping))}</div>}
                    </div>
                  </div>
                  <Dispatch o={o} busy={o._busy} onStatus={(s) => setStatus(o.id, s)} onShipped={(d) => patch(o.id, d)} />
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Preparación y envío de un pedido ---------------- */
function Dispatch({ o, busy, onStatus, onShipped }: { o: Order; busy: boolean; onStatus: (s: string) => void; onShipped: (d: Partial<Order>) => void }) {
  const [carrier, setCarrier] = useState(o.carrier || "inpost");
  const [carrierName, setCarrierName] = useState(o.carrier_name || "");
  const [trackingUrl, setTrackingUrl] = useState(o.tracking_url || "");
  const [tracking, setTracking] = useState(o.tracking_number || "");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const shipped = o.status === "shipped";

  async function ship() {
    setMsg(null);
    if (!tracking.trim()) { setMsg("Introduce el número de seguimiento."); return; }
    if (carrier !== "inpost" && !carrierName.trim()) { setMsg("Introduce el nombre del transporte."); return; }
    setSending(true);
    const res = await adminShipOrder({ order_no: o.order_no, carrier, carrier_name: carrierName, tracking_number: tracking.trim(), tracking_url: trackingUrl.trim() });
    setSending(false);
    if (res.ok) {
      const cn = carrier === "inpost" ? "InPost" : carrierName;
      const tu = carrier === "inpost" ? "https://www.inpost.es/seguimiento-del-envio/" : trackingUrl.trim();
      onShipped({ status: "shipped", carrier, carrier_name: cn, tracking_number: tracking.trim(), tracking_url: tu, shipped_at: new Date().toISOString() });
      setMsg("✓ Pedido marcado como enviado. Aviso de despacho enviado al cliente.");
    } else setMsg(res.error || "No se pudo completar el envío.");
  }

  return (
    <div className="adm-ship">
      <div className="adm-dt">Preparación y envío</div>
      <div className="adm-steps">
        <button className="adm-step" disabled={busy || ["confirmed", "preparing", "shipped"].includes(o.status)} onClick={() => onStatus("confirmed")}>1 · Confirmar recepción</button>
        <button className="adm-step" disabled={busy || ["preparing", "shipped"].includes(o.status)} onClick={() => onStatus("preparing")}>2 · En preparación</button>
        <span className="adm-step-now">Estado actual: <b>{ORDER_STATES[o.status] || o.status}</b></span>
      </div>

      {shipped ? (
        <div className="adm-shipped">
          <b>Enviado</b> · {o.carrier_name || (o.carrier === "inpost" ? "InPost" : o.carrier)} · Nº seguimiento <span className="mono">{o.tracking_number}</span>
          {o.tracking_url && <> · <a href={o.tracking_url} target="_blank" rel="noopener">página de rastreo</a></>}
          {o.shipped_at && <span className="sub">Despachado el {fdate(o.shipped_at)}</span>}
        </div>
      ) : (
        <div className="adm-shipform">
          <div className="adm-shiprow">
            <label>Transporte
              <select className="adm-select" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                <option value="inpost">InPost (punto de recogida)</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            {carrier === "otro" && (
              <>
                <label>Nombre del transporte
                  <input className="adm-input" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder="Ej.: SEUR, GLS, Correos…" />
                </label>
                <label>Página de rastreo (URL)
                  <input className="adm-input" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" />
                </label>
              </>
            )}
            {carrier === "inpost" && <div className="adm-hint">Seguimiento: inpost.es/seguimiento-del-envio</div>}
          </div>
          <div className="adm-shiprow">
            <label>Número de seguimiento
              <input className="adm-input" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Nº de seguimiento" />
            </label>
            <button className="adm-save" disabled={sending} onClick={ship}>{sending ? "Enviando…" : "3 · Marcar como enviado y avisar"}</button>
          </div>
        </div>
      )}
      {msg && <div className={`adm-shipmsg ${msg.startsWith("✓") ? "ok" : "err"}`}>{msg}</div>}
    </div>
  );
}


