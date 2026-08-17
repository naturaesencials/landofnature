"use client";
import { useState } from "react";
import { euro } from "@/lib/types";
import { fdate } from "./types";
import {
  adminCreateManualInvoice, adminInvoicesForRectify, adminInvoiceLinesForRectify, adminCreateCreditNote, adminPartnerByName,
  type InvoiceForRectify,
} from "@/app/admin/actions";

type Line = { description: string; quantity: number; unit_price: number; vat_rate: number };
const emptyLine = (): Line => ({ description: "", quantity: 1, unit_price: 0, vat_rate: 21 });

export default function FacturaManual() {
  const [mode, setMode] = useState<"nueva" | "rectificativa">("nueva");
  return (
    <div>
      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={mode === "nueva" ? "on" : ""} onClick={() => setMode("nueva")}>Factura nueva</button>
        <button className={mode === "rectificativa" ? "on" : ""} onClick={() => setMode("rectificativa")}>Rectificativa (abono)</button>
      </div>
      {mode === "nueva" ? <NuevaFactura /> : <Rectificativa />}
    </div>
  );
}

function LinesEditor({ lines, setLines }: { lines: Line[]; setLines: (l: Line[]) => void }) {
  function update(i: number, patch: Partial<Line>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const vat = lines.reduce((s, l) => s + l.quantity * l.unit_price * (l.vat_rate / 100), 0);
  return (
    <div>
      <table className="adm-table">
        <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio ud.</th><th>IVA %</th><th>Importe</th><th /></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td><input value={l.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Producto o concepto" style={{ width: "100%" }} /></td>
              <td><input type="number" step="0.01" value={l.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} style={{ width: 70 }} /></td>
              <td><input type="number" step="0.01" value={l.unit_price} onChange={(e) => update(i, { unit_price: Number(e.target.value) })} style={{ width: 90 }} /></td>
              <td><input type="number" step="1" value={l.vat_rate} onChange={(e) => update(i, { vat_rate: Number(e.target.value) })} style={{ width: 60 }} /></td>
              <td>{euro(l.quantity * l.unit_price)}</td>
              <td><button className="btn-sm" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} disabled={lines.length <= 1}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-sm" style={{ marginTop: 8 }} onClick={() => setLines([...lines, emptyLine()])}>+ Añadir línea</button>
      <div style={{ marginTop: 10, fontSize: 13 }}>
        Base: <b>{euro(subtotal)}</b> · IVA: <b>{euro(vat)}</b> · Total: <b>{euro(subtotal + vat)}</b>
      </div>
    </div>
  );
}

function NuevaFactura() {
  const [name, setName] = useState("");
  const [cif, setCif] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [province, setProvince] = useState("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) { setError("Falta el nombre del cliente."); return; }
    if (!lines.length || lines.some((l) => !l.description.trim() || l.quantity <= 0)) { setError("Revisa las líneas: cada una necesita descripción y cantidad > 0."); return; }
    setSaving(true); setError(null); setResult(null);
    const res = await adminCreateManualInvoice({
      customer_name: name.trim(), customer_cif: cif.trim() || null, customer_email: email.trim() || null,
      customer_address: address.trim() || null, customer_city: city.trim() || null,
      customer_postal_code: postalCode.trim() || null, customer_province: province.trim() || null,
      notes: notes.trim() || null, lines, send_email: sendEmail && !!email.trim(),
    });
    setSaving(false);
    if (!res.ok) { setError(res.error || "No se pudo crear la factura."); return; }
    setResult(res.numero || null);
    setName(""); setCif(""); setEmail(""); setAddress(""); setCity(""); setPostalCode(""); setProvince(""); setNotes("");
    setLines([emptyLine()]);
  }

  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>Factura fuera del flujo normal de pedidos — se numera con la secuencia legal del mes en curso.</p>
      {result && <p style={{ background: "var(--cream)", padding: "8px 12px", borderRadius: 6 }}>✓ Factura <b>{result}</b> creada correctamente{sendEmail ? " y enviada por email" : ""}.</p>}
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, maxWidth: 640 }}>
        <label>Nombre / razón social *<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>NIF/CIF (opcional)<input value={cif} onChange={(e) => setCif(e.target.value)} /></label>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Ciudad<input value={city} onChange={(e) => setCity(e.target.value)} /></label>
        <label>Provincia<input value={province} onChange={(e) => setProvince(e.target.value)} /></label>
        <label>Código postal<input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></label>
        <label style={{ gridColumn: "1 / -1" }}>Dirección<input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label style={{ gridColumn: "1 / -1" }}>Notas internas (no aparecen en el PDF)<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>

      <LinesEditor lines={lines} setLines={setLines} />

      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
        <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
        Enviar por email al cliente (si hay email)
      </label>

      <button className="btn" style={{ marginTop: 14 }} onClick={submit} disabled={saving}>{saving ? "Creando…" : "Crear factura"}</button>
    </div>
  );
}

function Rectificativa() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<InvoiceForRectify[]>([]);
  const [selected, setSelected] = useState<InvoiceForRectify | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Datos de cliente editables — necesarios cuando se rectifica una factura del histórico de Odoo,
  // que no trae email/dirección; se autocompletan desde el Directorio si existe coincidencia por nombre.
  const [custEmail, setCustEmail] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custCity, setCustCity] = useState("");
  const [custPostalCode, setCustPostalCode] = useState("");
  const [custProvince, setCustProvince] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);

  async function search() {
    if (q.trim().length < 2) return;
    const res = await adminInvoicesForRectify(q);
    if (res.ok) setResults(res.rows ?? []);
  }

  async function select(inv: InvoiceForRectify) {
    setSelected(inv); setResults([]); setQ(""); setResult(null); setError(null);
    setCustEmail(""); setCustAddress(""); setCustCity(""); setCustPostalCode(""); setCustProvince(""); setPartnerId(null);
    setLoadingLines(true);
    const [linesRes, partnerRes] = await Promise.all([
      adminInvoiceLinesForRectify(inv.source, inv.id ?? inv.numero),
      inv.source === "odoo" ? adminPartnerByName(inv.customer_name) : Promise.resolve(null),
    ]);
    setLoadingLines(false);
    if (linesRes.ok) setLines((linesRes.lines ?? []).length ? (linesRes.lines as Line[]) : [emptyLine()]);
    if (partnerRes?.ok && partnerRes.partner) {
      const p = partnerRes.partner;
      setCustEmail(p.email || ""); setCustAddress(p.address || ""); setCustCity(p.city || "");
      setCustPostalCode(p.postal_code || ""); setCustProvince(p.province || ""); setPartnerId(p.id);
    }
  }

  async function submit() {
    if (!selected) return;
    if (!reason.trim()) { setError("Indica el motivo de la rectificación."); return; }
    if (!lines.length || lines.some((l) => !l.description.trim() || l.quantity <= 0)) { setError("Revisa las líneas a abonar."); return; }
    setSaving(true); setError(null); setResult(null);
    const res = await adminCreateCreditNote({
      rectifies_invoice_id: selected.source === "nueva" ? selected.id : null,
      rectifies_numero_externo: selected.source === "odoo" ? selected.numero : null,
      customer_name: selected.customer_name, customer_cif: selected.cif || null,
      customer_email: custEmail || null, customer_address: custAddress || null,
      customer_city: custCity || null, customer_postal_code: custPostalCode || null, customer_province: custProvince || null,
      partner_id: partnerId,
      reason: reason.trim(), lines, send_email: sendEmail,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error || "No se pudo crear la rectificativa."); return; }
    setResult(res.numero || null);
    setSelected(null); setLines([]); setReason("");
  }

  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>
        Busca la factura original — tanto nuevas de la web como del histórico de Odoo — y genera su abono
        con numeración legal continuada (<code>REINV/AAAA/NNNNN</code>).
      </p>
      {result && <p style={{ background: "var(--cream)", padding: "8px 12px", borderRadius: 6 }}>✓ Rectificativa <b>{result}</b> creada correctamente{sendEmail ? " y enviada por email" : ""}.</p>}
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {!selected && (
        <>
          <form onSubmit={(e) => { e.preventDefault(); search(); }} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número de factura o cliente" style={{ flex: 1, maxWidth: 360 }} />
            <button className="btn">Buscar</button>
          </form>
          {results.length > 0 && (
            <table className="adm-table">
              <thead><tr><th>Número</th><th>Origen</th><th>Cliente</th><th>Fecha</th><th>Total</th><th /></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={`${r.source}-${r.numero}`}>
                    <td><code>{r.numero}</code></td>
                    <td>{r.source === "nueva" ? "Nueva" : "Odoo (histórico)"}</td>
                    <td>{r.customer_name}</td>
                    <td>{r.issue_date ? fdate(r.issue_date) : "—"}</td>
                    <td>{euro(r.total)}</td>
                    <td><button className="btn-sm" onClick={() => select(r)}>Elegir →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {selected && (
        <div>
          <p>
            Rectificando <b>{selected.numero}</b> ({selected.customer_name}, {euro(selected.total)})
            {selected.source === "odoo" && <span style={{ color: "var(--muted)" }}> — histórico de Odoo</span>}
            {" — "}<button className="btn-sm" onClick={() => setSelected(null)}>Cambiar</button>
          </p>
          <label style={{ display: "block", marginBottom: 12, maxWidth: 480 }}>
            Motivo de la rectificación *
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: devolución parcial, error en cantidad..." style={{ width: "100%" }} />
          </label>

          {selected.source === "odoo" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, maxWidth: 640 }}>
              <label>Email (para enviarla){!custEmail && !loadingLines && <span style={{ color: "var(--muted)", fontWeight: 400 }}> — sin coincidencia en Directorio, rellénalo si quieres enviarla</span>}
                <input value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
              </label>
              <label>Ciudad<input value={custCity} onChange={(e) => setCustCity(e.target.value)} /></label>
              <label>Provincia<input value={custProvince} onChange={(e) => setCustProvince(e.target.value)} /></label>
              <label>Código postal<input value={custPostalCode} onChange={(e) => setCustPostalCode(e.target.value)} /></label>
              <label style={{ gridColumn: "1 / -1" }}>Dirección<input value={custAddress} onChange={(e) => setCustAddress(e.target.value)} /></label>
            </div>
          )}

          {loadingLines ? <p>Cargando líneas…</p> : (
            <>
              <p className="lead" style={{ fontSize: 12 }}>Ajusta las líneas a abonar (por defecto, las mismas que la factura original — bórralas o cambia cantidades si es un abono parcial).</p>
              <LinesEditor lines={lines} setLines={setLines} />
            </>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Enviar por email al cliente
          </label>
          <button className="btn" style={{ marginTop: 14 }} onClick={submit} disabled={saving || loadingLines}>{saving ? "Creando…" : "Crear rectificativa"}</button>
        </div>
      )}
    </div>
  );
}
