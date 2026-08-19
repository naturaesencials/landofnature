"use client";
import { useRef, useState } from "react";
import { adminErpAttachments, adminErpAttachmentUrl, adminUploadAttachment, type ErpAttachment } from "@/app/admin/actions";

function fmtSize(b: number | null) {
  if (!b) return "";
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AttachmentsButton({ categoria, referencia }: { categoria: string; referencia: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ErpAttachment[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadRows() {
    setLoading(true);
    const res = await adminErpAttachments(categoria, referencia);
    setLoading(false);
    if (res.ok) setRows(res.rows ?? []);
  }

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (rows === null) await loadRows();
  }

  async function openFile(path: string) {
    setOpening(path);
    const res = await adminErpAttachmentUrl(path);
    setOpening(null);
    if (res.ok && res.url) window.open(res.url, "_blank");
    else alert(res.error || "No se pudo abrir el archivo.");
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (file.size > 50 * 1024 * 1024) { setUploadError("Máximo 50 MB."); e.target.value = ""; return; }
    setUploading(true);
    const base64 = await readAsBase64(file);
    const res = await adminUploadAttachment({ categoria, referencia, filename: file.name, mimetype: file.type, base64 });
    setUploading(false);
    e.target.value = "";
    if (!res.ok) { setUploadError(res.error || "No se pudo subir el archivo."); return; }
    await loadRows();
  }

  return (
    <span className="no-print">
      <button className="btn-sm" onClick={toggle}>{open ? "Ocultar adjuntos" : "Adjuntos"}</button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {loading && <p style={{ fontSize: 12 }}>Cargando…</p>}
          {rows && rows.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>Sin adjuntos.</p>}
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
          <div style={{ marginTop: 6 }}>
            <input ref={fileInputRef} type="file" onChange={handleFileChosen} disabled={uploading} style={{ display: "none" }} />
            <button className="btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Subiendo…" : "+ Subir archivo"}
            </button>
            {uploadError && <div style={{ color: "#b00020", fontSize: 11, marginTop: 4 }}>{uploadError}</div>}
          </div>
        </div>
      )}
    </span>
  );
}
