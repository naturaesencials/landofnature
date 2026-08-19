"use client";
import { Fragment, useEffect, useState } from "react";
import { euro } from "@/lib/types";
import { fdate } from "./types";
import { adminInvoiceHistoryList, adminInvoicePdfUrl, adminInvoiceHistoryYears, adminRevertedInvoicesWithCandidates, adminPendingInvoices, adminMarkInvoicePaid, adminPaymentAccountsSummary, adminInvoicesByAccount, type InvoiceHistoryRow, type RevertedInvoiceRow, type PendingInvoiceRow, type PaymentAccountSummary, type AccountInvoiceRow } from "@/app/admin/actions";
import AttachmentsButton from "./AttachmentsButton";

export default function HistoricoFacturas() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<InvoiceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [type, setType] = useState<"all" | "invoice" | "credit_note">("all");
  const [vista, setVista] = useState<"todas" | "pagadas" | "pendientes" | "revertidas" | "cuentas">("todas");
  const [revertidas, setRevertidas] = useState<RevertedInvoiceRow[]>([]);
  const [loadingRevertidas, setLoadingRevertidas] = useState(false);
  const [pendientes, setPendientes] = useState<PendingInvoiceRow[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [cuentaInput, setCuentaInput] = useState<Record<string, string>>({});
  const [cuentasLimpias, setCuentasLimpias] = useState<PaymentAccountSummary[]>([]);
  const [cuentasCombinadas, setCuentasCombinadas] = useState<PaymentAccountSummary[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [cuentaAbierta, setCuentaAbierta] = useState<string | null>(null);
  const [cuentaInvoices, setCuentaInvoices] = useState<AccountInvoiceRow[]>([]);
  const [loadingCuentaInvoices, setLoadingCuentaInvoices] = useState(false);
  const [nativeTotal, setNativeTotal] = useState(0);
  const [erpTotal, setErpTotal] = useState(0);

  async function load(query?: string, y?: number | null, t?: "all" | "invoice" | "credit_note", v?: "todas" | "pagadas" | "pendientes" | "revertidas" | "cuentas") {
    if (v === "revertidas") {
      setLoadingRevertidas(true);
      const res = await adminRevertedInvoicesWithCandidates();
      setLoadingRevertidas(false);
      if (res.ok) setRevertidas(res.rows ?? []);
      return;
    }
    if (v === "pendientes") {
      setLoadingPendientes(true);
      const res = await adminPendingInvoices();
      setLoadingPendientes(false);
      if (res.ok) setPendientes(res.rows ?? []);
      return;
    }
    if (v === "cuentas") {
      setLoadingCuentas(true);
      setCuentaAbierta(null);
      const res = await adminPaymentAccountsSummary();
      setLoadingCuentas(false);
      if (res.ok) { setCuentasLimpias(res.limpias ?? []); setCuentasCombinadas(res.combinadas ?? []); }
      return;
    }
    setLoading(true);
    const res = await adminInvoiceHistoryList({
      q: query, year: y ?? undefined, type: (t && t !== "all") ? t : undefined,
      onlyPaid: v === "pagadas",
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
  function selectVista(v: "todas" | "pagadas" | "pendientes" | "revertidas" | "cuentas") { setVista(v); load(q, year, type, v); }

  async function toggleCuenta(cuenta: string) {
    if (cuentaAbierta === cuenta) { setCuentaAbierta(null); return; }
    setCuentaAbierta(cuenta);
    setLoadingCuentaInvoices(true);
    const res = await adminInvoicesByAccount(cuenta);
    setLoadingCuentaInvoices(false);
    if (res.ok) setCuentaInvoices(res.rows ?? []);
  }

  async function marcarPagada(origen: "nueva" | "odoo", numero: string) {
    const cuenta = cuentaInput[numero];
    if (!cuenta || !cuenta.trim()) { alert("Indica desde qué cuenta se ha pagado."); return; }
    setMarcando(numero);
    const res = await adminMarkInvoicePaid({ origen, numero, cuentaPago: cuenta });
    setMarcando(null);
    if (!res.ok) { alert(res.error || "No se pudo marcar como pagada."); return; }
    setPendientes((rs) => rs.filter((r) => r.numero !== numero));
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
        <button className={vista === "pendientes" ? "on" : ""} onClick={() => selectVista("pendientes")}>Pendientes de pago</button>
        <button className={vista === "revertidas" ? "on" : ""} onClick={() => selectVista("revertidas")}>Revertidas (a revisar)</button>
        <button className={vista === "cuentas" ? "on" : ""} onClick={() => selectVista("cuentas")}>Pagos por cuenta</button>
      </div>
      {vista === "revertidas" && (
        <p className="lead" style={{ background: "#FBF3E4", padding: "8px 12px", borderRadius: 6 }}>
          Estas facturas figuran como "Revertidas" en Odoo — el pago se anuló o se deshizo. Se muestra la(s)
          rectificativa(s) más probable(s) deducida por compartir el mismo pedido de venta (Origen). Cuando hay
          más de una factura o rectificativa en el mismo pedido, se marca "a confirmar" — revísalo a mano.
        </p>
      )}

      {vista !== "revertidas" && vista !== "pendientes" && vista !== "cuentas" && years.length > 0 && (
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

      {vista === "pendientes" ? (
        <div className="adm-tablewrap">
          {loadingPendientes && <p>Cargando…</p>}
          {!loadingPendientes && (
            <table className="adm-table">
              <thead><tr><th>Número</th><th>Origen</th><th>Cliente</th><th>Fecha</th><th className="r">Total</th><th>Estado</th><th>Marcar pagada</th></tr></thead>
              <tbody>
                {pendientes.map((r) => (
                  <tr key={r.numero}>
                    <td className="mono">{r.numero}</td>
                    <td>{r.origen === "nueva" ? "Nueva" : "Odoo (histórico)"}</td>
                    <td>{r.cliente || "—"}</td>
                    <td>{r.fecha ? fdate(r.fecha) : "—"}</td>
                    <td className="r">{r.total != null ? euro(r.total) : "—"}</td>
                    <td>{r.estado || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          placeholder="Cuenta desde la que se pagó"
                          value={cuentaInput[r.numero] || ""}
                          onChange={(e) => setCuentaInput((s) => ({ ...s, [r.numero]: e.target.value }))}
                          style={{ fontSize: 12, padding: "4px 6px", width: 160 }}
                        />
                        <button className="btn-sm" disabled={marcando === r.numero} onClick={() => marcarPagada(r.origen, r.numero)}>
                          {marcando === r.numero ? "…" : "Marcar pagada"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loadingPendientes && !pendientes.length && <p className="adm-empty">Sin facturas pendientes de pago 🎉</p>}
        </div>
      ) : vista === "cuentas" ? (
        <div className="adm-tablewrap">
          {loadingCuentas && <p>Cargando…</p>}
          {!loadingCuentas && (
            <>
              <p className="lead" style={{ marginTop: 0 }}>
                Solo cuentas de un único método de pago (importe exacto). Pulsa una fila para ver sus facturas.
              </p>
              <table className="adm-table">
                <thead><tr><th>Cuenta</th><th className="r">Nº facturas</th><th className="r">Total</th></tr></thead>
                <tbody>
                  {cuentasLimpias.map((c) => (
                    <Fragment key={c.cuenta}>
                      <tr onClick={() => toggleCuenta(c.cuenta)} style={{ cursor: "pointer" }} className={cuentaAbierta === c.cuenta ? "sel" : ""}>
                        <td>{c.cuenta} {cuentaAbierta === c.cuenta ? "▲" : "▼"}</td>
                        <td className="r">{c.count}</td>
                        <td className="r">{euro(c.total)}</td>
                      </tr>
                      {cuentaAbierta === c.cuenta && (
                        <tr><td colSpan={3}>
                          {loadingCuentaInvoices ? <p>Cargando…</p> : (
                            <table className="adm-table" style={{ marginTop: 4 }}>
                              <thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th className="r">Total factura</th><th className="r">Pagado por este medio</th></tr></thead>
                              <tbody>
                                {cuentaInvoices.map((iv) => (
                                  <tr key={iv.numero}>
                                    <td className="mono">{iv.numero}</td>
                                    <td>{iv.cliente || "—"}</td>
                                    <td>{iv.fecha ? fdate(iv.fecha) : "—"}</td>
                                    <td className="r">{iv.total != null ? euro(iv.total) : "—"}</td>
                                    <td className="r">{iv.importePorEsteMetodo != null ? euro(iv.importePorEsteMetodo) : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {!cuentasLimpias.length && (
                <p className="adm-empty">Aún no hay facturas con cuenta de pago registrada. Se rellena al marcar una factura como pagada, o al importar el dato desde Odoo.</p>
              )}

              {cuentasCombinadas.length > 0 && (
                <>
                  <p className="lead" style={{ marginTop: 24, background: "#FBF3E4", padding: "8px 12px", borderRadius: 6 }}>
                    Estas ya no incluyen las combinaciones resueltas por pago exacto (esas están arriba, con
                    su importe real por cuenta). Lo que queda aquí son casos donde Odoo no daba un pago individual
                    claro — el total de cada fila es el total completo de la factura, no la parte de cada cuenta.
                  </p>
                  <table className="adm-table">
                    <thead><tr><th>Combinación</th><th className="r">Nº facturas</th><th className="r">Total (sin desglosar)</th></tr></thead>
                    <tbody>
                      {cuentasCombinadas.map((c) => (
                        <Fragment key={c.cuenta}>
                          <tr onClick={() => toggleCuenta(c.cuenta)} style={{ cursor: "pointer" }} className={cuentaAbierta === c.cuenta ? "sel" : ""}>
                            <td>{c.cuenta} {cuentaAbierta === c.cuenta ? "▲" : "▼"}</td>
                            <td className="r">{c.count}</td>
                            <td className="r">{euro(c.total)}</td>
                          </tr>
                          {cuentaAbierta === c.cuenta && (
                            <tr><td colSpan={3}>
                              {loadingCuentaInvoices ? <p>Cargando…</p> : (
                                <table className="adm-table" style={{ marginTop: 4 }}>
                                  <thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th className="r">Total</th></tr></thead>
                                  <tbody>
                                    {cuentaInvoices.map((iv) => (
                                      <tr key={iv.numero}>
                                        <td className="mono">{iv.numero}</td>
                                        <td>{iv.cliente || "—"}</td>
                                        <td>{iv.fecha ? fdate(iv.fecha) : "—"}</td>
                                        <td className="r">{iv.total != null ? euro(iv.total) : "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td></tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      ) : vista === "revertidas" ? (
        <div className="adm-tablewrap">
          {loadingRevertidas && <p>Cargando…</p>}
          {!loadingRevertidas && (
            <table className="adm-table">
              <thead><tr><th>Factura revertida</th><th>Cliente</th><th>Fecha</th><th className="r">Total</th><th>Rectificativa(s) candidata(s)</th></tr></thead>
              <tbody>
                {revertidas.map((r) => (
                  <tr key={r.numero} className={r.ambiguo ? "warn" : ""}>
                    <td className="mono">{r.numero}</td>
                    <td>{r.cliente || "—"}</td>
                    <td>{r.fecha ? fdate(r.fecha) : "—"}</td>
                    <td className="r">{r.total != null ? euro(r.total) : "—"}</td>
                    <td>
                      {r.candidatas.length === 0 && <span style={{ color: "#b06a00" }}>⚠ Sin ninguna rectificativa localizada — revisar manualmente en Odoo</span>}
                      {r.candidatas.map((c) => (
                        <div key={c.numero}>
                          <code>{c.numero}</code> {c.total != null && `(${euro(c.total)})`}
                          {c.real && <span style={{ fontSize: 10, color: "var(--olive)", marginLeft: 4 }}>✓ confirmado por Odoo</span>}
                          {c.motivo && <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.motivo}</div>}
                        </div>
                      ))}
                      {r.ambiguo && r.candidatas.length > 1 && (
                        <div style={{ fontSize: 11, color: "#b06a00", marginTop: 2 }}>⚠ A confirmar — varias rectificativas comparten pedido</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loadingRevertidas && !revertidas.length && <p className="adm-empty">Sin facturas revertidas.</p>}
        </div>
      ) : (
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
                <td>
                  {r.estado || "—"}
                  {r.importeAdeudado != null && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      Pagado: {euro(r.importePagado ?? 0)} · Adeudado: <b style={{ color: "#b06a00" }}>{euro(r.importeAdeudado)}</b>
                      {r.notaPago && <div>{r.notaPago}</div>}
                    </div>
                  )}
                </td>
                <td className="c">
                  {r.origen === "nueva" && r.id && (
                    <button className="adm-link" onClick={() => download(r.id!)} disabled={downloading === r.id}>
                      {downloading === r.id ? "…" : "PDF"}
                    </button>
                  )}
                  <AttachmentsButton categoria={r.kind === "credit_note" ? "rectificativas" : "facturas"} referencia={r.numero} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {vista === "todas" || vista === "pagadas" ? (!loading && !rows.length && <p className="adm-empty">Sin resultados.</p>) : null}
    </div>
  );
}
