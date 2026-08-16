"use client";
import { useEffect, useState } from "react";
import { euro } from "@/lib/types";
import { fdate } from "./types";
import { adminWebCustomers, type WebCustomer } from "@/app/admin/actions";

export default function ClientesWeb() {
  const [rows, setRows] = useState<WebCustomer[] | null>(null);
  const [filter, setFilter] = useState<"todos" | "registrados" | "invitados">("todos");

  useEffect(() => { adminWebCustomers().then((res) => { if (res.ok) setRows(res.rows ?? []); }); }, []);

  const filtered = (rows ?? []).filter((r) =>
    filter === "todos" ? true : filter === "registrados" ? r.registered : !r.registered
  );
  const registeredCount = (rows ?? []).filter((r) => r.registered).length;
  const guestCount = (rows ?? []).filter((r) => !r.registered).length;

  return (
    <div>
      <p className="lead" style={{ marginTop: 0 }}>
        Clientes que han comprado en esta web (registrados o como invitado). No incluye el histórico de
        Odoo previo al lanzamiento — ese está en el <b>Directorio</b>.
      </p>

      <div className="adm-tabs" style={{ marginBottom: 16 }}>
        <button className={filter === "todos" ? "on" : ""} onClick={() => setFilter("todos")}>Todos <span>{rows?.length ?? 0}</span></button>
        <button className={filter === "registrados" ? "on" : ""} onClick={() => setFilter("registrados")}>Registrados <span>{registeredCount}</span></button>
        <button className={filter === "invitados" ? "on" : ""} onClick={() => setFilter("invitados")}>Invitados <span>{guestCount}</span></button>
      </div>

      {!rows && <p>Cargando…</p>}
      {rows && (
        filtered.length ? (
          <table className="adm-table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Ciudad</th><th>Tipo</th><th className="r">Pedidos</th><th className="r">Total gastado</th><th>Último pedido</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.email}>
                  <td><b>{c.name || "—"}</b></td>
                  <td>{c.email}</td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.city || "—"}</td>
                  <td>{c.registered ? "Registrado" : "Invitado"}</td>
                  <td className="r">{c.order_count}</td>
                  <td className="r">{euro(c.total_spent)}</td>
                  <td>{fdate(c.last_order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="adm-empty">Aún no hay clientes en esta categoría.</p>
      )}
    </div>
  );
}
