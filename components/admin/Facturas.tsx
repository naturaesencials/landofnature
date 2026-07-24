"use client";
import { useMemo, useState, Fragment } from "react";
import { euro } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  type Invoice, type Payment, type Contract,
  fdateES, today, invoiceDueDate, invoiceOutstanding, isOverdue, INVOICE_STATUS, round2,
} from "@/lib/contracts";
import type { Client } from "./types";
import { clientLabel, num } from "./types";
import { adminSaveInvoice, adminDeleteInvoice, adminAddPayment, adminDeletePayment, adminDocUrl } from "@/app/admin/actions";

type Row = Invoice & { _busy?: boolean };

export default function Facturas({ invoices, payments, clients, contracts }: {
  invoices: Invoice[]; payments: Payment[]; clients: Client[]; contracts: Contract[];
}) {
  const [rows, setRows] = useState<Row[]>(invoices);
  const [pays, setPays] = useState<Payment[]>(payments);
  const [dir, setDir] = useState<"all" | "sale" | "purchase">("all");
  const [only, setOnly] = useState<"all" | "open" | "overdue">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => rows.filter((i) => {
    if (dir !== "all" && i.direction !== dir) return false;
    if (only === "open" && (i.status === "paid" || i.status === "cancelled")) return false;
    if (only === "overdue" && !isOverdue(i)) return false;
    const who = i.direction === "sale" ? (clients.find((c) => c.id === i.client_id)?.company || "") : (i.counterparty || "");
    return `${i.number || ""} ${who} ${i.concept || ""} ${i.category || ""}`.toLowerCase().includes(q.toLowerCase());
  }), [rows, dir, only, q, clients]);

  const totals = useMemo(() => {
    const t = { cobrar: 0, pagar: 0, vencidoCobrar: 0, vencidoPagar: 0 };
    for (const i of rows) {
      const out = invoiceOutstanding(i);
      if (out <= 0) continue;
      if (i.direction === "sale") { t.cobrar += out; if (isOverdue(i)) t.vencidoCobrar += out; }
      else { t.pagar += out; if (isOverdue(i)) t.vencidoPagar += out; }
    }
    return t;
  }, [rows]);

  function upsertRow(r: Row) {
    setRows((rs) => (rs.some((x) => x.id === r.id) ? rs.map((x) => (x.id === r.id ? r : x)) : [r, ...rs]));
  }

  return (
    <div>
      <div className="adm-kpis small">
        <Kpi label="Pendiente de cobro" value={euro(round2(totals.cobrar))} tone="ok" />
        <Kpi label="Vencido por cobrar" value={euro(round2(totals.vencidoCobrar))} tone={totals.vencidoCobrar > 0 ? "bad" : "mute"} />
        <Kpi label="Pendiente de pago" value={euro(round2(totals.pagar))} tone="mute" />
        <Kpi label="Vencido por pagar" value={euro(round2(totals.vencidoPagar))} tone={totals.vencidoPagar > 0 ? "bad" : "mute"} />
      </div>

      <div className="adm-bar">
        <select className="adm-select" value={dir} onChange={(e) => setDir(e.target.value as typeof dir)}>
          <option value="all">Todas</option><option value="sale">Cobros (ventas)</option><option value="purchase">Gastos (compras)</option>
        </select>
        <select className="adm-select" value={only} onChange={(e) => setOnly(e.target.value as typeof only)}>
          <option value="all">Cualquier estado</option><option value="open">Solo pendientes</option><option value="overdue">Solo vencidas</option>
        </select>
        <input className="adm-search" placeholder="Buscar por número, cliente, proveedor o concepto…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="adm-save" onClick={() => setCreating((v) => !v)}>{creating ? "Cerrar" : "Nueva factura"}</button>
      </div>

      {creating && (
        <InvoiceForm
          clients={clients} contracts={contracts}
          onSaved={(r) => { upsertRow(r); setCreating(false); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {filtered.length === 0 ? <p className="adm-empty">No hay facturas que coincidan.</p> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr>
              <th>Tipo</th><th>Número</th><th>Contraparte</th><th>Emisión</th><th>Vencimiento</th>
              <th className="r">Total</th><th className="r">Pendiente</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map((i) => {
                const out = invoiceOutstanding(i);
                const over = isOverdue(i);
                const who = i.direction === "sale"
                  ? (clients.find((c) => c.id === i.client_id) ? clientLabel(clients.find((c) => c.id === i.client_id)!) : "—")
                  : (i.counterparty || "—");
                return (
                  <Fragment key={i.id}>
                    <tr className={over ? "warn" : ""}>
                      <td><span className={`adm-chip ${i.direction === "sale" ? "ok" : "pend"}`}>{i.direction === "sale" ? "Cobro" : "Gasto"}</span></td>
                      <td className="mono">{i.number || "—"}</td>
                      <td><b>{who}</b>{i.concept && <span className="sub">{i.concept}</span>}</td>
                      <td>{fdateES(i.issue_date)}</td>
                      <td className={over ? "over" : ""}>{fdateES(i.due_date)}</td>
                      <td className="r"><b>{euro(Number(i.total))}</b></td>
                      <td className="r mono">{out > 0 ? euro(out) : "—"}</td>
                      <td><span className={`adm-chip ${i.status === "paid" ? "ok" : i.status === "cancelled" ? "no" : "pend"}`}>{INVOICE_STATUS[i.status]}</span></td>
                      <td className="c"><button className="adm-link" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? "Ocultar" : "Detalle"}</button></td>
                    </tr>
                    {open === i.id && (
                      <tr className="adm-detail"><td colSpan={9}>
                        <InvoiceDetail
                          invoice={i} clients={clients}
                          payments={pays.filter((p) => p.invoice_id === i.id)}
                          onInvoice={(r) => upsertRow(r)}
                          onPayments={(list) => setPays((ps) => [...ps.filter((p) => p.invoice_id !== i.id), ...list])}
                          onDeleted={() => { setRows((rs) => rs.filter((x) => x.id !== i.id)); setOpen(null); }}
                        />
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Alta / edición ---------- */
function InvoiceForm({ clients, contracts, invoice, onSaved, onCancel }: {
  clients: Client[]; contracts: Contract[]; invoice?: Invoice;
  onSaved: (i: Invoice) => void; onCancel: () => void;
}) {
  const [f, setF] = useState<Partial<Invoice>>(() => invoice ?? {
    direction: "purchase", number: "", client_id: null, counterparty: "", concept: "", category: "",
    issue_date: today(), due_date: null, base: 0, vat: 0, total: 0, status: "pending", notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const set = (p: Partial<Invoice>) => setF((x) => ({ ...x, ...p }));

  /* Base + IVA → total; y vencimiento sugerido según el contrato del cliente */
  function setBase(v: string) {
    const b = num(v);
    const vat = round2(b * 0.21);
    set({ base: b, vat, total: round2(b + vat) });
  }
  function setClient(id: string) {
    const c = contracts.find((x) => x.client_id === id);
    const days = c?.payment_terms_days ?? 30;
    set({ client_id: id || null, due_date: f.issue_date ? invoiceDueDate(f.issue_date, days) : null });
  }

  async function save() {
    setBusy(true); setMsg("");
    let file_path = f.file_path ?? null;
    if (file) {
      const sb = createClient();
      const folder = f.direction === "sale" ? `sale/${f.client_id || "sin-cliente"}` : "purchase";
      const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await sb.storage.from("invoices").upload(path, file, { upsert: false });
      if (error) { setBusy(false); setMsg(`No se pudo subir el archivo: ${error.message}`); return; }
      file_path = path;
    }
    const payload = {
      ...f, file_path,
      base: Number(f.base) || 0, vat: Number(f.vat) || 0, total: Number(f.total) || 0,
      client_id: f.direction === "sale" ? f.client_id || null : null,
      counterparty: f.direction === "purchase" ? f.counterparty || null : f.counterparty || null,
    };
    const res = await adminSaveInvoice(payload as never);
    setBusy(false);
    if (!res.ok) { setMsg(res.error || "Error al guardar."); return; }
    onSaved({ ...(payload as Invoice), id: res.id as string, paid_amount: Number(f.paid_amount) || 0 });
  }

  return (
    <div className="adm-box">
      <div className="adm-dt">{invoice ? "Editar factura" : "Nueva factura"}</div>
      <div className="adm-ctgrid">
        <label className="adm-ctfield"><span>Tipo</span>
          <select className="adm-select" value={f.direction} onChange={(e) => set({ direction: e.target.value as Invoice["direction"] })}>
            <option value="purchase">Gasto · factura recibida</option>
            <option value="sale">Cobro · factura emitida a cliente</option>
          </select>
        </label>
        <label className="adm-ctfield"><span>Número</span>
          <input className="adm-input" value={f.number || ""} onChange={(e) => set({ number: e.target.value })} placeholder="F-2026-001" />
        </label>
        {f.direction === "sale" ? (
          <label className="adm-ctfield"><span>Cliente</span>
            <select className="adm-select" value={f.client_id || ""} onChange={(e) => setClient(e.target.value)}>
              <option value="">Selecciona…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
            </select>
          </label>
        ) : (
          <label className="adm-ctfield"><span>Proveedor</span>
            <input className="adm-input" value={f.counterparty || ""} onChange={(e) => set({ counterparty: e.target.value })} placeholder="Nombre del proveedor" />
          </label>
        )}
        <label className="adm-ctfield"><span>Concepto</span>
          <input className="adm-input wide" value={f.concept || ""} onChange={(e) => set({ concept: e.target.value })} placeholder="Materia prima, transporte, envases…" />
        </label>
        <label className="adm-ctfield"><span>Categoría</span>
          <input className="adm-input" value={f.category || ""} onChange={(e) => set({ category: e.target.value })} placeholder="Producción / Logística / Marketing…" />
        </label>
        <label className="adm-ctfield"><span>Emisión</span>
          <input type="date" className="adm-input" value={f.issue_date || ""} onChange={(e) => set({ issue_date: e.target.value })} />
        </label>
        <label className="adm-ctfield"><span>Vencimiento</span>
          <input type="date" className="adm-input" value={f.due_date || ""} onChange={(e) => set({ due_date: e.target.value })} />
        </label>
        <label className="adm-ctfield"><span>Base (€)</span>
          <input className="adm-input" inputMode="decimal" value={f.base ?? ""} onChange={(e) => setBase(e.target.value)} />
        </label>
        <label className="adm-ctfield"><span>IVA (€)</span>
          <input className="adm-input" inputMode="decimal" value={f.vat ?? ""} onChange={(e) => { const v = num(e.target.value); set({ vat: v, total: round2((Number(f.base) || 0) + v) }); }} />
        </label>
        <label className="adm-ctfield"><span>Total (€)</span>
          <input className="adm-input" inputMode="decimal" value={f.total ?? ""} onChange={(e) => set({ total: num(e.target.value) })} />
        </label>
        <label className="adm-ctfield"><span>Documento (PDF o imagen)</span>
          <input type="file" accept="application/pdf,image/*,.csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="adm-ctfield"><span>Notas</span>
          <input className="adm-input wide" value={f.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </div>
      <div className="adm-shiprow" style={{ marginTop: 10 }}>
        <button className="adm-save" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar factura"}</button>
        <button className="adm-link" onClick={onCancel}>Cancelar</button>
      </div>
      {msg && <div className="adm-err">{msg}</div>}
    </div>
  );
}

/* ---------- Detalle y pagos ---------- */
function InvoiceDetail({ invoice, clients, payments, onInvoice, onPayments, onDeleted }: {
  invoice: Invoice; clients: Client[]; payments: Payment[];
  onInvoice: (i: Invoice) => void; onPayments: (p: Payment[]) => void; onDeleted: () => void;
}) {
  const [list, setList] = useState<Payment[]>(payments);
  const [inv, setInv] = useState<Invoice>(invoice);
  const [amount, setAmount] = useState(String(invoiceOutstanding(invoice) || ""));
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState("transferencia");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);

  async function addPay() {
    const a = num(amount);
    if (!a) { setMsg("Introduce un importe."); return; }
    setBusy(true); setMsg("");
    const res = await adminAddPayment({ invoice_id: inv.id, amount: a, paid_on: paidOn, method, reference: ref });
    setBusy(false);
    if (!res.ok) { setMsg(res.error || "Error"); return; }
    const p: Payment = { id: res.id as string, invoice_id: inv.id, paid_on: paidOn, amount: a, method, reference: ref || null };
    const next = [p, ...list];
    setList(next); onPayments(next);
    const updated = { ...inv, paid_amount: res.paid_amount ?? inv.paid_amount, status: (res.status as Invoice["status"]) ?? inv.status };
    setInv(updated); onInvoice(updated);
    setAmount(""); setRef("");
  }

  async function delPay(p: Payment) {
    setBusy(true);
    const res = await adminDeletePayment({ id: p.id, invoice_id: inv.id });
    setBusy(false);
    if (!res.ok) return;
    const next = list.filter((x) => x.id !== p.id);
    setList(next); onPayments(next);
    const updated = { ...inv, paid_amount: res.paid_amount ?? 0, status: (res.status as Invoice["status"]) ?? inv.status };
    setInv(updated); onInvoice(updated);
  }

  async function openDoc() {
    if (!inv.file_path) return;
    const res = await adminDocUrl({ bucket: "invoices", path: inv.file_path });
    if (res.ok && res.url) window.open(res.url, "_blank");
    else setMsg(res.error || "No se pudo abrir el documento.");
  }

  async function remove() {
    if (!confirm("Se eliminará la factura, sus pagos y el documento adjunto. ¿Continuar?")) return;
    setBusy(true);
    const res = await adminDeleteInvoice({ id: inv.id });
    setBusy(false);
    if (res.ok) onDeleted(); else setMsg(res.error || "Error");
  }

  const out = invoiceOutstanding(inv);

  if (editing) {
    return <InvoiceForm clients={clients} contracts={[]} invoice={inv}
      onSaved={(r) => { setInv(r); onInvoice(r); setEditing(false); }} onCancel={() => setEditing(false)} />;
  }

  return (
    <div>
      <div className="adm-calc">
        <div><span>Base</span><b>{euro(Number(inv.base))}</b></div>
        <div><span>IVA</span><b>{euro(Number(inv.vat))}</b></div>
        <div><span>Total</span><b>{euro(Number(inv.total))}</b></div>
        <div><span>{inv.direction === "sale" ? "Cobrado" : "Pagado"}</span><b>{euro(Number(inv.paid_amount))}</b></div>
        <div><span>Pendiente</span><b>{euro(out)}</b></div>
      </div>

      <div className="adm-shiprow" style={{ marginTop: 12 }}>
        {inv.file_path && <button className="adm-link" onClick={openDoc}>Ver documento</button>}
        <button className="adm-link" onClick={() => setEditing(true)}>Editar factura</button>
        <button className="adm-link danger" disabled={busy} onClick={remove}>Eliminar</button>
      </div>

      <div className="adm-dt" style={{ marginTop: 14 }}>{inv.direction === "sale" ? "Cobros" : "Pagos"} registrados</div>
      {list.length === 0 ? <p className="adm-hint">Aún no hay movimientos.</p> : (
        <table className="adm-table" style={{ background: "#fff", borderRadius: 6 }}>
          <thead><tr><th>Fecha</th><th className="r">Importe</th><th>Método</th><th>Referencia</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{fdateES(p.paid_on)}</td>
                <td className="r"><b>{euro(Number(p.amount))}</b></td>
                <td>{p.method || "—"}</td>
                <td className="mono">{p.reference || "—"}</td>
                <td className="c"><button className="adm-link danger" disabled={busy} onClick={() => delPay(p)}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {out > 0 && (
        <div className="adm-shiprow" style={{ marginTop: 10 }}>
          <label>Importe (€)<input className="adm-input" style={{ minWidth: 120 }} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label>Fecha<input type="date" className="adm-input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></label>
          <label>Método
            <select className="adm-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="transferencia">Transferencia</option><option value="domiciliacion">Domiciliación</option>
              <option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="otro">Otro</option>
            </select>
          </label>
          <label>Referencia<input className="adm-input" value={ref} onChange={(e) => setRef(e.target.value)} /></label>
          <button className="adm-save" disabled={busy} onClick={addPay}>{busy ? "…" : inv.direction === "sale" ? "Registrar cobro" : "Registrar pago"}</button>
        </div>
      )}
      {msg && <div className="adm-err">{msg}</div>}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" | "mute" }) {
  return <div className={`adm-kpi ${tone || ""}`}><span>{label}</span><b>{value}</b></div>;
}
