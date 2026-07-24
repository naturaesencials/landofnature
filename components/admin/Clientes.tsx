"use client";
import { useMemo, useState, Fragment } from "react";
import { euro } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  type Tariff, type Contract, type ContractTarget, type Commission,
  contractEnd, contractRenewalEnd, daysLeft, fdateES, today,
  minPurchaseStatus, applicableDiscount, targetProgress, PERIOD_LABEL,
  commissionAmount, commissionDueDate, commissionPeriodLabel, currentPeriodNo, round2,
} from "@/lib/contracts";
import type { Client, ClientOrder } from "./types";
import { COUNTS_AS_PURCHASE, clientLabel, num } from "./types";
import {
  adminSetClientTariff, adminSetAgreement, adminSetTransfer,
  adminSaveContract, adminDeleteContract, adminSaveTarget, adminDeleteTarget,
  adminSaveCommission, adminDeleteCommission, adminDocUrl,
} from "@/app/admin/actions";

const CONTRACT_TYPES: Record<string, string> = {
  delegacion: "Delegación comercial", distribucion: "Distribución",
  subdistribucion: "Subdistribución", cliente: "Cliente directo",
};

/** Valores por defecto alineados con el contrato de delegación estándar. */
function blankContract(client_id: string): Omit<Contract, "id"> & { id?: string } {
  return {
    client_id, title: "Contrato de delegación · distribución en exclusiva",
    contract_type: "delegacion", territory: "", channel: "HORECA", exclusive: true,
    start_date: today(), duration_months: 24, renewal_months: 60, notice_days: 15,
    tariff_code: null, resale_floor_tariff_code: null,
    discount_pct: 0, discount_threshold: null, discount_pct_above: null,
    min_purchase_amount: 0, min_purchase_period: "month", grace_months: 3, compensation_period: "semester",
    payment_terms_days: 60, payment_note: "Cargo en cuenta",
    direct_sales_commission_pct: 0, commission_settlement: "quarterly", commission_excludes_shipping: true,
    noncompete_years: 5, hub_min_pct: null, hub_max_pct: null,
    min_stock_note: "", notes: "", status: "active", document_path: null,
  };
}

export default function Clientes({ clients, tariffs, contracts, targets, commissions, clientOrders }: {
  clients: Client[]; tariffs: Tariff[]; contracts: Contract[];
  targets: ContractTarget[]; commissions: Commission[]; clientOrders: ClientOrder[];
}) {
  const [rows, setRows] = useState(() => clients.map((c) => ({ ...c, _busy: false })));
  const [open, setOpen] = useState<string | null>(null);
  const [allContracts, setAllContracts] = useState<Contract[]>(contracts);

  async function toggleAgreement(id: string, value: boolean) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _busy: true } : r)));
    const res = await adminSetAgreement({ id, value });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, commercial_agreement: res.ok ? value : r.commercial_agreement, _busy: false } : r)));
  }
  async function toggleTransfer(id: string, value: boolean) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _busy: true } : r)));
    const res = await adminSetTransfer({ id, value });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, allow_transfer: res.ok ? value : r.allow_transfer, _busy: false } : r)));
  }
  async function setTariff(id: string, code: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _busy: true } : r)));
    const res = await adminSetClientTariff({ id, tariff_code: code || null });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, tariff_code: res.ok ? (code || null) : r.tariff_code, _busy: false } : r)));
  }

  const mandate = (s: string | null) =>
    s === "active" ? <span className="adm-chip ok">Activa</span> : s ? <span className="adm-chip pend">{s}</span> : <span className="adm-chip no">Sin mandato</span>;

  if (rows.length === 0) return <p className="adm-empty">No hay clientes registrados.</p>;

  return (
    <div>
      <p className="adm-hint" style={{ marginBottom: 12 }}>
        Asigna la <b>tarifa</b> con la que cada cliente ve los precios y autoriza sus pagos aplazados.
        Abre <b>Contrato</b> para fijar territorio, mínimos, objetivos, descuentos y comisiones.
      </p>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr>
            <th>Cliente</th><th>CIF</th><th>Tarifa</th>
            <th className="c">Transferencia</th><th className="c">Domiciliación</th>
            <th className="c">Mandato SEPA</th><th className="c">Contrato</th>
          </tr></thead>
          <tbody>
            {rows.map((c) => {
              const ct = allContracts.find((x) => x.client_id === c.id);
              return (
                <Fragment key={c.id}>
                  <tr>
                    <td><b>{clientLabel(c)}</b><span className="sub">{c.full_name}{c.phone ? " · " + c.phone : ""}</span></td>
                    <td className="mono">{c.cif || "—"}</td>
                    <td>
                      <select className="adm-select" value={c.tariff_code || ""} disabled={c._busy} onChange={(e) => setTariff(c.id, e.target.value)}>
                        <option value="">Sin tarifa</option>
                        {tariffs.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
                      </select>
                    </td>
                    <td className="c"><label className="adm-switch"><input type="checkbox" checked={c.allow_transfer} disabled={c._busy} onChange={(e) => toggleTransfer(c.id, e.target.checked)} /><span /></label></td>
                    <td className="c"><label className="adm-switch"><input type="checkbox" checked={c.commercial_agreement} disabled={c._busy} onChange={(e) => toggleAgreement(c.id, e.target.checked)} /><span /></label></td>
                    <td className="c">{mandate(c.gc_mandate_status)}</td>
                    <td className="c">
                      <button className="adm-link" onClick={() => setOpen(open === c.id ? null : c.id)}>
                        {open === c.id ? "Ocultar" : ct ? "Ver contrato" : "Crear contrato"}
                      </button>
                      {ct && <div className="sub">{CONTRACT_TYPES[ct.contract_type]}</div>}
                    </td>
                  </tr>
                  {open === c.id && (
                    <tr className="adm-detail"><td colSpan={7}>
                      <ContractCard
                        client={c}
                        tariffs={tariffs}
                        contract={ct}
                        targets={targets.filter((t) => ct && t.contract_id === ct.id)}
                        commissions={commissions.filter((k) => ct && k.contract_id === ct.id)}
                        orders={clientOrders.filter((o) => o.client_id === c.id)}
                        onSaved={(saved) => setAllContracts((all) => {
                          const i = all.findIndex((x) => x.id === saved.id);
                          return i >= 0 ? all.map((x) => (x.id === saved.id ? saved : x)) : [...all, saved];
                        })}
                        onDeleted={(id) => setAllContracts((all) => all.filter((x) => x.id !== id))}
                      />
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= Ficha de contrato ================= */

function ContractCard({ client, tariffs, contract, targets, commissions, orders, onSaved, onDeleted }: {
  client: Client; tariffs: Tariff[]; contract?: Contract;
  targets: ContractTarget[]; commissions: Commission[]; orders: ClientOrder[];
  onSaved: (c: Contract) => void; onDeleted: (id: string) => void;
}) {
  const [f, setF] = useState(() => (contract ? { ...contract } : blankContract(client.id)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tg, setTg] = useState<ContractTarget[]>(targets);
  const [cm, setCm] = useState<Commission[]>(commissions);
  const exists = !!f.id;

  const set = (patch: Partial<Contract>) => setF((x) => ({ ...x, ...patch }));

  /* --- Compras efectivas del cliente --- */
  const valid = useMemo(() => orders.filter((o) => COUNTS_AS_PURCHASE.includes(o.status)), [orders]);
  const salesByYear = useMemo(() => {
    const m: Record<number, number> = {};
    for (const o of valid) {
      const y = new Date(o.created_at).getFullYear();
      m[y] = round2((m[y] || 0) + Number(o.total || 0));
    }
    return m;
  }, [valid]);
  const yearNow = new Date().getFullYear();
  const accYear = salesByYear[yearNow] || 0;

  const mp = useMemo(() => minPurchaseStatus(f as Contract, sumBetween(valid, minStart(f), minEnd(f))), [f, valid]);
  const disc = applicableDiscount(f as Contract, accYear);
  const end = contractEnd(f);
  const renewal = contractRenewalEnd(f);
  const left = daysLeft(end);

  async function save() {
    setBusy(true); setMsg("");
    const payload: Record<string, unknown> = { ...f };
    ["discount_threshold", "discount_pct_above", "noncompete_years", "hub_min_pct", "hub_max_pct"].forEach((k) => {
      if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
    });
    const res = await adminSaveContract(payload as never);
    setBusy(false);
    if (!res.ok) { setMsg(res.error || "Error al guardar."); return; }
    const saved = { ...(f as Contract), id: res.id as string };
    setF(saved); onSaved(saved);
    setMsg("✓ Contrato guardado.");
  }

  async function remove() {
    if (!f.id) return;
    if (!confirm("Se eliminará el contrato y sus objetivos y comisiones. Esta acción no se puede deshacer. ¿Continuar?")) return;
    setBusy(true);
    const res = await adminDeleteContract({ id: f.id });
    setBusy(false);
    if (!res.ok) { setMsg(res.error || "Error"); return; }
    onDeleted(f.id);
    setF(blankContract(client.id)); setTg([]); setCm([]);
    setMsg("Contrato eliminado.");
  }

  async function uploadDoc(file: File) {
    setBusy(true); setMsg("");
    const sb = createClient();
    const path = `${client.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await sb.storage.from("contracts").upload(path, file, { upsert: false });
    setBusy(false);
    if (error) { setMsg(`No se pudo subir el documento: ${error.message}`); return; }
    set({ document_path: path });
    setMsg("✓ Documento adjuntado. Recuerda guardar el contrato.");
  }

  async function openDoc() {
    if (!f.document_path) return;
    const res = await adminDocUrl({ bucket: "contracts", path: f.document_path });
    if (res.ok && res.url) window.open(res.url, "_blank");
    else setMsg(res.error || "No se pudo abrir el documento.");
  }

  return (
    <div className="adm-contract">
      <div className="adm-cthead">
        <div>
          <div className="adm-dt">Condiciones del contrato</div>
          <b>{clientLabel(client)}</b>
        </div>
        <div className="adm-ctactions">
          <select className="adm-select" value={f.status} onChange={(e) => set({ status: e.target.value as Contract["status"] })}>
            <option value="draft">Borrador</option><option value="active">Vigente</option>
            <option value="expired">Vencido</option><option value="terminated">Resuelto</option>
          </select>
          <button className="adm-save" disabled={busy} onClick={save}>{busy ? "Guardando…" : exists ? "Guardar cambios" : "Crear contrato"}</button>
          {exists && <button className="adm-link danger" disabled={busy} onClick={remove}>Eliminar</button>}
        </div>
      </div>

      {/* 1 · Alcance */}
      <Section title="1 · Objeto y territorio">
        <Field label="Título"><input className="adm-input wide" value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Tipo">
          <select className="adm-select" value={f.contract_type} onChange={(e) => set({ contract_type: e.target.value as Contract["contract_type"] })}>
            {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Territorio"><input className="adm-input" value={f.territory || ""} onChange={(e) => set({ territory: e.target.value })} placeholder="Málaga y provincia" /></Field>
        <Field label="Canal"><input className="adm-input" value={f.channel || ""} onChange={(e) => set({ channel: e.target.value })} placeholder="HORECA" /></Field>
        <Field label="Exclusividad">
          <label className="adm-switch"><input type="checkbox" checked={f.exclusive} onChange={(e) => set({ exclusive: e.target.checked })} /><span /></label>
        </Field>
      </Section>

      {/* 2 · Vigencia */}
      <Section title="2 · Vigencia y preaviso">
        <Field label="Inicio"><input type="date" className="adm-input" value={f.start_date} onChange={(e) => set({ start_date: e.target.value })} /></Field>
        <Field label="Duración (meses)"><input className="adm-input tiny" inputMode="numeric" value={f.duration_months} onChange={(e) => set({ duration_months: parseInt(e.target.value) || 0 })} /></Field>
        <Field label="Prórroga (meses)"><input className="adm-input tiny" inputMode="numeric" value={f.renewal_months} onChange={(e) => set({ renewal_months: parseInt(e.target.value) || 0 })} /></Field>
        <Field label="Preaviso (días)"><input className="adm-input tiny" inputMode="numeric" value={f.notice_days} onChange={(e) => set({ notice_days: parseInt(e.target.value) || 0 })} /></Field>
        <Calc items={[
          ["Vencimiento", fdateES(end)],
          ["Con prórroga", fdateES(renewal)],
          ["Restan", left >= 0 ? `${left} días` : `vencido hace ${-left} días`],
          ["Preavisar antes de", fdateES(new Date(new Date(end + "T00:00:00").getTime() - (f.notice_days || 0) * 86400000).toISOString().slice(0, 10))],
        ]} />
      </Section>

      {/* 3 · Tarifa y descuentos */}
      <Section title="3 · Tarifa, descuentos y forma de pago">
        <Field label="Tarifa aplicada">
          <select className="adm-select" value={f.tariff_code || ""} onChange={(e) => set({ tariff_code: e.target.value || null })}>
            <option value="">Sin tarifa</option>
            {tariffs.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
          </select>
        </Field>
        <Field label="Suelo de reventa a subdistribuidores">
          <select className="adm-select" value={f.resale_floor_tariff_code || ""} onChange={(e) => set({ resale_floor_tariff_code: e.target.value || null })}>
            <option value="">Sin límite</option>
            {tariffs.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
          </select>
        </Field>
        <Field label="Descuento base (%)"><input className="adm-input tiny" inputMode="decimal" value={f.discount_pct} onChange={(e) => set({ discount_pct: num(e.target.value) })} /></Field>
        <Field label="Umbral (€)"><input className="adm-input" inputMode="decimal" value={f.discount_threshold ?? ""} onChange={(e) => set({ discount_threshold: e.target.value === "" ? null : num(e.target.value) })} placeholder="45000" /></Field>
        <Field label="Descuento superado el umbral (%)"><input className="adm-input tiny" inputMode="decimal" value={f.discount_pct_above ?? ""} onChange={(e) => set({ discount_pct_above: e.target.value === "" ? null : num(e.target.value) })} placeholder="8" /></Field>
        <Field label="Forma de pago (días)"><input className="adm-input tiny" inputMode="numeric" value={f.payment_terms_days} onChange={(e) => set({ payment_terms_days: parseInt(e.target.value) || 0 })} /></Field>
        <Field label="Nota de pago"><input className="adm-input" value={f.payment_note || ""} onChange={(e) => set({ payment_note: e.target.value })} placeholder="Cargo en cuenta" /></Field>
        <Calc items={[
          [`Compras ${yearNow}`, euro(accYear)],
          ["Descuento aplicable ahora", `${disc.pct}%`],
          disc.next != null ? ["Para alcanzar el " + disc.next + "%", `faltan ${euro(disc.toNext)}`] : ["Umbral", "superado"],
          ["Vencimiento de factura", `emisión + ${f.payment_terms_days} días`],
        ]} />
      </Section>

      {/* 4 · Compra mínima */}
      <Section title="4 · Compra mínima">
        <Field label="Importe mínimo (€)"><input className="adm-input" inputMode="decimal" value={f.min_purchase_amount} onChange={(e) => set({ min_purchase_amount: num(e.target.value) })} placeholder="3500" /></Field>
        <Field label="Periodo">
          <select className="adm-select" value={f.min_purchase_period} onChange={(e) => set({ min_purchase_period: e.target.value as Contract["min_purchase_period"] })}>
            <option value="month">Mensual</option><option value="quarter">Trimestral</option>
            <option value="semester">Semestral</option><option value="year">Anual</option>
          </select>
        </Field>
        <Field label="Carencia (meses)"><input className="adm-input tiny" inputMode="numeric" value={f.grace_months} onChange={(e) => set({ grace_months: parseInt(e.target.value) || 0 })} /></Field>
        <Field label="Compensable en">
          <select className="adm-select" value={f.compensation_period} onChange={(e) => set({ compensation_period: e.target.value as Contract["compensation_period"] })}>
            <option value="quarter">Trimestre</option><option value="semester">Semestre</option><option value="year">Año</option>
          </select>
        </Field>
        <Calc items={[
          [`Periodo ${PERIOD_LABEL[f.min_purchase_period]} en curso`, `${fdateES(mp.from)} – ${fdateES(mp.to)}`],
          ["Comprado", euro(mp.purchased)],
          ["Mínimo exigible", mp.grace ? "en carencia" : euro(mp.required)],
          ["Déficit", mp.deficit > 0 ? euro(mp.deficit) : "cumplido"],
        ]} warn={mp.deficit > 0} />
      </Section>

      {/* 5 · Objetivos anuales */}
      <Section title="5 · Plan de ventas por año">
        {exists ? (
          <Targets contractId={f.id!} rows={tg} setRows={setTg} salesByYear={salesByYear} />
        ) : <p className="adm-hint">Guarda el contrato para añadir los objetivos anuales.</p>}
      </Section>

      {/* 6 · Comisiones */}
      <Section title="6 · Comisión por ventas directas del proveedor">
        <Field label="Comisión (%)"><input className="adm-input tiny" inputMode="decimal" value={f.direct_sales_commission_pct} onChange={(e) => set({ direct_sales_commission_pct: num(e.target.value) })} placeholder="0,75" /></Field>
        <Field label="Liquidación">
          <select className="adm-select" value={f.commission_settlement} onChange={(e) => set({ commission_settlement: e.target.value as Contract["commission_settlement"] })}>
            <option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option>
          </select>
        </Field>
        <Field label="Excluye portes">
          <label className="adm-switch"><input type="checkbox" checked={f.commission_excludes_shipping} onChange={(e) => set({ commission_excludes_shipping: e.target.checked })} /><span /></label>
        </Field>
        {exists ? (
          <Commissions contractId={f.id!} pct={Number(f.direct_sales_commission_pct) || 0} settlement={f.commission_settlement} rows={cm} setRows={setCm} />
        ) : <p className="adm-hint">Guarda el contrato para registrar liquidaciones.</p>}
      </Section>

      {/* 7 · Otras condiciones */}
      <Section title="7 · Otras condiciones">
        <Field label="No competencia (años)"><input className="adm-input tiny" inputMode="numeric" value={f.noncompete_years ?? ""} onChange={(e) => set({ noncompete_years: e.target.value === "" ? null : parseInt(e.target.value) || 0 })} /></Field>
        <Field label="HUB · participación mín. (%)"><input className="adm-input tiny" inputMode="decimal" value={f.hub_min_pct ?? ""} onChange={(e) => set({ hub_min_pct: e.target.value === "" ? null : num(e.target.value) })} placeholder="10" /></Field>
        <Field label="HUB · participación máx. (%)"><input className="adm-input tiny" inputMode="decimal" value={f.hub_max_pct ?? ""} onChange={(e) => set({ hub_max_pct: e.target.value === "" ? null : num(e.target.value) })} placeholder="49" /></Field>
        <Field label="Existencias mínimas / depósito"><input className="adm-input wide" value={f.min_stock_note || ""} onChange={(e) => set({ min_stock_note: e.target.value })} placeholder="1 caja por referencia activa (Anexo 1)" /></Field>
        <Field label="Notas"><textarea className="adm-input wide" rows={2} value={f.notes || ""} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <Field label="Contrato firmado (PDF)">
          <div className="adm-fileline">
            <input type="file" accept="application/pdf,image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDoc(file); }} />
            {f.document_path && <button className="adm-link" onClick={openDoc}>Ver documento</button>}
          </div>
        </Field>
      </Section>

      {msg && <div className={`adm-shipmsg ${msg.startsWith("✓") ? "ok" : "err"}`}>{msg}</div>}
    </div>
  );
}

/* ---------- Objetivos anuales ---------- */
function Targets({ contractId, rows, setRows, salesByYear }: {
  contractId: string; rows: ContractTarget[]; setRows: (r: ContractTarget[]) => void; salesByYear: Record<number, number>;
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [min, setMin] = useState(""); const [obj, setObj] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const y = parseInt(year); if (!y) return;
    setBusy(true);
    const res = await adminSaveTarget({ contract_id: contractId, year: y, minimum: num(min), objective: num(obj) });
    setBusy(false);
    if (!res.ok) return;
    const next = rows.filter((r) => r.year !== y).concat({ id: `${contractId}-${y}`, contract_id: contractId, year: y, minimum: num(min), objective: num(obj) });
    setRows(next.sort((a, b) => a.year - b.year));
    setMin(""); setObj("");
  }
  async function del(y: number) {
    await adminDeleteTarget({ contract_id: contractId, year: y });
    setRows(rows.filter((r) => r.year !== y));
  }

  return (
    <div style={{ width: "100%" }}>
      <div className="adm-tablewrap" style={{ marginBottom: 10 }}>
        <table className="adm-table">
          <thead><tr><th>Año</th><th className="r">Mínimo</th><th className="r">Objetivo</th><th className="r">Compras</th><th>Cumplimiento</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="adm-empty" style={{ padding: 14 }}>Sin objetivos definidos.</td></tr>}
            {rows.map((t) => {
              const p = targetProgress(t, salesByYear[t.year] || 0);
              return (
                <tr key={t.year}>
                  <td><b>{t.year}</b></td>
                  <td className="r mono">{euro(p.minimum)}</td>
                  <td className="r mono">{euro(p.objective)}</td>
                  <td className="r mono">{euro(p.sales)}</td>
                  <td>
                    <Bar pct={p.pctMin} label={`mínimo ${p.pctMin}%`} />
                    <Bar pct={p.pctObj} label={`objetivo ${p.pctObj}%`} alt />
                  </td>
                  <td className="c"><button className="adm-link danger" onClick={() => del(t.year)}>Quitar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="adm-shiprow">
        <label>Año<input className="adm-input tiny" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} /></label>
        <label>Mínimo (€)<input className="adm-input" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="42000" /></label>
        <label>Objetivo (€)<input className="adm-input" inputMode="decimal" value={obj} onChange={(e) => setObj(e.target.value)} placeholder="100000" /></label>
        <button className="adm-save" disabled={busy} onClick={add}>Añadir año</button>
      </div>
    </div>
  );
}

/* ---------- Liquidaciones de comisión ---------- */
function Commissions({ contractId, pct, settlement, rows, setRows }: {
  contractId: string; pct: number; settlement: string; rows: Commission[]; setRows: (r: Commission[]) => void;
}) {
  const y = new Date().getFullYear();
  const [year, setYear] = useState(String(y));
  const [per, setPer] = useState(String(currentPeriodNo(settlement)));
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const yy = parseInt(year), pp = parseInt(per);
    if (!yy || !pp) return;
    setBusy(true);
    const res = await adminSaveCommission({ contract_id: contractId, period_year: yy, period_no: pp, base_amount: num(base), pct, status: "pending" });
    setBusy(false);
    if (!res.ok) return;
    const row: Commission = {
      id: res.id || `${contractId}-${yy}-${pp}`, contract_id: contractId, period_year: yy, period_no: pp,
      base_amount: num(base), pct, amount: commissionAmount(num(base), pct), status: "pending", settled_at: null, notes: null,
    };
    setRows([row, ...rows.filter((r) => !(r.period_year === yy && r.period_no === pp))]);
    setBase("");
  }
  async function settle(r: Commission) {
    await adminSaveCommission({ contract_id: contractId, period_year: r.period_year, period_no: r.period_no, base_amount: r.base_amount, pct: r.pct, status: "settled", settled_at: today() });
    setRows(rows.map((x) => (x.id === r.id ? { ...x, status: "settled", settled_at: today() } : x)));
  }
  async function del(r: Commission) {
    await adminDeleteCommission({ id: r.id });
    setRows(rows.filter((x) => x.id !== r.id));
  }

  const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div style={{ width: "100%" }}>
      <div className="adm-tablewrap" style={{ marginBottom: 10 }}>
        <table className="adm-table">
          <thead><tr><th>Periodo</th><th className="r">Base comisionable</th><th className="r">%</th><th className="r">Comisión</th><th>Liquidar antes de</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="adm-empty" style={{ padding: 14 }}>Sin liquidaciones registradas.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{commissionPeriodLabel(settlement, r.period_year, r.period_no)}</b></td>
                <td className="r mono">{euro(Number(r.base_amount))}</td>
                <td className="r mono">{r.pct}%</td>
                <td className="r"><b>{euro(Number(r.amount))}</b></td>
                <td>{fdateES(commissionDueDate(settlement, r.period_year, r.period_no))}</td>
                <td>{r.status === "settled" ? <span className="adm-chip ok">Liquidada {r.settled_at ? fdateES(r.settled_at) : ""}</span> : <span className="adm-chip pend">Pendiente</span>}</td>
                <td className="c">
                  {r.status === "pending" && <button className="adm-link" onClick={() => settle(r)}>Marcar liquidada</button>}
                  <button className="adm-link danger" onClick={() => del(r)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending > 0 && <p className="adm-hint">Comisión pendiente de liquidar: <b>{euro(round2(pending))}</b></p>}
      <div className="adm-shiprow">
        <label>Año<input className="adm-input tiny" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} /></label>
        <label>{settlement === "monthly" ? "Mes" : settlement === "yearly" ? "Periodo" : "Trimestre"}
          <input className="adm-input tiny" inputMode="numeric" value={per} onChange={(e) => setPer(e.target.value)} />
        </label>
        <label>Base comisionable (€)<input className="adm-input" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} placeholder="sin portes" /></label>
        <div className="adm-calcinline">Comisión: <b>{euro(commissionAmount(num(base), pct))}</b> ({pct}%)</div>
        <button className="adm-save" disabled={busy} onClick={add}>Registrar</button>
      </div>
    </div>
  );
}

/* ---------- piezas de UI ---------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="adm-ctsection">
      <div className="adm-dt">{title}</div>
      <div className="adm-ctgrid">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="adm-ctfield"><span>{label}</span>{children}</label>;
}
function Calc({ items, warn }: { items: (readonly [string, string])[]; warn?: boolean }) {
  return (
    <div className={`adm-calc ${warn ? "warn" : ""}`}>
      {items.map(([k, v], i) => <div key={i}><span>{k}</span><b>{v}</b></div>)}
    </div>
  );
}
function Bar({ pct, label, alt }: { pct: number; label: string; alt?: boolean }) {
  return (
    <div className="adm-bar-wrap">
      <div className="adm-bar-track"><div className={`adm-bar-fill ${alt ? "alt" : ""}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>
      <span>{label}</span>
    </div>
  );
}

/* ---------- helpers de periodo ---------- */
function minStart(f: { min_purchase_period: string }) {
  const d = new Date();
  const step = { month: 1, quarter: 3, semester: 6, year: 12 }[f.min_purchase_period] || 1;
  const m = Math.floor(d.getMonth() / step) * step;
  return new Date(d.getFullYear(), m, 1);
}
function minEnd(f: { min_purchase_period: string }) {
  const s = minStart(f);
  const step = { month: 1, quarter: 3, semester: 6, year: 12 }[f.min_purchase_period] || 1;
  return new Date(s.getFullYear(), s.getMonth() + step, 0, 23, 59, 59);
}
function sumBetween(orders: ClientOrder[], from: Date, to: Date) {
  return round2(orders.filter((o) => {
    const d = new Date(o.created_at);
    return d >= from && d <= to;
  }).reduce((s, o) => s + Number(o.total || 0), 0));
}
