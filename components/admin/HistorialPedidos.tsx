"use client";
import { Fragment, useEffect, useState } from "react";
import { euro } from "@/lib/types";
import { fdate } from "./types";
import { adminSaleOrdersList, adminSaleOrderDetail, type SaleOrderListRow, type SaleOrderDetail } from "@/app/admin/actions";

export default function HistorialPedidos() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SaleOrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaleOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load(query?: string) {
    setLoading(true);
    const res = await adminSaleOrdersList({ q: query });
    setLoading(false);
    if (res.ok) setRows(res.rows ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(ref: string) {
    if (open === ref) { setOpen(null); setDetail(null); return; }
    setOpen(ref); setDetailLoading(true); setDetail(null);
    const res = await adminSaleOrderDetail(ref);
    setDetailLoading(false);
    if (res.ok) setDetail(res.detail ?? null);
  }

  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>
        Pedidos importados del ERP (Odoo) anteriores al lanzamiento de esta web — incluye las notas del equipo.
        No son editables ni se pueden preparar/enviar desde aquí; son solo consulta.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por referencia, cliente o nota" style={{ flex: 1, maxWidth: 400 }} />
        <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr><th>Referencia</th><th>Cliente</th><th>Fecha</th><th className="r">Total</th><th>Estado</th><th>Nota</th><th /></tr></thead>
          <tbody>
            {rows.map((o) => (
              <Fragment key={o.referencia}>
                <tr>
                  <td className="mono">{o.referencia}</td>
                  <td>{o.cliente || "—"}</td>
                  <td>{o.fecha_pedido ? fdate(o.fecha_pedido) : "—"}</td>
                  <td className="r">{o.total != null ? euro(o.total) : "—"}</td>
                  <td>{o.estado || "—"}</td>
                  <td style={{ whiteSpace: "pre-wrap", maxWidth: 260, fontSize: 12 }}>{o.nota || "—"}</td>
                  <td className="c"><button className="adm-link" onClick={() => toggle(o.referencia)}>{open === o.referencia ? "Ocultar" : "Ver"}</button></td>
                </tr>
                {open === o.referencia && (
                  <tr className="adm-detail"><td colSpan={7}>
                    {detailLoading && <p>Cargando…</p>}
                    {detail && (
                      <div>
                        {detail.order?.nota && (
                          <div style={{ marginBottom: 10 }}>
                            <div className="adm-dt">Nota</div>
                            <div style={{ whiteSpace: "pre-wrap" }}>{detail.order.nota}</div>
                          </div>
                        )}
                        <div className="adm-dt">Líneas</div>
                        {detail.lines.map((l, i) => (
                          <div key={i}>{l.cantidad} × {l.product_name || l.descripcion || l.product_code} · {l.precio_unitario != null ? euro(l.precio_unitario) : "—"}</div>
                        ))}
                        {detail.order && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                            Comercial: {detail.order.comercial || "—"} · Plazos de pago: {detail.order.plazos_pago || "—"}
                            {detail.order.referencia_cliente ? ` · Ref. cliente: ${detail.order.referencia_cliente}` : ""}
                          </div>
                        )}
                        {detail.messages.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <div className="adm-dt">Conversación interna ({detail.messages.length})</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                              {detail.messages.map((m, i) => (
                                <div key={i} style={{ borderLeft: "2px solid var(--line)", paddingLeft: 10 }}>
                                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                    <b>{m.autor || "—"}</b>{m.fecha ? ` · ${new Date(m.fecha).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                                  </div>
                                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.contenido}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length && <p className="adm-empty">Sin resultados.</p>}
    </div>
  );
}
