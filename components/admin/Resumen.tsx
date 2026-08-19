"use client";
import { useEffect, useMemo, useState } from "react";
import { euro } from "@/lib/types";
import type { Order } from "./types";
import { ORDER_STATES, fdate } from "./types";
import { adminRealDashboardStats, type RealDashboardStats } from "@/app/admin/actions";

export default function Resumen({ orders, onGo }: {
  orders: Order[];
  onGo: (tab: "facturas" | "pedidos" | "clientes") => void;
}) {
  const [real, setReal] = useState<RealDashboardStats | null>(null);
  useEffect(() => { adminRealDashboardStats().then((res) => { if (res.ok) setReal(res.stats ?? null); }); }, []);

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
