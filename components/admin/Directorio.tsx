"use client";
import { useEffect, useState } from "react";
import { euro } from "@/lib/types";
import { fdate } from "./types";
import {
  adminPartnersList, adminUpdatePartner, adminPartnerInvoices, adminPartnersCounts, adminPartnerOrders,
  type Partner, type PartnerInvoiceRow, type PartnerOrderRow,
} from "@/app/admin/actions";

type Kind = "cliente" | "proveedor";

export default function Directorio() {
  const [kind, setKind] = useState<Kind>("cliente");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Partner | null>(null);
  const [counts, setCounts] = useState<{ cliente: number; proveedor: number } | null>(null);

  async function load() {
    setLoading(true);
    const res = await adminPartnersList({ kind, q: q.trim() || undefined });
    setLoading(false);
    if (res.ok) setRows(res.rows ?? []);
  }

  useEffect(() => { load(); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { adminPartnersCounts().then((r) => { if (r.ok) setCounts({ cliente: r.cliente!, proveedor: r.proveedor! }); }); }, []);

  return (
    <div>
      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={kind === "cliente" ? "on" : ""} onClick={() => setKind("cliente")}>Clientes {counts && <span>{counts.cliente}</span>}</button>
        <button className={kind === "proveedor" ? "on" : ""} onClick={() => setKind("proveedor")}>Proveedores {counts && <span>{counts.proveedor}</span>}</button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CIF o email" style={{ flex: 1, maxWidth: 360 }} />
        <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>

      <table className="adm-table">
        <thead><tr><th>Nombre</th><th>CIF</th><th>Email</th><th>Teléfono</th><th>Ciudad</th><th /></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td><b>{p.name}</b>{p.profile_id && <span className="sub">Cuenta registrada en la web</span>}</td>
              <td>{p.cif || "—"}</td>
              <td>{p.email || "—"}</td>
              <td>{p.phone || "—"}</td>
              <td>{p.city || "—"}</td>
              <td><button className="btn-sm" onClick={() => setOpen(p)}>Ficha →</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && !rows.length && <p className="lead">Sin resultados.</p>}

      {open && <PartnerModal kind={kind} partner={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function PartnerModal({ partner, kind, onClose, onSaved }: {
  partner: Partner; kind: Kind; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    cif: partner.cif || "", email: partner.email || "", phone: partner.phone || "",
    address: partner.address || "", city: partner.city || "", postal_code: partner.postal_code || "",
    province: partner.province || "", notes: partner.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<PartnerInvoiceRow[] | null>(null);
  const [invLoading, setInvLoading] = useState(true);
  const [orders, setOrders] = useState<PartnerOrderRow[] | null>(null);
  const [ordLoading, setOrdLoading] = useState(kind === "cliente");

  useEffect(() => {
    setInvLoading(true);
    adminPartnerInvoices(partner.name, kind).then((res) => {
      setInvLoading(false);
      if (res.ok) setInvoices(res.rows ?? []);
    });
    if (kind === "cliente") {
      setOrdLoading(true);
      adminPartnerOrders(partner.id).then((res) => {
        setOrdLoading(false);
        if (res.ok) setOrders(res.rows ?? []);
      });
    }
  }, [partner, kind]);

  async function save() {
    setSaving(true);
    await adminUpdatePartner({ id: partner.id, ...form });
    setSaving(false);
    onSaved();
  }

  const total = (invoices ?? []).reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 24, maxWidth: 720, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <h3 style={{ marginTop: 0 }}>{partner.name}</h3>
          <button className="btn-sm" onClick={onClose}>Cerrar</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <label>CIF<input value={form.cif} onChange={(e) => setForm({ ...form, cif: e.target.value })} /></label>
          <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Teléfono<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Ciudad<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label>Provincia<input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></label>
          <label>Código postal<input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Dirección<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Notas<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>

        {kind === "cliente" && (
          <>
            <h4 style={{ marginTop: 24 }}>Pedidos (histórico ERP) {orders ? `(${orders.length})` : ""}</h4>
            {ordLoading && <p>Cargando…</p>}
            {orders && (
              orders.length ? (
                <table className="adm-table">
                  <thead><tr><th>Referencia</th><th>Fecha</th><th>Estado</th><th>Total</th><th>Nota</th></tr></thead>
                  <tbody>
                    {orders.slice(0, 50).map((o) => (
                      <tr key={o.referencia}>
                        <td><code>{o.referencia}</code></td>
                        <td>{o.fecha_pedido ? fdate(o.fecha_pedido) : "—"}</td>
                        <td>{o.estado || "—"}</td>
                        <td>{o.total != null ? euro(o.total) : "—"}</td>
                        <td style={{ whiteSpace: "pre-wrap", maxWidth: 320, fontSize: 12 }}>{o.nota || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="lead">Sin pedidos registrados.</p>
            )}
          </>
        )}

        <h4 style={{ marginTop: 24 }}>Facturas de {kind === "cliente" ? "venta" : "compra"} {invoices ? `(${invoices.length})` : ""}</h4>
        {invLoading && <p>Cargando…</p>}
        {invoices && (
          invoices.length ? (
            <>
              <table className="adm-table">
                <thead><tr><th>Número</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
                <tbody>
                  {invoices.slice(0, 50).map((i) => (
                    <tr key={i.numero}>
                      <td><code>{i.numero}</code></td>
                      <td>{i.fecha ? fdate(i.fecha) : "—"}</td>
                      <td>{i.total != null ? euro(i.total) : "—"}</td>
                      <td>{i.estado || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: "var(--muted)" }}>
                {invoices.length > 50 ? `Mostrando 50 de ${invoices.length}. ` : ""}Total acumulado: <b>{euro(total)}</b>
              </p>
            </>
          ) : <p className="lead">Sin facturas registradas.</p>
        )}
      </div>
    </div>
  );
}
