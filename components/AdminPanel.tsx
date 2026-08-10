"use client";
import { useState, Fragment } from "react";
import { euro, boxLabel } from "@/lib/types";
import type { Tariff, Contract, ContractTarget, Commission, Invoice, Payment } from "@/lib/contracts";
import type { Prod, Order, Req, Client, TariffPrice, ClientOrder, Warehouse, InventoryLevel } from "./admin/types";
import { fdate, ORDER_STATES } from "./admin/types";
import Resumen from "./admin/Resumen";
import Tarifas from "./admin/Tarifas";
import Facturas from "./admin/Facturas";
import Clientes from "./admin/Clientes";
import Inventario from "./admin/Inventario";
import { adminUpdateProduct, adminUpdateOrderStatus, adminUpdateRequest, adminShipOrder } from "@/app/admin/actions";

type Props = {
  products: Prod[]; orders: Order[]; requests: Req[]; clients: Client[];
  tariffs: Tariff[]; tariffPrices: TariffPrice[];
  contracts: Contract[]; targets: ContractTarget[]; commissions: Commission[];
  invoices: Invoice[]; payments: Payment[]; clientOrders: ClientOrder[];
  warehouses: Warehouse[]; inventoryLevels: InventoryLevel[];
};

type Tab = "resumen" | "productos" | "tarifas" | "pedidos" | "facturas" | "clientes" | "solicitudes" | "inventario";

export default function AdminPanel(p: Props) {
  const pendingReq = p.requests.filter((r) => r.status === "pending").length;
  const [tab, setTab] = useState<Tab>("resumen");
  const openInvoices = p.invoices.filter((i) => i.status === "pending" || i.status === "partial").length;

  return (
    <div>
      <div className="adm-tabs">
        <button className={tab === "resumen" ? "on" : ""} onClick={() => setTab("resumen")}>Resumen</button>
        <button className={tab === "productos" ? "on" : ""} onClick={() => setTab("productos")}>Productos <span>{p.products.length}</span></button>
        <button className={tab === "inventario" ? "on" : ""} onClick={() => setTab("inventario")}>Inventario</button>
        <button className={tab === "tarifas" ? "on" : ""} onClick={() => setTab("tarifas")}>Tarifas <span>{p.tariffs.length}</span></button>
        <button className={tab === "pedidos" ? "on" : ""} onClick={() => setTab("pedidos")}>Pedidos <span>{p.orders.length}</span></button>
        <button className={tab === "facturas" ? "on" : ""} onClick={() => setTab("facturas")}>Facturas {openInvoices > 0 ? <span>{openInvoices}</span> : null}</button>
        <button className={tab === "clientes" ? "on" : ""} onClick={() => setTab("clientes")}>Clientes <span>{p.clients.length}</span></button>
        <button className={tab === "solicitudes" ? "on" : ""} onClick={() => setTab("solicitudes")}>Solicitudes {pendingReq > 0 && <span className="alert">{pendingReq}</span>}</button>
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
      {tab === "tarifas" && <Tarifas products={p.products} tariffs={p.tariffs} tariffPrices={p.tariffPrices} />}
      {tab === "pedidos" && <Pedidos orders={p.orders} />}
      {tab === "facturas" && <Facturas invoices={p.invoices} payments={p.payments} clients={p.clients} contracts={p.contracts} />}
      {tab === "clientes" && (
        <Clientes
          clients={p.clients} tariffs={p.tariffs} contracts={p.contracts}
          targets={p.targets} commissions={p.commissions} clientOrders={p.clientOrders}
        />
      )}
      {tab === "solicitudes" && <Solicitudes requests={p.requests} />}
    </div>
  );
}

/* ---------------- Productos ---------------- */
function Productos({ products }: { products: Prod[] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(() => products.map((p) => ({ ...p, _price: String(p.public_price ?? 0), _stock: String(p.stock ?? 0), _saved: false, _busy: false, _err: "" })));
  const filtered = rows.filter((r) => `${r.brand} ${r.name} ${r.sku} ${r.family} ${r.category}`.toLowerCase().includes(q.toLowerCase()));

  const set = (id: string, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function save(id: string) {
    const r = rows.find((x) => x.id === id); if (!r) return;
    set(id, { _busy: true, _err: "", _saved: false });
    const res = await adminUpdateProduct({ id, public_price: parseFloat(r._price.replace(",", ".")) || 0, stock: parseInt(r._stock) || 0, active: r.active });
    if (res.ok) set(id, { _busy: false, _saved: true, public_price: parseFloat(r._price.replace(",", ".")) || 0, stock: parseInt(r._stock) || 0 });
    else set(id, { _busy: false, _err: res.error || "Error" });
  }

  return (
    <div>
      <div className="adm-bar">
        <input className="adm-search" placeholder="Buscar por nombre, marca, SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="adm-hint">Edita precio, stock y visibilidad. Precio 0 = «Próximamente».</span>
      </div>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr><th>Producto</th><th>SKU</th><th className="r">Precio € (sin IVA)</th><th className="r">Stock</th><th className="c">Activo</th><th></th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={r.public_price <= 0 ? "warn" : ""}>
                <td><b>{r.brand} {r.name}</b><span className="sub">{boxLabel(r)}</span></td>
                <td className="mono">{r.sku}</td>
                <td className="r"><input className="adm-num" inputMode="decimal" value={r._price} onChange={(e) => set(r.id, { _price: e.target.value, _saved: false })} /></td>
                <td className="r"><input className="adm-num sm" inputMode="numeric" value={r._stock} onChange={(e) => set(r.id, { _stock: e.target.value, _saved: false })} /></td>
                <td className="c"><input type="checkbox" checked={r.active} onChange={(e) => set(r.id, { active: e.target.checked, _saved: false })} /></td>
                <td className="c">
                  <button className="adm-save" disabled={r._busy} onClick={() => save(r.id)}>{r._busy ? "…" : r._saved ? "✓" : "Guardar"}</button>
                  {r._err && <div className="adm-err">{r._err}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Pedidos ---------------- */
function Pedidos({ orders }: { orders: Order[] }) {
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


/* ---------------- Solicitudes ---------------- */
function Solicitudes({ requests }: { requests: Req[] }) {
  const [rows, setRows] = useState(() => requests.map((r) => ({ ...r, _busy: false })));
  async function setStatus(id: string, status: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _busy: true } : r)));
    const res = await adminUpdateRequest({ id, status });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: res.ok ? status : r.status, _busy: false } : r)));
  }
  if (rows.length === 0) return <p className="adm-empty">No hay solicitudes de cuenta.</p>;
  const badge = (s: string) => s === "approved" ? "ok" : s === "rejected" ? "no" : "pend";
  const label = (s: string) => s === "approved" ? "Aprobada" : s === "rejected" ? "Rechazada" : "Pendiente";
  return (
    <div className="adm-tablewrap">
      <table className="adm-table">
        <thead><tr><th>Fecha</th><th>Contacto / Empresa</th><th>CIF</th><th>Tipo</th><th>Contacto</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{fdate(r.created_at)}</td>
              <td><b>{r.contact_name || "—"}</b><span className="sub">{r.company}</span></td>
              <td className="mono">{r.cif || "—"}</td>
              <td>{r.business_type || "—"}</td>
              <td><a href={`mailto:${r.email}`} className="adm-link">{r.email}</a><span className="sub">{r.phone}</span></td>
              <td><span className={`adm-chip ${badge(r.status)}`}>{label(r.status)}</span></td>
              <td className="c">
                {r.status !== "approved" && <button className="adm-save" disabled={r._busy} onClick={() => setStatus(r.id, "approved")}>Aprobar</button>}
                {r.status !== "rejected" && <button className="adm-link danger" disabled={r._busy} onClick={() => setStatus(r.id, "rejected")}>Rechazar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
