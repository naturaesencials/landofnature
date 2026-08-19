"use client";
import { useState } from "react";
import { adminErpAttachments, adminErpAttachmentUrl, type ErpAttachment } from "@/app/admin/actions";

function fmtSize(b: number | null) {
  if (!b) return "";
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentsButton({ categoria, referencia }: { categoria: string; referencia: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ErpAttachment[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (rows === null) {
      setLoading(true);
      const res = await adminErpAttachments(categoria, referencia);
      setLoading(false);
      if (res.ok) setRows(res.rows ?? []);
    }
  }

  async function openFile(path: string) {
    setOpening(path);
    const res = await adminErpAttachmentUrl(path);
    setOpening(null);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else alert(res.error || "No se pudo abrir el archivo.");
  }

  return (
    <span className="no-print">
      <button className="btn-sm" onClick={toggle}>{open ? "Ocultar adjuntos" : "Adjuntos"}</button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {loading && <p style={{ fontSize: 12 }}>Cargando…</p>}
          {rows && rows.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>Sin adjuntos en Odoo.</p>}
          {rows && rows.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
              {rows.map((a) => (
                <li key={a.storage_path}>
                  <button
                    onClick={() => openFile(a.storage_path)}
                    disabled={opening === a.storage_path}
                    style={{ background: "none", border: "none", padding: 0, color: "var(--olive, #55632F)", textDecoration: "underline", cursor: "pointer", font: "inherit" }}
                  >
                    {opening === a.storage_path ? "Abriendo…" : a.nombre_archivo}
                  </button>
                  <span style={{ color: "var(--muted)" }}> ({fmtSize(a.tamano_bytes)})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
