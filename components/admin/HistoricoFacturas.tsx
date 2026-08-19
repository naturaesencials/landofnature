"use client";
import { useEffect, useState } from "react";
import { euro } from "@/lib/types";
import { fdate } from "./types";
import { adminInvoiceHistoryList, adminInvoicePdfUrl, adminInvoiceHistoryYears, type InvoiceHistoryRow } from "@/app/admin/actions";

export default function HistoricoFacturas() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<InvoiceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [type, setType] = useState<"all" | "invoice" | "credit_note">("all");
  const [vista, setVista] = useState<"todas" | "pagadas" | "revertidas">("todas");
  const [nativeTotal, setNativeTotal] = useState(0);
  const [erpTotal, setErpTotal] = useState(0);

  async function load(query?: string, y?: number | null, t?: "all" | "invoice" | "credit_note", v?: "todas" | "pagadas" | "revertidas") {
    setLoading(true);
    const res = await adminInvoiceHistoryList({
      q: query, year: y ?? undefined, type: (t && t !== "all") ? t : undefined,
      onlyPaid: v === "pagadas", onlyReverted: v === "revertidas",
    });
    setLoading(false);
    if (res.ok) { setRows(res.rows ?? []); setNativeTotal(res.nativeTotal ?? 0); setErpTotal(res.erpTotal ?? 0); }
  }
  useEffect(() => {
    load();
    adminInvoiceHistoryYears().then((res) => { if (res.ok) setYears(res.years ?? []); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectYear(y: number | null) { setYear(y); load(q, y, type, vista); }
  function selectType(t: "all" | "invoice" | "credit_note") { setType(t); load(q, year, t, vista); }
  function selectVista(v: "todas" | "pagadas" | "revertidas") { setVista(v); load(q, year, type, v); }

  async function download(id: string) {
    setDownloading(id);
    const res = await adminInvoicePdfUrl(id);
    setDownloading(null);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else alert(res.error || "No se pudo descargar la factura.");
  }

  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>
        Todas las facturas emitidas, en un solo listado cronológico: las nuevas de esta web
        (numeración <code>INV/AAAA/MM/NNNN</code>, con PDF descargable) y las importadas del histórico
        de Odoo. {nativeTotal + erpTotal > 0 && `${(nativeTotal + erpTotal).toLocaleString("es-ES")} facturas en total (${nativeTotal} nuevas, ${erpTotal} del ERP)`}
        {year ? `, filtrando por ${year}` : rows.length >= 200 ? " — mostrando las 200 más recientes, filtra por año para ver más" : ""}.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); load(q, year, type); }} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número o cliente" style={{ flex: 1, maxWidth: 360 }} />
        <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>

      <div className="adm-tabs" style={{ marginBottom: 12 }}>
        <button className={type === "all" ? "on" : ""} onClick={() => selectType("all")}>Todas</button>
        <button className={type === "invoice" ? "on" : ""} onClick={() => selectType("invoice")}>Facturas de venta</button>
        <button className={type === "credit_note" ? "on" : ""} onClick={() => selectType("credit_note")}>Facturas rectificativas</button>
      </div>
      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={vista === "todas" ? "on" : ""} onClick={() => selectVista("todas")}>Todas</button>
        <button className={vista === "pagadas" ? "on" : ""} onClick={() => selectVista("pagadas")}>Solo pagadas</button>
        <button className={vista === "revertidas" ? "on" : ""} onClick={() => selectVista("revertidas")}>Revertidas (a revisar)</button>
      </div>
      {vista === "revertidas" && (
        <p className="lead" style={{ background: "#FBF3E4", padding: "8px 12px", borderRadius: 6 }}>
          Estas facturas figuran como "Revertidas" en Odoo — el pago se anuló o se deshizo. No se cuentan como pagadas
          automáticamente; revísalas una a una.
        </p>
      )}

      {years.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          <button className={year === null ? "btn-sm on" : "btn-sm"} onClick={() => selectYear(null)}>
            Todos <span style={{ opacity: 0.6 }}>({years.reduce((s, y) => s + y.count, 0)})</span>
          </button>
          {years.map((y) => (
            <button key={y.year} className={year === y.year ? "btn-sm on" : "btn-sm"} onClick={() => selectYear(y.year)}>
              {y.year} <span style={{ opacity: 0.6 }}>({y.count})</span>
            </button>
          ))}
        </div>
      )}

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr><th>Número</th><th>Origen</th><th>Cliente</th><th>Fecha</th><th className="r">Total</th><th>Estado de pago</th><th /></tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.numero}-${idx}`}>
                <td className="mono">{r.numero}</td>
                <td>
                  {r.origen === "nueva"
                    ? (r.kind === "credit_note" ? "Rectificativa" : "Nueva")
                    : (r.kind === "credit_note" ? "Odoo (rectificativa)" : "Odoo (histórico)")}
                </td>
                <td>{r.cliente || "—"}</td>
                <td>{r.fecha ? fdate(r.fecha) : "—"}</td>
                <td className="r">{r.total != null ? euro(r.total) : "—"}</td>
                <td>{r.estado || "—"}</td>
                <td className="c">
                  {r.origen === "nueva" && r.id && (
                    <button className="adm-link" onClick={() => download(r.id!)} disabled={downloading === r.id}>
                      {downloading === r.id ? "…" : "PDF"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length && <p className="adm-empty">Sin resultados.</p>}
    </div>
  );
}
