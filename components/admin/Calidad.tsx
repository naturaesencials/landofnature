"use client";
import { Fragment, useEffect, useState } from "react";
import { fdate } from "./types";
import {
  adminQualityStats, adminQualityAlerts, adminQualityChecksSearch, adminQualityPoints, adminExpiringLots,
  type QualityStats, type QualityAlertRow, type QualityCheckRow, type QualityPointRow, type ExpiringLotRow,
} from "@/app/admin/actions";

export default function Calidad() {
  const [vista, setVista] = useState<"resumen" | "alertas" | "controles" | "caducidades" | "puntos">("resumen");
  return (
    <div>
      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={vista === "resumen" ? "on" : ""} onClick={() => setVista("resumen")}>Resumen</button>
        <button className={vista === "alertas" ? "on" : ""} onClick={() => setVista("alertas")}>Alertas de calidad</button>
        <button className={vista === "controles" ? "on" : ""} onClick={() => setVista("controles")}>Buscar controles</button>
        <button className={vista === "caducidades" ? "on" : ""} onClick={() => setVista("caducidades")}>Caducidades</button>
        <button className={vista === "puntos" ? "on" : ""} onClick={() => setVista("puntos")}>Puntos de control</button>
      </div>
      {vista === "resumen" && <Resumen onGo={setVista} />}
      {vista === "alertas" && <Alertas />}
      {vista === "controles" && <Controles />}
      {vista === "caducidades" && <Caducidades />}
      {vista === "puntos" && <Puntos />}
    </div>
  );
}

function Kpi({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: "ok" | "bad" | "warn" | "mute"; onClick?: () => void }) {
  return (
    <button className={`adm-kpi ${tone || ""}`} onClick={onClick} type="button">
      <span>{label}</span><b>{value}</b>{sub && <i>{sub}</i>}
    </button>
  );
}

function Resumen({ onGo }: { onGo: (v: "alertas" | "controles" | "caducidades" | "puntos") => void }) {
  const [stats, setStats] = useState<QualityStats | null>(null);
  useEffect(() => { adminQualityStats().then((res) => { if (res.ok) setStats(res.stats ?? null); }); }, []);
  if (!stats) return <p className="adm-hint">Cargando…</p>;
  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>
        Trazabilidad de calidad importada de Odoo: controles de producción, alertas/incidencias y caducidades de lote —
        el tipo de documentación que pediría una auditoría de Sanidad o Consumo.
      </p>
      <div className="adm-kpis" style={{ marginBottom: 24 }}>
        <Kpi label="Controles de calidad" value={String(stats.checksTotal)} sub={`${stats.checksPass} correctos · ${stats.checksFail} fallos`} tone={stats.checksFail > 0 ? "warn" : "ok"} onClick={() => onGo("controles")} />
        <Kpi label="Alertas de calidad" value={String(stats.alertsTotal)} sub={`${stats.alertsOpen} abiertas`} tone={stats.alertsOpen > 0 ? "warn" : "ok"} onClick={() => onGo("alertas")} />
        <Kpi label="Lotes caducados en stock" value={String(stats.lotsExpiredCount)} tone={stats.lotsExpiredCount > 0 ? "bad" : "ok"} onClick={() => onGo("caducidades")} />
        <Kpi label="Caducan en 30 días" value={String(stats.lotsExpiringSoonCount)} tone={stats.lotsExpiringSoonCount > 0 ? "warn" : "ok"} onClick={() => onGo("caducidades")} />
      </div>
      <p className="adm-hint">También puedes ver los controles y alertas de un lote concreto abriendo su informe en <b>Trazabilidad</b>.</p>
    </div>
  );
}

function Alertas() {
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [rows, setRows] = useState<QualityAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  async function load(query?: string, openOnly?: boolean) {
    setLoading(true);
    const res = await adminQualityAlerts({ q: query, onlyOpen: openOnly });
    setLoading(false);
    if (res.ok) setRows(res.rows ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); load(q, onlyOpen); }} style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, lote, orden de fabricación o producto" style={{ flex: 1, maxWidth: 380 }} />
        <label style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={onlyOpen} onChange={(e) => { setOnlyOpen(e.target.checked); load(q, e.target.checked); }} /> Solo abiertas
        </label>
        <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>
      {loading && <p>Cargando…</p>}
      {!loading && (
        <table className="adm-table">
          <thead><tr><th>Título</th><th>Fecha</th><th>Lote / OF</th><th>Producto</th><th>Prioridad</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {rows.map((a) => (
              <Fragment key={a.id}>
                <tr>
                  <td><b>{a.title || "—"}</b></td>
                  <td>{a.fecha_creacion ? fdate(a.fecha_creacion) : "—"}</td>
                  <td className="mono">{a.lote || a.orden_fabricacion || "—"}</td>
                  <td>{a.producto || "—"}</td>
                  <td>{a.prioridad || "—"}</td>
                  <td>{a.fecha_cierre ? <span style={{ color: "var(--muted)" }}>Cerrada {fdate(a.fecha_cierre)}</span> : <span style={{ color: "#b06a00" }}>Abierta</span>}</td>
                  <td><button className="btn-sm" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Ocultar" : "Ver"}</button></td>
                </tr>
                {open === a.id && (
                  <tr><td colSpan={7} style={{ background: "var(--cream)" }}>
                    {a.description && <div style={{ marginBottom: 6 }}><b>Descripción:</b> {a.description}</div>}
                    {a.causa_raiz && <div style={{ marginBottom: 6 }}><b>Causa raíz:</b> {a.causa_raiz}</div>}
                    {a.accion_correctiva && <div style={{ marginBottom: 6 }}><b>Acción correctiva:</b> {a.accion_correctiva}</div>}
                    {a.accion_preventiva && <div style={{ marginBottom: 6 }}><b>Acción preventiva:</b> {a.accion_preventiva}</div>}
                    {a.responsable && <div style={{ fontSize: 12, color: "var(--muted)" }}>Responsable: {a.responsable}{a.proveedor ? ` · Proveedor: ${a.proveedor}` : ""}</div>}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !rows.length && <p className="adm-empty">Sin resultados.</p>}
    </div>
  );
}

function Controles() {
  const [q, setQ] = useState("");
  const [resultado, setResultado] = useState<string>("");
  const [rows, setRows] = useState<QualityCheckRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  async function search() {
    if (q.trim().length < 2) return;
    setLoading(true);
    const res = await adminQualityChecksSearch({ q, resultado: resultado || undefined });
    setLoading(false);
    if (res.ok) { setRows(res.rows ?? []); setTotal(res.total ?? 0); }
  }

  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>Busca por número de lote, orden de fabricación (WH/MO/...) o nombre de producto — hay 17.126 controles, así que hace falta un término de búsqueda. Pulsa una fila para ver todos los detalles.</p>
      <form onSubmit={(e) => { e.preventDefault(); search(); }} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lote, orden de fabricación o producto" style={{ flex: 1, maxWidth: 360 }} />
        <select value={resultado} onChange={(e) => setResultado(e.target.value)} style={{ fontSize: 13 }}>
          <option value="">Todos los resultados</option>
          <option value="pass">Solo correctos</option>
          <option value="fail">Solo fallos</option>
        </select>
        <button className="btn" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
      </form>
      {total != null && <p className="adm-hint">{total} resultados{total > 200 ? " (mostrando los primeros 200)" : ""}</p>}
      {rows.length > 0 && (
        <table className="adm-table">
          <thead><tr><th>Punto de control</th><th>Resultado</th><th>Lote</th><th>Orden fabricación</th><th>Producto</th><th className="r">Medida</th><th>Fecha</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <Fragment key={c.id}>
                <tr onClick={() => setOpen(open === c.id ? null : c.id)} style={{ cursor: "pointer" }}>
                  <td>{c.punto_control || "—"}</td>
                  <td style={{ color: c.resultado === "fail" ? "#b00020" : c.resultado === "pass" ? "var(--olive)" : undefined }}>
                    {c.resultado === "pass" ? "✓ Correcto" : c.resultado === "fail" ? "✕ Fallo" : c.resultado || "—"}
                  </td>
                  <td className="mono">{c.lote || "—"}</td>
                  <td className="mono">{c.orden_fabricacion || "—"}</td>
                  <td>{c.producto || "—"}</td>
                  <td className="r">{c.medida ?? "—"}</td>
                  <td>{c.fecha_control ? fdate(c.fecha_control) : "—"}</td>
                  <td className="c"><button className="btn-sm">{open === c.id ? "Ocultar" : "Ver"}</button></td>
                </tr>
                {open === c.id && (
                  <tr><td colSpan={8} style={{ background: "var(--cream)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                      <div><b>Tipo de control:</b> {c.tipo_control || "—"}</div>
                      <div><b>Responsable:</b> {c.responsable || "—"}</div>
                      <div><b>Fecha exacta:</b> {c.fecha_control ? new Date(c.fecha_control).toLocaleString("es-ES") : "—"}</div>
                      <div><b>Medida registrada:</b> {c.medida ?? "—"}</div>
                    </div>
                    {c.nota && <div style={{ marginTop: 8 }}><b>Nota / instrucción del control:</b><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{c.nota}</div></div>}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Caducidades() {
  const [rows, setRows] = useState<ExpiringLotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyExpired, setOnlyExpired] = useState(false);

  async function load(exp: boolean) {
    setLoading(true);
    const res = await adminExpiringLots({ onlyExpired: exp, days: 60 });
    setLoading(false);
    if (res.ok) setRows(res.rows ?? []);
  }
  useEffect(() => { load(false); }, []);

  return (
    <div>
      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={!onlyExpired ? "on" : ""} onClick={() => { setOnlyExpired(false); load(false); }}>Próximas 60 días</button>
        <button className={onlyExpired ? "on" : ""} onClick={() => { setOnlyExpired(true); load(true); }}>Ya vencidas</button>
      </div>
      {loading && <p>Cargando…</p>}
      {!loading && (
        <table className="adm-table">
          <thead><tr><th>Lote</th><th>Producto</th><th className="r">Cantidad</th><th>Ubicación</th><th>Caducidad</th></tr></thead>
          <tbody>
            {rows.map((l, i) => (
              <tr key={`${l.lote}-${i}`} className={l.vencido ? "warn" : ""}>
                <td className="mono">{l.lote}</td>
                <td>{l.product_name || l.product_code || "—"}</td>
                <td className="r">{l.cantidad ?? "—"}</td>
                <td>{l.ubicacion || "—"}</td>
                <td style={{ color: l.vencido ? "#b00020" : undefined }}>
                  {l.expiration_date ? fdate(l.expiration_date) : "—"}{l.vencido && " ⚠"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !rows.length && <p className="adm-empty">Sin lotes en ese rango.</p>}
    </div>
  );
}

function Puntos() {
  const [rows, setRows] = useState<QualityPointRow[] | null>(null);
  useEffect(() => { adminQualityPoints().then((res) => { if (res.ok) setRows(res.rows ?? []); }); }, []);
  if (!rows) return <p>Cargando…</p>;
  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>Catálogo de los {rows.length} puntos de control definidos en el proceso de producción — qué se comprueba, con qué método y contra qué tolerancia.</p>
      <table className="adm-table">
        <thead><tr><th>Código</th><th>Título</th><th>Tipo</th><th className="r">Norma</th><th className="r">Tolerancia</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.codigo}>
              <td className="mono">{p.codigo}</td>
              <td>{p.titulo || "—"}</td>
              <td>{p.tipo_control || "—"}</td>
              <td className="r">{p.norma ?? "—"}</td>
              <td className="r">{p.tolerancia_min != null || p.tolerancia_max != null ? `${p.tolerancia_min ?? "?"} – ${p.tolerancia_max ?? "?"}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
