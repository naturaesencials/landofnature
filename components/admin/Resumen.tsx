"use client";
import { useEffect, useMemo, useState } from "react";
import { euro } from "@/lib/types";
import type { Order } from "./types";
import { ORDER_STATES, fdate } from "./types";
import { adminRealDashboardStats, adminRevenueByYear, type RealDashboardStats, type YearlyRevenue } from "@/app/admin/actions";

export default function Resumen({ orders, onGo }: {
  orders: Order[];
  onGo: (tab: "facturas" | "pedidos" | "clientes") => void;
}) {
  const [real, setReal] = useState<RealDashboardStats | null>(null);
  const [porAnio, setPorAnio] = useState<YearlyRevenue[] | null>(null);
  useEffect(() => {
    adminRealDashboardStats().then((res) => { if (res.ok) setReal(res.stats ?? null); });
    adminRevenueByYear().then((res) => { if (res.ok) setPorAnio(res.rows ?? []); });
  }, []);

  const pedidosAbiertos = useMemo(
    () => orders.filter((o) => ["pending_payment", "paid", "confirmed", "preparing"].includes(o.status)),
    [orders]
  );

  return (
    <div>
      <div className="adm-dt" style={{ marginBottom: 8 }}>Negocio real (facturación nueva + histórico Odoo)</div>
      {!real ? <p className="adm-hint">Cargando…</p> : (
        <div className="adm-kpis" style={{ marginBottom: 24 }}>
          <Kpi label={`Facturado ${real.year}`} value={euro(real.ventasAnio)} sub={`${real.facturasAnioCount} facturas`} tone="ok" onClick={() => onGo("facturas")} />
          <Kpi label="Pendiente de cobro" value={euro(real.pendienteCobro)} sub={`${real.pendienteCobroCount} facturas`} tone={real.pendienteCobro > 0 ? "warn" : "ok"} onClick={() => onGo("facturas")} />
          <Kpi label="Revertidas (a revisar)" value={String(real.revertidasCount)} sub="ver en Histórico de Facturas" tone={real.revertidasCount > 0 ? "bad" : "mute"} onClick={() => onGo("facturas")} />
          <Kpi label="Pedidos activos" value={euro(real.pedidosActivosTotal)} sub={`${real.pedidosActivosCount} en curso`} tone="ok" onClick={() => onGo("pedidos")} />
        </div>
      )}

      <div className="adm-dt">Facturado por año</div>
      {!porAnio ? <p className="adm-hint">Cargando…</p> : (
        <div className="adm-tablewrap" style={{ marginBottom: 24 }}>
          <table className="adm-table">
            <thead><tr><th>Año</th><th className="r">Nº facturas</th><th className="r">Total facturado</th></tr></thead>
            <tbody>
              {porAnio.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td className="r">{r.count}</td>
                  <td className="r"><b>{euro(r.total)}</b></td>
                </tr>
              ))}
              {porAnio.length > 0 && (
                <tr style={{ borderTop: "2px solid var(--line)" }}>
                  <td><b>Total</b></td>
                  <td className="r"><b>{porAnio.reduce((s, r) => s + r.count, 0)}</b></td>
                  <td className="r"><b>{euro(porAnio.reduce((s, r) => s + r.total, 0))}</b></td>
                </tr>
              )}
            </tbody>
          </table>
          {!porAnio.length && <p className="adm-empty">Sin facturas registradas.</p>}
        </div>
      )}

      <div className="adm-dt">Pedidos en curso</div>
      {pedidosAbiertos.length === 0 ? <p className="adm-hint">No hay pedidos abiertos.</p> : (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th className="r">Total</th><th>Estado</th></tr></thead>
            <tbody>
              {pedidosAbiertos.slice(0, 12).map((o) => (
                <tr key={o.id}>
                  <td className="mono">#{o.order_no}</td>
                  <td>{fdate(o.created_at)}</td>
                  <td><b>{o.name || "—"}</b></td>
                  <td className="r"><b>{euro(Number(o.total))}</b></td>
                  <td><span className="adm-chip pend">{ORDER_STATES[o.status] || o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone, onClick }: {
  label: string; value: string; sub?: string; tone?: "ok" | "bad" | "warn" | "mute"; onClick?: () => void;
}) {
  return (
    <button className={`adm-kpi ${tone || ""}`} onClick={onClick} type="button">
      <span>{label}</span><b>{value}</b>{sub && <i>{sub}</i>}
    </button>
  );
}
