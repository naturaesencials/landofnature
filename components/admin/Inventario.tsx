"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { boxLabel } from "@/lib/types";
import type { Prod, Warehouse, InventoryLevel } from "./types";
import { fdate } from "./types";
import {
  adminInventoryLookup, adminSetBarcode, adminInventoryCount, adminInventoryTransfer,
  adminAddWarehouse, adminInventoryHistory, type InvLookup, type InvHistoryRow,
} from "@/app/admin/actions";

type SubTab = "escaneo" | "existencias" | "transferir" | "historial" | "almacenes";

export default function Inventario({ products, warehouses, levels }: {
  products: Prod[]; warehouses: Warehouse[]; levels: InventoryLevel[];
}) {
  const [sub, setSub] = useState<SubTab>("escaneo");
  const [whs, setWhs] = useState<Warehouse[]>(warehouses);

  const levelsByProduct = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const l of levels) { (m[l.product_id] ??= {})[l.warehouse_id] = l.on_hand; }
    return m;
  }, [levels]);

  return (
    <div>
      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={sub === "escaneo" ? "on" : ""} onClick={() => setSub("escaneo")}>Escanear</button>
        <button className={sub === "existencias" ? "on" : ""} onClick={() => setSub("existencias")}>Existencias</button>
        <button className={sub === "transferir" ? "on" : ""} onClick={() => setSub("transferir")}>Transferir</button>
        <button className={sub === "historial" ? "on" : ""} onClick={() => setSub("historial")}>Historial</button>
        <button className={sub === "almacenes" ? "on" : ""} onClick={() => setSub("almacenes")}>Almacenes <span>{whs.length}</span></button>
      </div>
      {sub === "escaneo" && <Escaneo warehouses={whs} />}
      {sub === "existencias" && <Existencias products={products} warehouses={whs} levelsByProduct={levelsByProduct} />}
      {sub === "transferir" && <Transferir products={products} warehouses={whs} levelsByProduct={levelsByProduct} />}
      {sub === "historial" && <Historial />}
      {sub === "almacenes" && <Almacenes warehouses={whs} setWhs={setWhs} />}
    </div>
  );
}

/* ---------------- Escaneo ---------------- */
function Escaneo({ warehouses }: { warehouses: Warehouse[] }) {
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<InvLookup | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [wh, setWh] = useState(warehouses[0]?.id || "");
  const [qty, setQty] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [product]);
  useEffect(() => { if (!wh && warehouses[0]) setWh(warehouses[0].id); }, [warehouses, wh]);

  async function lookup(raw: string) {
    const c = raw.trim();
    if (!c) return;
    setBusy(true); setErr(""); setSaveMsg("");
    const res = await adminInventoryLookup({ code: c });
    setBusy(false);
    if (!res.ok || !res.product) { setErr(res.error || "No encontrado"); setProduct(null); return; }
    setProduct(res.product);
    setBarcodeInput(res.product.barcode || "");
    setQty(String(res.product.levels.find((l) => l.warehouse_id === wh)?.on_hand ?? 0));
    setCode("");
  }

  async function saveCount() {
    if (!product) return;
    setBusy(true); setSaveMsg("");
    const res = await adminInventoryCount({ product_id: product.id, warehouse_id: wh, counted_qty: parseInt(qty) || 0 });
    setBusy(false);
    if (res.ok) {
      setSaveMsg("Guardado ✓");
      setProduct({ ...product, levels: product.levels.some((l) => l.warehouse_id === wh)
        ? product.levels.map((l) => (l.warehouse_id === wh ? { ...l, on_hand: parseInt(qty) || 0 } : l))
        : [...product.levels, { warehouse_id: wh, on_hand: parseInt(qty) || 0 }] });
    } else setSaveMsg(res.error || "Error");
  }

  async function saveBarcode() {
    if (!product) return;
    setBusy(true);
    const res = await adminSetBarcode({ product_id: product.id, barcode: barcodeInput });
    setBusy(false);
    if (res.ok) { setProduct({ ...product, barcode: barcodeInput.trim() || null }); setSaveMsg("Código de barras guardado ✓"); }
    else setSaveMsg(res.error || "Error");
  }

  return (
    <div>
      <p className="adm-hint">Escanea con el lector Bluetooth (funciona como teclado) o teclea el código/SKU y pulsa Enter.</p>
      <form onSubmit={(e) => { e.preventDefault(); lookup(code); }} className="adm-bar">
        <input ref={inputRef} className="adm-search" placeholder="Código de barras o SKU…" value={code}
          onChange={(e) => setCode(e.target.value)} autoFocus />
        <select className="adm-select" value={wh} onChange={(e) => { setWh(e.target.value); if (product) setQty(String(product.levels.find((l) => l.warehouse_id === e.target.value)?.on_hand ?? 0)); }}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </form>
      {busy && !product && <p className="adm-hint">Buscando…</p>}
      {err && <p className="adm-err">{err}</p>}

      {product && (
        <div className="adm-box" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>{product.brand} {product.name}</h3>
          <p className="sub">{boxLabel(product)} · SKU {product.sku}</p>

          {!product.barcode && (
            <div className="adm-bar" style={{ marginBottom: 12 }}>
              <input className="adm-input" placeholder="Asignar código de barras…" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} />
              <button className="adm-save" disabled={busy} onClick={saveBarcode}>Guardar código</button>
            </div>
          )}

          <table className="adm-table" style={{ marginBottom: 12 }}>
            <thead><tr><th>Almacén</th><th className="r">Stock actual</th></tr></thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id}><td>{w.name}</td><td className="r">{product.levels.find((l) => l.warehouse_id === w.id)?.on_hand ?? 0}</td></tr>
              ))}
            </tbody>
          </table>

          <div className="adm-bar">
            <label>Recuento en <b>{warehouses.find((w) => w.id === wh)?.name}</b>:</label>
            <input className="adm-num sm" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            <button className="adm-save" disabled={busy} onClick={saveCount}>{busy ? "…" : "Guardar recuento"}</button>
          </div>
          {saveMsg && <p className="adm-hint">{saveMsg}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------- Existencias ---------------- */
function Existencias({ products, warehouses, levelsByProduct }: {
  products: Prod[]; warehouses: Warehouse[]; levelsByProduct: Record<string, Record<string, number>>;
}) {
  const [q, setQ] = useState("");
  const [levels, setLevels] = useState(levelsByProduct);
  const [edit, setEdit] = useState<{ pid: string; wid: string } | null>(null);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = products.filter((p) => `${p.brand} ${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  async function save(pid: string, wid: string) {
    setBusy(true);
    const res = await adminInventoryCount({ product_id: pid, warehouse_id: wid, counted_qty: parseInt(val) || 0 });
    setBusy(false);
    if (res.ok) {
      setLevels((l) => ({ ...l, [pid]: { ...(l[pid] || {}), [wid]: parseInt(val) || 0 } }));
      setEdit(null);
    }
  }

  return (
    <div>
      <div className="adm-bar">
        <input className="adm-search" placeholder="Buscar por nombre, marca, SKU o código de barras…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Producto</th><th>SKU</th>
              {warehouses.map((w) => <th key={w.id} className="r">{w.name}</th>)}
              <th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const row = levels[p.id] || {};
              const total = Object.values(row).reduce((a, b) => a + b, 0);
              return (
                <tr key={p.id}>
                  <td><b>{p.brand} {p.name}</b><span className="sub">{boxLabel(p)}</span></td>
                  <td className="mono">{p.sku}</td>
                  {warehouses.map((w) => {
                    const isEdit = edit?.pid === p.id && edit?.wid === w.id;
                    return (
                      <td key={w.id} className="r">
                        {isEdit ? (
                          <span style={{ display: "inline-flex", gap: 4 }}>
                            <input className="adm-num sm" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
                            <button className="adm-save" disabled={busy} onClick={() => save(p.id, w.id)}>✓</button>
                          </span>
                        ) : (
                          <button className="adm-link" onClick={() => { setEdit({ pid: p.id, wid: w.id }); setVal(String(row[w.id] ?? 0)); }}>
                            {row[w.id] ?? 0}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="r"><b>{total}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Transferir ---------------- */
function Transferir({ products, warehouses, levelsByProduct }: {
  products: Prod[]; warehouses: Warehouse[]; levelsByProduct: Record<string, Record<string, number>>;
}) {
  const [q, setQ] = useState("");
  const [pid, setPid] = useState("");
  const [from, setFrom] = useState(warehouses[0]?.id || "");
  const [to, setTo] = useState(warehouses[1]?.id || "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const matches = q.length >= 2 ? products.filter((p) => `${p.brand} ${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const selected = products.find((p) => p.id === pid);
  const stockFrom = selected ? (levelsByProduct[selected.id]?.[from] ?? 0) : 0;

  async function doTransfer() {
    if (!selected) { setMsg("Elige un producto."); return; }
    if (from === to) { setMsg("El origen y el destino no pueden coincidir."); return; }
    const n = parseInt(qty) || 0;
    if (n <= 0) { setMsg("Indica una cantidad mayor que cero."); return; }
    setBusy(true); setMsg("");
    const res = await adminInventoryTransfer({ product_id: selected.id, from, to, qty: n, note: note || undefined });
    setBusy(false);
    setMsg(res.ok ? "Transferencia realizada ✓" : res.error || "Error");
    if (res.ok) { setQty(""); setNote(""); }
  }

  if (warehouses.length < 2) return <p className="adm-empty">Necesitas al menos dos almacenes para transferir stock. Crea uno en la pestaña «Almacenes».</p>;

  return (
    <div className="adm-box">
      <div className="adm-bar" style={{ position: "relative" }}>
        <input className="adm-search" placeholder="Buscar producto…" value={selected ? `${selected.brand} ${selected.name}` : q}
          onChange={(e) => { setQ(e.target.value); setPid(""); }} />
      </div>
      {!pid && matches.length > 0 && (
        <div className="adm-box" style={{ marginTop: 4 }}>
          {matches.map((p) => (
            <div key={p.id} className="adm-shiprow" style={{ cursor: "pointer" }} onClick={() => { setPid(p.id); setQ(""); }}>
              {p.brand} {p.name} <span className="mono sub">{p.sku}</span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 16 }}>
          <p className="sub">Stock en origen: <b>{stockFrom}</b></p>
          <div className="adm-cols">
            <label>Origen
              <select className="adm-select" value={from} onChange={(e) => setFrom(e.target.value)}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label>Destino
              <select className="adm-select" value={to} onChange={(e) => setTo(e.target.value)}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label>Cantidad
              <input className="adm-num" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
          </div>
          <input className="adm-input" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 8, width: "100%" }} />
          <button className="adm-save" disabled={busy} onClick={doTransfer} style={{ marginTop: 12 }}>{busy ? "…" : "Transferir"}</button>
          {msg && <p className="adm-hint">{msg}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------- Historial ---------------- */
function Historial() {
  const [rows, setRows] = useState<InvHistoryRow[] | null>(null);
  const [type, setType] = useState<"" | "count" | "transfer">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const res = await adminInventoryHistory({ type: type || undefined, from: from || undefined, to: to ? `${to}T23:59:59` : undefined });
    setBusy(false);
    if (res.ok) setRows(res.rows || []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="adm-bar">
        <select className="adm-select" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="">Todos los tipos</option>
          <option value="count">Recuentos</option>
          <option value="transfer">Transferencias</option>
        </select>
        <input className="adm-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="adm-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="adm-save" onClick={load} disabled={busy}>{busy ? "…" : "Filtrar"}</button>
      </div>
      {rows === null ? <p className="adm-hint">Cargando…</p> : rows.length === 0 ? <p className="adm-empty">Sin movimientos en este rango.</p> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Detalle</th><th>Nota</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{new Date(r.created_at).toLocaleString("es-ES")}</td>
                  <td>{r.type === "count" ? "Recuento" : "Transferencia"}</td>
                  <td>{r.product_title} <span className="sub mono">{r.sku}</span></td>
                  <td>
                    {r.type === "count"
                      ? <>{r.warehouse_id}: {r.previous_qty} → <b>{r.counted_qty}</b></>
                      : <>{r.from_warehouse_id} → {r.to_warehouse_id}: <b>{r.transfer_qty}</b> uds</>}
                  </td>
                  <td className="sub">{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Almacenes ---------------- */
function Almacenes({ warehouses, setWhs }: { warehouses: Warehouse[]; setWhs: (w: Warehouse[]) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function add() {
    setErr(""); setBusy(true);
    const res = await adminAddWarehouse({ id, name });
    setBusy(false);
    if (res.ok) {
      setWhs([...warehouses, { id: id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-"), name: name.trim(), sort: warehouses.length }]);
      setId(""); setName("");
    } else setErr(res.error || "Error");
  }

  return (
    <div>
      <table className="adm-table" style={{ marginBottom: 16 }}>
        <thead><tr><th>Identificador</th><th>Nombre</th></tr></thead>
        <tbody>{warehouses.map((w) => <tr key={w.id}><td className="mono">{w.id}</td><td>{w.name}</td></tr>)}</tbody>
      </table>
      <div className="adm-box">
        <h3 style={{ marginTop: 0 }}>Nuevo almacén</h3>
        <div className="adm-cols">
          <label>Identificador (sin espacios)<input className="adm-input" value={id} onChange={(e) => setId(e.target.value)} placeholder="ej. tienda-marbella" /></label>
          <label>Nombre<input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Tienda Marbella" /></label>
        </div>
        <button className="adm-save" disabled={busy} onClick={add} style={{ marginTop: 8 }}>{busy ? "…" : "Crear almacén"}</button>
        {err && <p className="adm-err">{err}</p>}
      </div>
    </div>
  );
}
