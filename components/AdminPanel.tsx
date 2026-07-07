"use client";
import { useState, Fragment } from "react";
import { euro, boxLabel } from "@/lib/types";
import { adminUpdateProduct, adminUpdateOrderStatus, adminUpdateRequest, adminSetAgreement } from "@/app/admin/actions";

type Prod = { id: string; brand: string; name: string; size: string | null; sku: string; public_price: number; stock: number; active: boolean; units_per_box: number | null; family: string | null; category: string };
type OrderItem = { name_snapshot: string; qty: number; unit_price: number };
type Order = { id: string; order_no: number; created_at: string; name: string | null; email: string | null; phone: string | null; address: string | null; postal_code: string | null; city: string | null; province: string | null; country: string | null; payment_method: string | null; status: string; total: number; order_items: OrderItem[] };
type Req = { id: string; contact_name: string | null; company: string | null; cif: string | null; business_type: string | null; email: string | null; phone: string | null; message: string | null; status: string; created_at: string };
type Client = { id: string; full_name: string | null; company: string | null; cif: string | null; phone: string | null; tariff_code: string | null; status: string | null; commercial_agreement: boolean; gc_mandate_status: string | null; created_at: string };

const fdate = (s: string) => new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
const ORDER_STATES: Record<string, string> = { pending_payment: "Pendiente de pago", paid: "Pagado", shipped: "Enviado", cancelled: "Cancelado" };

export default function AdminPanel({ products, orders, requests, clients }: { products: Prod[]; orders: Order[]; requests: Req[]; clients: Client[] }) {
  const pendingReq = requests.filter((r) => r.status === "pending").length;
  const [tab, setTab] = useState<"productos" | "pedidos" | "solicitudes" | "clientes">("productos");
  return (
    <div>
      <div className="adm-tabs">
        <button className={tab === "productos" ? "on" : ""} onClick={() => setTab("productos")}>Productos <span>{products.length}</span></button>
        <button className={tab === "pedidos" ? "on" : ""} onClick={() => setTab("pedidos")}>Pedidos <span>{orders.length}</span></button>
        <button className={tab === "clientes" ? "on" : ""} onClick={() => setTab("clientes")}>Clientes <span>{clients.length}</span></button>
        <button className={tab === "solicitudes" ? "on" : ""} onClick={() => setTab("solicitudes")}>Solicitudes {pendingReq > 0 && <span className="alert">{pendingReq}</span>}</button>
      </div>
      {tab === "productos" && <Productos products={products} />}
      {tab === "pedidos" && <Pedidos orders={orders} />}
      {tab === "clientes" && <Clientes clients={clients} />}
      {tab === "solicitudes" && <Solicitudes requests={requests} />}
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
                <td>{o.payment_method === "card" ? "Tarjeta" : o.payment_method === "transfer" ? "Transferencia" : o.payment_method || "—"}</td>
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
                    </div>
                  </div>
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
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

/* ---------------- Clientes ---------------- */
function Clientes({ clients }: { clients: Client[] }) {
  const [rows, setRows] = useState(() => clients.map((c) => ({ ...c, _busy: false })));
  async function toggle(id: string, value: boolean) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _busy: true } : r)));
    const res = await adminSetAgreement({ id, value });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, commercial_agreement: res.ok ? value : r.commercial_agreement, _busy: false } : r)));
  }
  const mandate = (s: string | null) => s === "active" ? <span className="adm-chip ok">Activa</span> : s ? <span className="adm-chip pend">{s}</span> : <span className="adm-chip no">Sin mandato</span>;
  if (rows.length === 0) return <p className="adm-empty">No hay clientes registrados.</p>;
  return (
    <div>
      <p className="adm-hint" style={{ marginBottom: 12 }}>Activa el <b>acuerdo comercial</b> para permitir a un cliente pagar por domiciliación bancaria (SEPA/GoCardless). El cliente deberá luego autorizar el mandato desde su portal.</p>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr><th>Cliente</th><th>CIF</th><th>Tarifa</th><th className="c">Acuerdo comercial</th><th className="c">Domiciliación</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><b>{c.company || c.full_name || "—"}</b><span className="sub">{c.full_name}{c.phone ? " · " + c.phone : ""}</span></td>
                <td className="mono">{c.cif || "—"}</td>
                <td className="c">{c.tariff_code || "—"}</td>
                <td className="c"><label className="adm-switch"><input type="checkbox" checked={c.commercial_agreement} disabled={c._busy} onChange={(e) => toggle(c.id, e.target.checked)} /><span /></label></td>
                <td className="c">{mandate(c.gc_mandate_status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
