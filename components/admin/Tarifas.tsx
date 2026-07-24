"use client";
import { useMemo, useState } from "react";
import { euro, boxLabel } from "@/lib/types";
import type { Tariff } from "@/lib/contracts";
import type { Prod, TariffPrice } from "./types";
import { num } from "./types";
import { adminSaveTariff, adminSetTariffPrice, adminBulkTariffPrices } from "@/app/admin/actions";

type Cell = { value: string; busy: boolean; saved: boolean; err: string };

export default function Tarifas({ products, tariffs, tariffPrices }: {
  products: Prod[]; tariffs: Tariff[]; tariffPrices: TariffPrice[];
}) {
  const [list, setList] = useState<Tariff[]>(tariffs);
  const [q, setQ] = useState("");
  const [cells, setCells] = useState<Record<string, Cell>>(() => {
    const m: Record<string, Cell> = {};
    for (const tp of tariffPrices) m[`${tp.product_id}|${tp.tariff_code}`] = { value: String(tp.price), busy: false, saved: false, err: "" };
    return m;
  });

  const actives = useMemo(() => products.filter((p) => p.active), [products]);
  const filtered = useMemo(
    () => actives.filter((p) => `${p.brand} ${p.name} ${p.sku} ${p.family} ${p.category}`.toLowerCase().includes(q.toLowerCase())),
    [actives, q]
  );

  const key = (pid: string, code: string) => `${pid}|${code}`;
  const cell = (pid: string, code: string): Cell => cells[key(pid, code)] || { value: "", busy: false, saved: false, err: "" };
  const setCell = (pid: string, code: string, patch: Partial<Cell>) =>
    setCells((c) => ({ ...c, [key(pid, code)]: { ...cell(pid, code), ...patch } }));

  async function savePrice(pid: string, code: string) {
    const c = cell(pid, code);
    setCell(pid, code, { busy: true, err: "", saved: false });
    const raw = c.value.trim();
    const res = await adminSetTariffPrice({ product_id: pid, tariff_code: code, price: raw === "" ? null : num(raw) });
    setCell(pid, code, { busy: false, saved: res.ok, err: res.ok ? "" : res.error || "Error" });
  }

  /* --- Cobertura por tarifa --- */
  const coverage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of list) m[t.code] = 0;
    for (const p of actives) for (const t of list) if ((cells[key(p.id, t.code)]?.value ?? "") !== "") m[t.code]++;
    return m;
  }, [list, actives, cells]);

  return (
    <div>
      <TariffCatalog list={list} setList={setList} />

      <BulkApply
        tariffs={list}
        onApplied={(code, pct, onlyMissing) => {
          setCells((prev) => {
            const next = { ...prev };
            for (const p of actives) {
              if (Number(p.public_price) <= 0) continue;
              const k = key(p.id, code);
              if (onlyMissing && (next[k]?.value ?? "") !== "") continue;
              const v = Math.round(Number(p.public_price) * (1 - pct / 100) * 100) / 100;
              next[k] = { value: String(v), busy: false, saved: true, err: "" };
            }
            return next;
          });
        }}
      />

      <div className="adm-bar" style={{ marginTop: 20 }}>
        <input className="adm-search" placeholder="Buscar producto por nombre, marca o SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="adm-hint">Precio por caja, sin IVA. Vacío = el cliente de esa tarifa no ve precio.</span>
      </div>

      <div className="adm-tablewrap">
        <table className="adm-table adm-matrix">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="r">PVP</th>
              {list.map((t) => (
                <th key={t.code} className="r">
                  {t.code}<span className="thsub">{coverage[t.code] ?? 0}/{actives.length}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={Number(p.public_price) <= 0 ? "warn" : ""}>
                <td><b>{p.brand} {p.name}</b><span className="sub">{boxLabel(p)} · {p.sku}</span></td>
                <td className="r mono">{Number(p.public_price) > 0 ? euro(Number(p.public_price)) : "—"}</td>
                {list.map((t) => {
                  const c = cell(p.id, t.code);
                  const v = num(c.value);
                  const off = Number(p.public_price) > 0 && v > 0 ? Math.round((1 - v / Number(p.public_price)) * 1000) / 10 : null;
                  return (
                    <td key={t.code} className="r">
                      <input
                        className={`adm-num sm ${c.saved ? "ok" : ""} ${c.err ? "bad" : ""}`}
                        inputMode="decimal" placeholder="—" value={c.value}
                        onChange={(e) => setCell(p.id, t.code, { value: e.target.value, saved: false, err: "" })}
                        onBlur={() => savePrice(p.id, t.code)}
                        disabled={c.busy}
                      />
                      {off != null && <span className="offpct">−{off}%</span>}
                      {c.err && <div className="adm-err">{c.err}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="adm-hint" style={{ marginTop: 10 }}>Los cambios se guardan al salir de la casilla.</p>
    </div>
  );
}

/* ---------- Catálogo de tarifas ---------- */
function TariffCatalog({ list, setList }: { list: Tariff[]; setList: (t: Tariff[]) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function add() {
    setMsg(""); setBusy(true);
    const res = await adminSaveTariff({ code, name, sort: list.length + 1 });
    setBusy(false);
    if (!res.ok) { setMsg(res.error || "Error"); return; }
    const c = code.trim().toUpperCase();
    if (!list.some((t) => t.code === c)) setList([...list, { code: c, name: name.trim() || `Tarifa ${c}`, sort: list.length + 1 }]);
    setCode(""); setName("");
  }

  async function rename(t: Tariff, newName: string) {
    setList(list.map((x) => (x.code === t.code ? { ...x, name: newName } : x)));
    await adminSaveTariff({ code: t.code, name: newName, sort: t.sort });
  }

  return (
    <div className="adm-box">
      <div className="adm-dt">Tarifas del catálogo</div>
      <div className="adm-chips">
        {list.map((t) => (
          <div key={t.code} className="adm-tchip">
            <b>{t.code}</b>
            <input className="adm-input tiny" defaultValue={t.name} onBlur={(e) => rename(t, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="adm-shiprow" style={{ marginTop: 10 }}>
        <label>Nueva tarifa (código)
          <input className="adm-input" style={{ minWidth: 120 }} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="T2B" maxLength={12} />
        </label>
        <label>Nombre
          <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tarifa delegación" />
        </label>
        <button className="adm-save" disabled={busy || !code.trim()} onClick={add}>{busy ? "…" : "Añadir tarifa"}</button>
      </div>
      {msg && <div className="adm-err">{msg}</div>}
    </div>
  );
}

/* ---------- Aplicación masiva por porcentaje ---------- */
function BulkApply({ tariffs, onApplied }: { tariffs: Tariff[]; onApplied: (code: string, pct: number, onlyMissing: boolean) => void }) {
  const [code, setCode] = useState(tariffs[0]?.code || "");
  const [pct, setPct] = useState("35");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    const p = num(pct);
    if (!code) { setMsg("Selecciona una tarifa."); return; }
    if (!confirm(`Se recalculará la tarifa ${code} al ${p}% de descuento sobre el PVP${onlyMissing ? " (solo productos sin precio)" : " (todos los productos activos)"}. ¿Continuar?`)) return;
    setBusy(true); setMsg("");
    const res = await adminBulkTariffPrices({ tariff_code: code, discount_pct: p, only_missing: onlyMissing });
    setBusy(false);
    if (!res.ok) { setMsg(res.error || "Error"); return; }
    onApplied(code, p, onlyMissing);
    setMsg(`✓ ${res.updated ?? 0} precios actualizados en la tarifa ${code}.`);
  }

  return (
    <div className="adm-box">
      <div className="adm-dt">Calcular una tarifa completa</div>
      <div className="adm-shiprow">
        <label>Tarifa
          <select className="adm-select" value={code} onChange={(e) => setCode(e.target.value)}>
            {tariffs.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
          </select>
        </label>
        <label>Descuento sobre PVP (%)
          <input className="adm-input" style={{ minWidth: 110 }} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
        </label>
        <label className="adm-check">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Solo productos sin precio en esta tarifa
        </label>
        <button className="adm-save" disabled={busy} onClick={run}>{busy ? "Calculando…" : "Aplicar"}</button>
      </div>
      {msg && <div className={msg.startsWith("✓") ? "adm-shipmsg ok" : "adm-err"}>{msg}</div>}
    </div>
  );
}
