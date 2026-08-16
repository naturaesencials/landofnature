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
  const [nativeTotal, setNativeTotal] = useState(0);
  const [erpTotal, setErpTotal] = useState(0);

  async function load(query?: string, y?: number | null) {
    setLoading(true);
    const res = await adminInvoiceHistoryList({ q: query, year: y ?? undefined });
    setLoading(false);
    if (res.ok) { setRows(res.rows ?? []); setNativeTotal(res.nativeTotal ?? 0); setErpTotal(res.erpTotal ?? 0); }
  }
  useEffect(() => {
    load();
    adminInvoiceHistoryYears().then((res) => { if (res.ok) setYears(res.years ?? []); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectYear(y: number | null) {
    setYear(y);
    load(q, y);
  }

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
      <form onSubmit={(e) => { e.preventDefault(); load(q, year); }} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número o cliente" style={{ flex: 1, maxWidth: 360 }} />
        <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>

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
          <thead><tr><th>Número</th><th>Origen</th><th>Cliente</th><th>Fecha</th><th className="r">Total</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.numero}-${idx}`}>
                <td className="mono">{r.numero}</td>
                <td>{r.origen === "nueva" ? (r.kind === "credit_note" ? "Rectificativa" : "Nueva") : "Odoo (histórico)"}</td>
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
