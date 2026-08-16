"use client";
import { useEffect, useState } from "react";
import { euro } from "@/lib/types";
import { fdate } from "./types";
import { adminInvoiceHistoryList, adminInvoicePdfUrl, type InvoiceHistoryRow } from "@/app/admin/actions";

export default function HistoricoFacturas() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<InvoiceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function load(query?: string) {
    setLoading(true);
    const res = await adminInvoiceHistoryList({ q: query });
    setLoading(false);
    if (res.ok) setRows(res.rows ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function download(id: string) {
    setDownloading(id);
    const res = await adminInvoicePdfUrl(id);
    setDownloading(null);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else alert(res.error || "No se pudo descargar la factura.");
  }

  const nuevas = rows.filter((r) => r.origen === "nueva").length;
  const odoo = rows.filter((r) => r.origen === "odoo").length;

  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>
        Todas las facturas emitidas, en un solo listado cronológico: las nuevas de esta web
        (numeración <code>INV/AAAA/MM/NNNN</code>, con PDF descargable) y las importadas del histórico
        de Odoo. Mostrando {nuevas} nuevas y {odoo} del histórico ERP{rows.length >= 200 ? " (primeras 200)" : ""}.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número o cliente" style={{ flex: 1, maxWidth: 360 }} />
        <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>

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
