"use client";
import { useState } from "react";
import { euro } from "@/lib/types";
import { fdate } from "./types";
import {
  adminErpSearch, adminErpLoteDetail,
  type ErpSearchResult, type ErpLoteDetail,
} from "@/app/admin/actions";

export default function Trazabilidad() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ErpSearchResult | null>(null);

  const [lote, setLote] = useState<string | null>(null);
  const [detail, setDetail] = useState<ErpLoteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true); setError(null); setLote(null); setDetail(null);
    const res = await adminErpSearch(q);
    setLoading(false);
    if (!res.ok) { setError(res.error || "Error"); return; }
    setResult(res.result ?? null);
  }

  async function openLote(l: string) {
    setLote(l); setDetailLoading(true); setDetail(null);
    const res = await adminErpLoteDetail(l);
    setDetailLoading(false);
    if (res.ok) setDetail(res.detail ?? null);
  }

  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>
        Histórico importado del ERP (Odoo): fabricación, lotes, movimientos de stock y facturación.
        Busca por lote, código o nombre de producto, número de factura o referencia de orden.
      </p>

      <form onSubmit={doSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Ej: lote, PT7221603001, INV/2023/..., WH/MO/..."
          style={{ flex: 1, maxWidth: 420 }}
        />
        <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {result && !lote && (
        <div style={{ display: "grid", gap: 24 }}>
          {result.lots.length > 0 && (
            <section>
              <h3>Lotes ({result.lots.length})</h3>
              <table className="adm-table">
                <thead><tr><th>Lote</th><th>Producto</th><th>Cantidad</th><th>Ubicación</th><th>Creado</th><th /></tr></thead>
                <tbody>
                  {result.lots.map((l) => (
                    <tr key={l.id}>
                      <td><code>{l.lote}</code></td>
                      <td>{l.product_name || l.product_code || "—"}</td>
                      <td>{l.cantidad ?? "—"}</td>
                      <td>{l.ubicacion || "—"}</td>
                      <td>{l.creado_el ? fdate(l.creado_el) : "—"}</td>
                      <td><button className="btn-sm" onClick={() => openLote(l.lote)}>Trazabilidad →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {result.orders.length > 0 && (
            <section>
              <h3>Órdenes de fabricación ({result.orders.length})</h3>
              <table className="adm-table">
                <thead><tr><th>Referencia</th><th>Producto</th><th>Cantidad</th><th>Estado</th><th>Fecha</th><th>Lote</th><th /></tr></thead>
                <tbody>
                  {result.orders.map((o) => (
                    <tr key={o.referencia}>
                      <td><code>{o.referencia}</code></td>
                      <td>{o.product_name || o.product_code || "—"}</td>
                      <td>{o.cantidad ?? "—"}</td>
                      <td>{o.estado || "—"}</td>
                      <td>{o.fecha_final ? fdate(o.fecha_final) : "—"}</td>
                      <td>{o.lote ? <code>{o.lote}</code> : "—"}</td>
                      <td>{o.lote && <button className="btn-sm" onClick={() => openLote(o.lote as string)}>Trazabilidad →</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {result.salesInvoices.length > 0 && (
            <section>
              <h3>Facturas de venta ({result.salesInvoices.length})</h3>
              <table className="adm-table">
                <thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
                <tbody>
                  {result.salesInvoices.map((i) => (
                    <tr key={i.numero}>
                      <td><code>{i.numero}</code></td>
                      <td>{i.partner || "—"}</td>
                      <td>{i.fecha ? fdate(i.fecha) : "—"}</td>
                      <td>{i.total != null ? euro(i.total) : "—"}</td>
                      <td>{i.estado || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {result.purchaseInvoices.length > 0 && (
            <section>
              <h3>Facturas de compra ({result.purchaseInvoices.length})</h3>
              <table className="adm-table">
                <thead><tr><th>Número</th><th>Proveedor</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
                <tbody>
                  {result.purchaseInvoices.map((i) => (
                    <tr key={i.numero}>
                      <td><code>{i.numero}</code></td>
                      <td>{i.partner || "—"}</td>
                      <td>{i.fecha ? fdate(i.fecha) : "—"}</td>
                      <td>{i.total != null ? euro(i.total) : "—"}</td>
                      <td>{i.estado || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {!result.lots.length && !result.orders.length && !result.salesInvoices.length && !result.purchaseInvoices.length && (
            <p>Sin resultados para “{q}”.</p>
          )}
        </div>
      )}

      {lote && (
        <div>
          <button className="btn-sm" onClick={() => { setLote(null); setDetail(null); }} style={{ marginBottom: 16 }}>← Volver a resultados</button>
          <h3>Trazabilidad del lote <code>{lote}</code></h3>
          {detailLoading && <p>Cargando…</p>}
          {detail && (
            <div style={{ display: "grid", gap: 20 }}>
              {detail.lote && (
                <section>
                  <h4>Lote</h4>
                  <p>
                    {detail.lote.product_name || detail.lote.product_code} · Cantidad: {detail.lote.cantidad ?? "—"}
                    {detail.lote.cantidad_real != null && ` (real: ${detail.lote.cantidad_real})`} · Ubicación: {detail.lote.ubicacion || "—"} · Creado: {detail.lote.creado_el ? fdate(detail.lote.creado_el) : "—"}
                  </p>
                </section>
              )}

              {detail.orders.length > 0 && (
                <section>
                  <h4>Orden(es) de fabricación</h4>
                  {detail.orders.map((o) => (
                    <div key={o.referencia} style={{ marginBottom: 12 }}>
                      <p><strong>{o.referencia}</strong> — {o.product_name || o.product_code} · {o.cantidad ?? "—"} uds · {o.estado || "—"} · {o.fecha_final ? fdate(o.fecha_final) : "—"}{o.bom ? ` · BOM: ${o.bom}` : ""}</p>
                    </div>
                  ))}
                </section>
              )}

              {detail.components.length > 0 && (
                <section>
                  <h4>Componentes consumidos ({detail.components.length})</h4>
                  <table className="adm-table">
                    <thead><tr><th>Orden</th><th>Componente</th><th>Cantidad</th></tr></thead>
                    <tbody>
                      {detail.components.map((c, idx) => (
                        <tr key={idx}>
                          <td><code>{c.order_referencia}</code></td>
                          <td>{c.component_name || c.component_code}</td>
                          <td>{c.cantidad_consumida ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {detail.moves.length > 0 && (
                <section>
                  <h4>Movimientos de stock ({detail.moves.length})</h4>
                  <table className="adm-table">
                    <thead><tr><th>Fecha</th><th>Referencia</th><th>Desde</th><th>Hasta</th><th>Cantidad</th><th>Estado</th></tr></thead>
                    <tbody>
                      {detail.moves.map((m) => (
                        <tr key={m.id}>
                          <td>{m.fecha ? fdate(m.fecha) : "—"}</td>
                          <td>{m.referencia || "—"}</td>
                          <td>{m.desde || "—"}</td>
                          <td>{m.hasta || "—"}</td>
                          <td>{m.cantidad_hecha ?? "—"}</td>
                          <td>{m.estado || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {!detail.orders.length && !detail.components.length && !detail.moves.length && (
                <p>No hay más datos de trazabilidad asociados a este lote.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
