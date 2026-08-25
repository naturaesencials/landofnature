"use client";
import { Fragment, useEffect, useState } from "react";
import { fdate } from "./types";
import {
  adminQualityStats, adminQualityAlerts, adminQualityChecksSearch, adminQualityPoints, adminExpiringLots, adminChecksByPoint, adminErpLoteDetail,
  adminSaveQualityPoint, adminSaveQualityCheck, adminSaveQualityAlert, adminUpdateLotDates,
  type QualityStats, type QualityAlertRow, type QualityCheckRow, type QualityPointRow, type ExpiringLotRow, type ErpLoteDetail,
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

function AlertaForm({ initial, onSaved, onCancel }: { initial: QualityAlertRow | null; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [lote, setLote] = useState(initial?.lote || "");
  const [producto, setProducto] = useState(initial?.producto || "");
  const [ordenFab, setOrdenFab] = useState(initial?.orden_fabricacion || "");
  const [responsable, setResponsable] = useState(initial?.responsable || "");
  const [prioridad, setPrioridad] = useState(initial?.prioridad || "");
  const [proveedor, setProveedor] = useState(initial?.proveedor || "");
  const [causaRaiz, setCausaRaiz] = useState(initial?.causa_raiz || "");
  const [accionCorrectiva, setAccionCorrectiva] = useState(initial?.accion_correctiva || "");
  const [accionPreventiva, setAccionPreventiva] = useState(initial?.accion_preventiva || "");
  const [cerrada, setCerrada] = useState(!!initial?.fecha_cierre);
  const [fechaCierre, setFechaCierre] = useState(initial?.fecha_cierre ? initial.fecha_cierre.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) { setError("El título es obligatorio."); return; }
    setSaving(true); setError(null);
    const res = await adminSaveQualityAlert({
      id: initial?.id || null, title, description: description.trim() || null,
      lote: lote.trim() || null, producto: producto.trim() || null, orden_fabricacion: ordenFab.trim() || null,
      responsable: responsable.trim() || null, prioridad: prioridad.trim() || null, proveedor: proveedor.trim() || null,
      causa_raiz: causaRaiz.trim() || null, accion_correctiva: accionCorrectiva.trim() || null, accion_preventiva: accionPreventiva.trim() || null,
      fecha_cierre: cerrada ? new Date(fechaCierre).toISOString() : null,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error || "No se pudo guardar."); return; }
    onSaved();
  }

  return (
    <div style={{ background: "var(--cream)", padding: 12, borderRadius: 6, marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 640 }}>
        <label style={{ gridColumn: "1 / -1" }}>Título *<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Lote<input value={lote} onChange={(e) => setLote(e.target.value)} /></label>
        <label>Orden de fabricación<input value={ordenFab} onChange={(e) => setOrdenFab(e.target.value)} /></label>
        <label>Producto<input value={producto} onChange={(e) => setProducto(e.target.value)} /></label>
        <label>Proveedor<input value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></label>
        <label>Responsable<input value={responsable} onChange={(e) => setResponsable(e.target.value)} /></label>
        <label>Prioridad<input value={prioridad} onChange={(e) => setPrioridad(e.target.value)} placeholder="baja / media / alta" /></label>
        <label style={{ gridColumn: "1 / -1" }}>Descripción<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: "100%" }} /></label>
        <label style={{ gridColumn: "1 / -1" }}>Causa raíz<textarea value={causaRaiz} onChange={(e) => setCausaRaiz(e.target.value)} rows={2} style={{ width: "100%" }} /></label>
        <label style={{ gridColumn: "1 / -1" }}>Acción correctiva<textarea value={accionCorrectiva} onChange={(e) => setAccionCorrectiva(e.target.value)} rows={2} style={{ width: "100%" }} /></label>
        <label style={{ gridColumn: "1 / -1" }}>Acción preventiva<textarea value={accionPreventiva} onChange={(e) => setAccionPreventiva(e.target.value)} rows={2} style={{ width: "100%" }} /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={cerrada} onChange={(e) => setCerrada(e.target.checked)} /> Alerta cerrada
        </label>
        {cerrada && <label>Fecha de cierre<input type="date" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} /></label>}
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear alerta"}</button>
        <button className="btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function Alertas() {
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [rows, setRows] = useState<QualityAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QualityAlertRow | null>(null);

  async function load(query?: string, openOnly?: boolean) {
    setLoading(true);
    const res = await adminQualityAlerts({ q: query, onlyOpen: openOnly });
    setLoading(false);
    if (res.ok) setRows(res.rows ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {!creating && !editing && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setCreating(true)}>+ Nueva alerta</button>}
      {creating && <AlertaForm initial={null} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); load(q, onlyOpen); }} />}
      {editing && <AlertaForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setOpen(null); load(q, onlyOpen); }} />}

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
          <thead><tr><th>Título</th><th>Fecha</th><th>Lote / OF</th><th>Producto</th><th>Prioridad</th><th>Estado</th><th /><th /></tr></thead>
          <tbody>
            {rows.map((a) => (
              <Fragment key={a.id}>
                <tr>
                  <td onClick={() => setOpen(open === a.id ? null : a.id)} style={{ cursor: "pointer" }}><b>{a.title || "—"}</b>{a.origen === "web" && <span style={{ fontSize: 10, color: "var(--muted)" }}> (web)</span>}</td>
                  <td>{a.fecha_creacion ? fdate(a.fecha_creacion) : "—"}</td>
                  <td className="mono">{a.lote || a.orden_fabricacion || "—"}</td>
                  <td>{a.producto || "—"}</td>
                  <td>{a.prioridad || "—"}</td>
                  <td>{a.fecha_cierre ? <span style={{ color: "var(--muted)" }}>Cerrada {fdate(a.fecha_cierre)}</span> : <span style={{ color: "#b06a00" }}>Abierta</span>}</td>
                  <td><button className="btn-sm" onClick={() => { setEditing(a); setCreating(false); }}>Editar</button></td>
                  <td><button className="btn-sm" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Ocultar" : "Ver"}</button></td>
                </tr>
                {open === a.id && (
                  <tr><td colSpan={8} style={{ background: "var(--cream)" }}>
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

function ControlForm({ initial, onSaved, onCancel }: { initial: QualityCheckRow | null; onSaved: () => void; onCancel: () => void }) {
  const [puntoControl, setPuntoControl] = useState(initial?.punto_control || "");
  const [tipoControl, setTipoControl] = useState(initial?.tipo_control || "");
  const [resultado, setResultado] = useState(initial?.resultado || "pass");
  const [lote, setLote] = useState(initial?.lote || "");
  const [ordenFab, setOrdenFab] = useState(initial?.orden_fabricacion || "");
  const [producto, setProducto] = useState(initial?.producto || "");
  const [medida, setMedida] = useState(initial?.medida != null ? String(initial.medida) : "");
  const [nota, setNota] = useState(initial?.nota || "");
  const [responsable, setResponsable] = useState(initial?.responsable || "");
  const [fecha, setFecha] = useState(initial?.fecha_control ? initial.fecha_control.slice(0, 16) : new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!puntoControl.trim()) { setError("Indica el punto de control."); return; }
    setSaving(true); setError(null);
    const res = await adminSaveQualityCheck({
      id: initial?.id || null, punto_control: puntoControl, tipo_control: tipoControl.trim() || null, resultado,
      lote: lote.trim() || null, orden_fabricacion: ordenFab.trim() || null, producto: producto.trim() || null,
      medida: medida.trim() ? Number(medida) : null, nota: nota.trim() || null, responsable: responsable.trim() || null,
      fecha_control: new Date(fecha).toISOString(),
    });
    setSaving(false);
    if (!res.ok) { setError(res.error || "No se pudo guardar."); return; }
    onSaved();
  }

  return (
    <div style={{ background: "var(--cream)", padding: 12, borderRadius: 6, marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 640 }}>
        <label>Punto de control *<input value={puntoControl} onChange={(e) => setPuntoControl(e.target.value)} placeholder="Código o título del punto" /></label>
        <label>Tipo de control<input value={tipoControl} onChange={(e) => setTipoControl(e.target.value)} /></label>
        <label>Resultado
          <select value={resultado} onChange={(e) => setResultado(e.target.value)} style={{ width: "100%" }}>
            <option value="pass">Correcto</option>
            <option value="fail">Fallo</option>
            <option value="none">Sin resultado</option>
          </select>
        </label>
        <label>Medida<input value={medida} onChange={(e) => setMedida(e.target.value)} inputMode="decimal" /></label>
        <label>Lote<input value={lote} onChange={(e) => setLote(e.target.value)} /></label>
        <label>Orden de fabricación<input value={ordenFab} onChange={(e) => setOrdenFab(e.target.value)} placeholder="WH/MO/00000" /></label>
        <label>Producto<input value={producto} onChange={(e) => setProducto(e.target.value)} /></label>
        <label>Responsable<input value={responsable} onChange={(e) => setResponsable(e.target.value)} /></label>
        <label>Fecha y hora del control<input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <label style={{ gridColumn: "1 / -1" }}>Nota / instrucción<textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} style={{ width: "100%" }} /></label>
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : initial ? "Guardar cambios" : "Registrar control"}</button>
        <button className="btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
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
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QualityCheckRow | null>(null);

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

      {!creating && !editing && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setCreating(true)}>+ Registrar control</button>}
      {creating && <ControlForm initial={null} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); if (q.trim().length >= 2) search(); }} />}
      {editing && <ControlForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setOpen(null); if (q.trim().length >= 2) search(); }} />}

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
          <thead><tr><th>Punto de control</th><th>Resultado</th><th>Lote</th><th>Orden fabricación</th><th>Producto</th><th className="r">Medida</th><th>Fecha</th><th /><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <Fragment key={c.id}>
                <tr>
                  <td onClick={() => setOpen(open === c.id ? null : c.id)} style={{ cursor: "pointer" }}>{c.punto_control || "—"}{c.origen === "web" && <span style={{ fontSize: 10, color: "var(--muted)" }}> (web)</span>}</td>
                  <td onClick={() => setOpen(open === c.id ? null : c.id)} style={{ cursor: "pointer", color: c.resultado === "fail" ? "#b00020" : c.resultado === "pass" ? "var(--olive)" : undefined }}>
                    {c.resultado === "pass" ? "✓ Correcto" : c.resultado === "fail" ? "✕ Fallo" : c.resultado || "—"}
                  </td>
                  <td className="mono">{c.lote || "—"}</td>
                  <td className="mono">{c.orden_fabricacion || "—"}</td>
                  <td>{c.producto || "—"}</td>
                  <td className="r">{c.medida ?? "—"}</td>
                  <td>{c.fecha_control ? fdate(c.fecha_control) : "—"}</td>
                  <td className="c"><button className="btn-sm" onClick={() => { setEditing(c); setCreating(false); }}>Editar</button></td>
                  <td className="c"><button className="btn-sm" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Ocultar" : "Ver"}</button></td>
                </tr>
                {open === c.id && (
                  <tr><td colSpan={9} style={{ background: "var(--cream)" }}>
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

function LotDatesEditor({ lote, productCode, lot, onSaved }: {
  lote: string; productCode: string | null;
  lot: { expiration_date: string | null; use_date: string | null; removal_date: string | null; alert_date: string | null };
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expiration, setExpiration] = useState(lot.expiration_date ? lot.expiration_date.slice(0, 10) : "");
  const [use, setUse] = useState(lot.use_date ? lot.use_date.slice(0, 10) : "");
  const [removal, setRemoval] = useState(lot.removal_date ? lot.removal_date.slice(0, 10) : "");
  const [alert, setAlert] = useState(lot.alert_date ? lot.alert_date.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    const res = await adminUpdateLotDates({
      lote, product_code: productCode,
      expiration_date: expiration || null, use_date: use || null, removal_date: removal || null, alert_date: alert || null,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error || "No se pudo guardar."); return; }
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span><b>Caducidad:</b> {lot.expiration_date ? fdate(lot.expiration_date) : "—"}</span>
        <span><b>Consumo preferente:</b> {lot.use_date ? fdate(lot.use_date) : "—"}</span>
        <button className="btn-sm" onClick={() => setEditing(true)}>Editar fechas</button>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 10, background: "#fff", padding: 8, borderRadius: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 480 }}>
        <label>Caducidad<input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} /></label>
        <label>Consumo preferente<input type="date" value={use} onChange={(e) => setUse(e.target.value)} /></label>
        <label>Fecha de retirada<input type="date" value={removal} onChange={(e) => setRemoval(e.target.value)} /></label>
        <label>Fecha de alerta<input type="date" value={alert} onChange={(e) => setAlert(e.target.value)} /></label>
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button className="btn-sm" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        <button className="btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
      </div>
    </div>
  );
}

function Caducidades() {
  const [rows, setRows] = useState<ExpiringLotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyExpired, setOnlyExpired] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<ErpLoteDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load(exp: boolean) {
    setLoading(true);
    const res = await adminExpiringLots({ onlyExpired: exp, days: 60 });
    setLoading(false);
    if (res.ok) setRows(res.rows ?? []);
  }
  useEffect(() => { load(false); }, []);

  async function toggle(l: ExpiringLotRow) {
    const key = `${l.lote}|${l.product_code}`;
    if (open === key) { setOpen(null); return; }
    setOpen(key); setDetail(null); setLoadingDetail(true);
    const res = await adminErpLoteDetail(l.lote, l.product_code || undefined);
    setLoadingDetail(false);
    if (res.ok) setDetail(res.detail ?? null);
  }

  return (
    <div>
      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={!onlyExpired ? "on" : ""} onClick={() => { setOnlyExpired(false); setOpen(null); load(false); }}>Próximas 60 días</button>
        <button className={onlyExpired ? "on" : ""} onClick={() => { setOnlyExpired(true); setOpen(null); load(true); }}>Ya vencidas</button>
      </div>
      <p className="lead" style={{ marginTop: 0, fontSize: 12 }}>Pulsa un lote para ver su informe completo: controles de calidad, alertas, orden de fabricación y a quién se vendió.</p>
      {loading && <p>Cargando…</p>}
      {!loading && (
        <table className="adm-table">
          <thead><tr><th>Lote</th><th>Producto</th><th className="r">Cantidad</th><th>Ubicación</th><th>Caducidad</th><th /></tr></thead>
          <tbody>
            {rows.map((l, i) => {
              const key = `${l.lote}|${l.product_code}`;
              return (
                <Fragment key={`${key}-${i}`}>
                  <tr onClick={() => toggle(l)} style={{ cursor: "pointer" }} className={l.vencido ? "warn" : ""}>
                    <td className="mono">{l.lote}</td>
                    <td>{l.product_name || l.product_code || "—"}</td>
                    <td className="r">{l.cantidad ?? "—"}</td>
                    <td>{l.ubicacion || "—"}</td>
                    <td style={{ color: l.vencido ? "#b00020" : undefined }}>
                      {l.expiration_date ? fdate(l.expiration_date) : "—"}{l.vencido && " ⚠"}
                    </td>
                    <td className="c"><button className="btn-sm">{open === key ? "Ocultar" : "Ver"}</button></td>
                  </tr>
                  {open === key && (
                    <tr><td colSpan={6} style={{ background: "var(--cream)" }}>
                      {loadingDetail && <p>Cargando…</p>}
                      {!loadingDetail && detail && detail.lote && (
                        <div style={{ fontSize: 13 }}>
                          <LotDatesEditor lote={l.lote} productCode={l.product_code} lot={detail.lote} onSaved={() => load(onlyExpired)} />
                          {detail.orders.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <b>Orden(es) de fabricación:</b> {detail.orders.map((o) => `${o.referencia} (${o.estado}, ${o.fecha_final ? fdate(o.fecha_final) : "—"})`).join(", ")}
                            </div>
                          )}
                          {detail.exactSales.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <b>Vendido en:</b> {detail.exactSales.map((s) => `${s.numero} (${s.partner || "—"})`).join(", ")}
                            </div>
                          )}
                          {detail.qualityAlerts.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <b>Alertas de calidad ({detail.qualityAlerts.length}):</b>
                              {detail.qualityAlerts.map((a) => <div key={a.id}>— {a.title} ({a.fecha_creacion ? fdate(a.fecha_creacion) : "—"})</div>)}
                            </div>
                          )}
                          {detail.qualityChecks.length > 0 ? (
                            <div>
                              <b>Controles de calidad ({detail.qualityChecks.length}):</b>
                              <table className="adm-table" style={{ marginTop: 4 }}>
                                <thead><tr><th>Punto</th><th>Resultado</th><th>Medida</th><th>Fecha</th></tr></thead>
                                <tbody>
                                  {detail.qualityChecks.map((c) => (
                                    <tr key={c.id}>
                                      <td>{c.punto_control || "—"}</td>
                                      <td style={{ color: c.resultado === "fail" ? "#b00020" : c.resultado === "pass" ? "var(--olive)" : undefined }}>
                                        {c.resultado === "pass" ? "✓" : c.resultado === "fail" ? "✕" : c.resultado || "—"}
                                      </td>
                                      <td>{c.medida ?? "—"}</td>
                                      <td>{c.fecha_control ? fdate(c.fecha_control) : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : <p style={{ color: "var(--muted)", margin: 0 }}>Sin controles de calidad registrados para este lote.</p>}
                        </div>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
      {!loading && !rows.length && <p className="adm-empty">Sin lotes en ese rango.</p>}
    </div>
  );
}

function PuntoForm({ initial, onSaved, onCancel }: { initial: QualityPointRow | null; onSaved: () => void; onCancel: () => void }) {
  const [titulo, setTitulo] = useState(initial?.titulo || "");
  const [tipo, setTipo] = useState(initial?.tipo_control || "");
  const [norma, setNorma] = useState(initial?.norma != null ? String(initial.norma) : "");
  const [tolMin, setTolMin] = useState(initial?.tolerancia_min != null ? String(initial.tolerancia_min) : "");
  const [tolMax, setTolMax] = useState(initial?.tolerancia_max != null ? String(initial.tolerancia_max) : "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    setSaving(true); setError(null);
    const res = await adminSaveQualityPoint({
      codigo: initial?.codigo || null, titulo: titulo.trim(), tipo_control: tipo.trim() || null,
      norma: norma.trim() ? Number(norma) : null, tolerancia_min: tolMin.trim() ? Number(tolMin) : null,
      tolerancia_max: tolMax.trim() ? Number(tolMax) : null, descripcion: descripcion.trim() || null,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error || "No se pudo guardar."); return; }
    onSaved();
  }

  return (
    <div style={{ background: "var(--cream)", padding: 12, borderRadius: 6, marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 640 }}>
        <label style={{ gridColumn: "1 / -1" }}>Título *<input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Peso caja finalizada" /></label>
        <label>Tipo de control<input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ej: measure, pass_fail, instructions..." /></label>
        <label>Norma (valor objetivo)<input value={norma} onChange={(e) => setNorma(e.target.value)} inputMode="decimal" /></label>
        <label>Tolerancia mínima<input value={tolMin} onChange={(e) => setTolMin(e.target.value)} inputMode="decimal" /></label>
        <label>Tolerancia máxima<input value={tolMax} onChange={(e) => setTolMax(e.target.value)} inputMode="decimal" /></label>
        <label style={{ gridColumn: "1 / -1" }}>Descripción / instrucción<textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} style={{ width: "100%" }} /></label>
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear punto"}</button>
        <button className="btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function Puntos() {
  const [rows, setRows] = useState<QualityPointRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [checks, setChecks] = useState<QualityCheckRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QualityPointRow | null>(null);

  async function load() { const res = await adminQualityPoints(); if (res.ok) setRows(res.rows ?? []); }
  useEffect(() => { load(); }, []);

  async function toggle(codigo: string) {
    if (open === codigo) { setOpen(null); return; }
    setOpen(codigo); setLoadingChecks(true); setChecks([]);
    const res = await adminChecksByPoint(codigo);
    setLoadingChecks(false);
    if (res.ok) { setChecks(res.rows ?? []); setTotal(res.total ?? 0); }
  }

  if (!rows) return <p>Cargando…</p>;
  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>Catálogo de los {rows.length} puntos de control definidos en el proceso de producción — qué se comprueba, con qué método y contra qué tolerancia. Pulsa uno para ver sus últimos controles realizados.</p>

      {!creating && !editing && <button className="btn" style={{ marginBottom: 12 }} onClick={() => setCreating(true)}>+ Nuevo punto de control</button>}
      {creating && <PuntoForm initial={null} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {editing && <PuntoForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      <table className="adm-table">
        <thead><tr><th>Código</th><th>Título</th><th>Tipo</th><th className="r">Norma</th><th className="r">Tolerancia</th><th /><th /></tr></thead>
        <tbody>
          {rows.map((p) => (
            <Fragment key={p.codigo}>
              <tr>
                <td className="mono" onClick={() => toggle(p.codigo)} style={{ cursor: "pointer" }}>{p.codigo}{p.origen === "web" && <span style={{ fontSize: 10, color: "var(--muted)" }}> (web)</span>}</td>
                <td onClick={() => toggle(p.codigo)} style={{ cursor: "pointer" }}>{p.titulo || "—"}</td>
                <td onClick={() => toggle(p.codigo)} style={{ cursor: "pointer" }}>{p.tipo_control || "—"}</td>
                <td className="r" onClick={() => toggle(p.codigo)} style={{ cursor: "pointer" }}>{p.norma ?? "—"}</td>
                <td className="r" onClick={() => toggle(p.codigo)} style={{ cursor: "pointer" }}>{p.tolerancia_min != null || p.tolerancia_max != null ? `${p.tolerancia_min ?? "?"} – ${p.tolerancia_max ?? "?"}` : "—"}</td>
                <td className="c"><button className="btn-sm" onClick={() => { setEditing(p); setCreating(false); }}>Editar</button></td>
                <td className="c"><button className="btn-sm" onClick={() => toggle(p.codigo)}>{open === p.codigo ? "Ocultar" : "Ver"}</button></td>
              </tr>
              {open === p.codigo && (
                <tr><td colSpan={7} style={{ background: "var(--cream)" }}>
                  {p.descripcion && <div style={{ marginBottom: 8, fontSize: 13 }}><b>Instrucción:</b> {p.descripcion}</div>}
                  {loadingChecks && <p>Cargando…</p>}
                  {!loadingChecks && (
                    <>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>{total} controles en total con este punto — mostrando los últimos {checks.length}.</p>
                      {checks.length > 0 && (
                        <table className="adm-table">
                          <thead><tr><th>Lote</th><th>Orden fabricación</th><th>Producto</th><th>Resultado</th><th className="r">Medida</th><th>Fecha</th></tr></thead>
                          <tbody>
                            {checks.map((c) => (
                              <tr key={c.id}>
                                <td className="mono">{c.lote || "—"}</td>
                                <td className="mono">{c.orden_fabricacion || "—"}</td>
                                <td>{c.producto || "—"}</td>
                                <td style={{ color: c.resultado === "fail" ? "#b00020" : c.resultado === "pass" ? "var(--olive)" : undefined }}>
                                  {c.resultado === "pass" ? "✓ Correcto" : c.resultado === "fail" ? "✕ Fallo" : c.resultado || "—"}
                                </td>
                                <td className="r">{c.medida ?? "—"}</td>
                                <td>{c.fecha_control ? fdate(c.fecha_control) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
