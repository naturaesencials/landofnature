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

  const [loteInput, setLoteInput] = useState("");
  const [lote, setLote] = useState<string | null>(null);
  const [detail, setDetail] = useState<ErpLoteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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
    const clean = l.trim();
    if (!clean) return;
    setLote(clean); setDetailLoading(true); setDetail(null); setDetailError(null);
    const res = await adminErpLoteDetail(clean);
    setDetailLoading(false);
    if (!res.ok) { setDetailError(res.error || "No se pudo generar el informe."); return; }
    if (!res.detail?.lote && !res.detail?.orders.length && !res.detail?.moves.length) {
      setDetailError(`No se encontró ningún dato de trazabilidad para el lote "${clean}".`);
      return;
    }
    setDetail(res.detail ?? null);
  }

  return (
    <div>
      {/* ---- Generador directo de informe por número de lote ---- */}
      <div className="no-print" style={{ background: "var(--cream)", border: "1px solid var(--line)", borderRadius: 6, padding: 16, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Generar informe de trazabilidad</h3>
        <p className="lead" style={{ marginTop: 0, marginBottom: 12 }}>
          Introduce el número de lote y genera automáticamente el informe completo: orden de fabricación, componentes consumidos, movimientos de stock y facturas de venta relacionadas.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); openLote(loteInput); }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            value={loteInput} onChange={(e) => setLoteInput(e.target.value)}
            placeholder="Número de lote"
            style={{ flex: 1, maxWidth: 320 }}
          />
          <button className="btn" disabled={detailLoading}>{detailLoading ? "Generando…" : "Generar informe"}</button>
        </form>
        {detailError && <p style={{ color: "#b00020", marginBottom: 0 }}>{detailError}</p>}
      </div>

      {/* ---- Búsqueda general (por si no se sabe el número exacto de lote) ---- */}
      <div className="no-print">
        <h3>O busca por producto, factura u orden</h3>
        <form onSubmit={doSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: PT7221603001, INV/2023/..., WH/MO/..."
            style={{ flex: 1, maxWidth: 420 }}
          />
          <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
        </form>
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
      </div>

      {result && !lote && (
        <div className="no-print" style={{ display: "grid", gap: 24 }}>
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
                      <td><button className="btn-sm" onClick={() => openLote(l.lote)}>Informe →</button></td>
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
                      <td>{o.lote && <button className="btn-sm" onClick={() => openLote(o.lote as string)}>Informe →</button>}</td>
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

      {/* ---- INFORME (pantalla + impresión/PDF) ---- */}
      {lote && detail && (
        <div>
          <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className="btn-sm" onClick={() => { setLote(null); setDetail(null); }}>← Volver</button>
            <button className="btn" onClick={() => window.print()}>Descargar informe (PDF)</button>
          </div>

          <div id="trace-report">
            <header style={{ borderBottom: "2px solid var(--ink)", paddingBottom: 12, marginBottom: 20 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Land of Nature — Informe de trazabilidad</div>
              <h2 style={{ margin: "4px 0 0" }}>Lote {lote}</h2>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Generado el {new Date().toLocaleString("es-ES")}</div>
            </header>

            {detail.lote && (
              <section style={{ marginBottom: 20 }}>
                <h4>Datos del lote</h4>
                <table className="adm-table">
                  <tbody>
                    <tr><td><b>Producto</b></td><td>{detail.lote.product_name || "—"} {detail.lote.product_code ? `(${detail.lote.product_code})` : ""}</td></tr>
                    <tr><td><b>Cantidad</b></td><td>{detail.lote.cantidad ?? "—"}{detail.lote.cantidad_real != null ? ` (real: ${detail.lote.cantidad_real})` : ""}</td></tr>
                    <tr><td><b>Ubicación</b></td><td>{detail.lote.ubicacion || "—"}</td></tr>
                    <tr><td><b>Creado el</b></td><td>{detail.lote.creado_el ? fdate(detail.lote.creado_el) : "—"}</td></tr>
                  </tbody>
                </table>
              </section>
            )}

            <section style={{ marginBottom: 20 }}>
              <h4>Orden(es) de fabricación {detail.orders.length ? `(${detail.orders.length})` : ""}</h4>
              {detail.orders.length ? (
                <table className="adm-table">
                  <thead><tr><th>Referencia</th><th>Producto</th><th>Cantidad</th><th>Estado</th><th>Inicio</th><th>Fin</th><th>BOM</th></tr></thead>
                  <tbody>
                    {detail.orders.map((o) => (
                      <tr key={o.referencia}>
                        <td><code>{o.referencia}</code></td>
                        <td>{o.product_name || o.product_code || "—"}</td>
                        <td>{o.cantidad ?? "—"}</td>
                        <td>{o.estado || "—"}</td>
                        <td>{o.fecha_inicio ? fdate(o.fecha_inicio) : "—"}</td>
                        <td>{o.fecha_final ? fdate(o.fecha_final) : "—"}</td>
                        <td>{o.bom || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="lead">No hay orden de fabricación registrada para este lote.</p>}
            </section>

            <section style={{ marginBottom: 20 }}>
              <h4>Componentes consumidos {detail.components.length ? `(${detail.components.length})` : ""}</h4>
              {detail.components.length ? (
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
              ) : <p className="lead">Sin componentes registrados.</p>}
            </section>

            <section style={{ marginBottom: 20 }}>
              <h4>Movimientos de stock {detail.moves.length ? `(${detail.moves.length})` : ""}</h4>
              {detail.moves.length ? (
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
              ) : <p className="lead">Sin movimientos de stock registrados.</p>}
            </section>

            <section style={{ marginBottom: 20 }}>
              <h4>Facturas de venta relacionadas {detail.relatedSales.length ? `(${detail.relatedSales.length})` : ""}</h4>
              {detail.relatedSales.length ? (
                <>
                  <p className="lead" style={{ fontSize: 12 }}>
                    El ERP no exportó el número de lote a nivel de línea de factura, por lo que esta relación se hace por producto (mismo código), no por lote exacto.
                  </p>
                  <table className="adm-table">
                    <thead><tr><th>Factura</th><th>Cliente</th><th>Fecha</th><th>Cantidad</th></tr></thead>
                    <tbody>
                      {detail.relatedSales.map((s, idx) => (
                        <tr key={idx}>
                          <td><code>{s.numero}</code></td>
                          <td>{s.partner || "—"}</td>
                          <td>{s.fecha ? fdate(s.fecha) : "—"}</td>
                          <td>{s.cantidad ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : <p className="lead">No se encontraron facturas de venta de este producto.</p>}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
