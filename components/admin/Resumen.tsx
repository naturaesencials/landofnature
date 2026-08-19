"use client";
import { useEffect, useMemo, useState } from "react";
import { euro } from "@/lib/types";
import {
  type Invoice, type Contract, type Commission,
  fdateES, today, addDays, invoiceOutstanding, isOverdue,
  contractEnd, daysLeft, minPurchaseStatus, round2,
} from "@/lib/contracts";
import type { Order, Client, ClientOrder } from "./types";
import { COUNTS_AS_PURCHASE, clientLabel, ORDER_STATES, fdate } from "./types";
import { adminRealDashboardStats, type RealDashboardStats } from "@/app/admin/actions";

export default function Resumen({ invoices, orders, clients, contracts, commissions, clientOrders, onGo }: {
  invoices: Invoice[]; orders: Order[]; clients: Client[]; contracts: Contract[];
  commissions: Commission[]; clientOrders: ClientOrder[];
  onGo: (tab: "facturas" | "pedidos" | "clientes") => void;
}) {
  const year = new Date().getFullYear();
  const horizon = addDays(today(), 30);

  const [real, setReal] = useState<RealDashboardStats | null>(null);
  useEffect(() => { adminRealDashboardStats().then((res) => { if (res.ok) setReal(res.stats ?? null); }); }, []);

  const k = useMemo(() => {
    let cobrar = 0, pagar = 0, vencCobrar = 0, vencPagar = 0, gastosAnio = 0, ventasAnio = 0;
    for (const i of invoices) {
      const y = new Date(i.issue_date + "T00:00:00").getFullYear();
      if (i.status !== "cancelled" && y === year) {
        if (i.direction === "purchase") gastosAnio += Number(i.base || 0);
        else ventasAnio += Number(i.base || 0);
      }
      const out = invoiceOutstanding(i);
      if (out <= 0) continue;
      if (i.direction === "sale") { cobrar += out; if (isOverdue(i)) vencCobrar += out; }
      else { pagar += out; if (isOverdue(i)) vencPagar += out; }
    }
    return {
      cobrar: round2(cobrar), pagar: round2(pagar),
      vencCobrar: round2(vencCobrar), vencPagar: round2(vencPagar),
      gastosAnio: round2(gastosAnio), ventasAnio: round2(ventasAnio),
    };
  }, [invoices, year]);

  const pedidosAbiertos = useMemo(
    () => orders.filter((o) => ["pending_payment", "paid", "confirmed", "preparing"].includes(o.status)),
    [orders]
  );
  const ventasPedidosAnio = useMemo(
    () => round2(clientOrders.filter((o) => COUNTS_AS_PURCHASE.includes(o.status) && new Date(o.created_at).getFullYear() === year)
      .reduce((s, o) => s + Number(o.total || 0), 0)),
    [clientOrders, year]
  );

  const proximos = useMemo(
    () => invoices
      .filter((i) => invoiceOutstanding(i) > 0 && i.due_date && i.due_date <= horizon)
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 12),
    [invoices, horizon]
  );

  const comisionesPend = useMemo(
    () => round2(commissions.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount || 0), 0)),
    [commissions]
  );

  /* Avisos de contrato: vencimiento próximo y mínimo de compra no cubierto */
  const avisos = useMemo(() => {
    const out: { client: string; text: string; tone: "bad" | "warn" }[] = [];
    for (const c of contracts) {
      if (c.status !== "active") continue;
      const cli = clients.find((x) => x.id === c.client_id);
      const name = cli ? clientLabel(cli) : "Cliente";
      const end = contractEnd(c);
      const left = daysLeft(end);
      if (left <= (c.notice_days || 0) + 30) {
        out.push({ client: name, tone: left < 0 ? "bad" : "warn", text: left < 0 ? `Contrato vencido el ${fdateES(end)}` : `Vence el ${fdateES(end)} · preaviso ${c.notice_days} días` });
      }
      const mine = clientOrders.filter((o) => o.client_id === c.client_id && COUNTS_AS_PURCHASE.includes(o.status));
      const st = minPurchaseStatus(c, sumPeriod(mine, c.min_purchase_period));
      if (st.deficit > 0 && !st.grace) {
        out.push({ client: name, tone: "warn", text: `Compra mínima ${PERIOD_ES[c.min_purchase_period]}: faltan ${euro(st.deficit)} (hasta ${fdateES(st.to)})` });
      }
    }
    return out;
  }, [contracts, clients, clientOrders]);

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

      <div className="adm-dt" style={{ marginBottom: 8 }}>Cobros y pagos de contratos B2B (sistema anterior)</div>
      <div className="adm-kpis">
        <Kpi label="Pendiente de cobro" value={euro(k.cobrar)} sub={k.vencCobrar > 0 ? `${euro(k.vencCobrar)} vencido` : "sin vencidos"} tone={k.vencCobrar > 0 ? "bad" : "ok"} onClick={() => onGo("facturas")} />
        <Kpi label="Pendiente de pago" value={euro(k.pagar)} sub={k.vencPagar > 0 ? `${euro(k.vencPagar)} vencido` : "sin vencidos"} tone={k.vencPagar > 0 ? "bad" : "mute"} onClick={() => onGo("facturas")} />
        <Kpi label={`Gastos ${year}`} value={euro(k.gastosAnio)} sub="base imponible" tone="mute" onClick={() => onGo("facturas")} />
        <Kpi label={`Facturado ${year}`} value={euro(k.ventasAnio)} sub="base imponible" tone="ok" onClick={() => onGo("facturas")} />
        <Kpi label={`Pedidos ${year}`} value={euro(ventasPedidosAnio)} sub={`${pedidosAbiertos.length} en curso`} tone="ok" onClick={() => onGo("pedidos")} />
        <Kpi label="Comisiones pendientes" value={euro(comisionesPend)} sub="por liquidar" tone={comisionesPend > 0 ? "warn" : "mute"} onClick={() => onGo("clientes")} />
      </div>

      <div className="adm-cols">
        <div>
          <div className="adm-dt">Vencimientos en los próximos 30 días</div>
          {proximos.length === 0 ? <p className="adm-hint">Nada pendiente en el horizonte.</p> : (
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th>Vence</th><th>Concepto</th><th>Tipo</th><th className="r">Pendiente</th></tr></thead>
                <tbody>
                  {proximos.map((i) => {
                    const cli = clients.find((c) => c.id === i.client_id);
                    return (
                      <tr key={i.id} className={isOverdue(i) ? "warn" : ""}>
                        <td className={isOverdue(i) ? "over" : ""}>{fdateES(i.due_date)}</td>
                        <td><b>{i.number || "—"}</b><span className="sub">{i.direction === "sale" ? (cli ? clientLabel(cli) : "—") : (i.counterparty || "—")}</span></td>
                        <td><span className={`adm-chip ${i.direction === "sale" ? "ok" : "pend"}`}>{i.direction === "sale" ? "Cobro" : "Gasto"}</span></td>
                        <td className="r"><b>{euro(invoiceOutstanding(i))}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
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
      </div>

      {avisos.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div className="adm-dt">Avisos de contrato</div>
          <div className="adm-alerts">
            {avisos.map((a, i) => (
              <div key={i} className={`adm-alert ${a.tone}`}>
                <b>{a.client}</b><span>{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PERIOD_ES: Record<string, string> = { month: "mensual", quarter: "trimestral", semester: "semestral", year: "anual" };

function sumPeriod(orders: ClientOrder[], period: string) {
  const step = { month: 1, quarter: 3, semester: 6, year: 12 }[period] || 1;
  const d = new Date();
  const from = new Date(d.getFullYear(), Math.floor(d.getMonth() / step) * step, 1);
  const to = new Date(from.getFullYear(), from.getMonth() + step, 0, 23, 59, 59);
  return round2(orders.filter((o) => { const x = new Date(o.created_at); return x >= from && x <= to; })
    .reduce((s, o) => s + Number(o.total || 0), 0));
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
