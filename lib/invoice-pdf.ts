import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export type InvoicePdfLine = {
  description: string;
  quantity?: number;
  unit_price?: number;
  vat_rate?: number;
  subtotal?: number;
  is_note?: boolean;
};

export type InvoicePdfData = {
  numero: string;
  kind: "invoice" | "credit_note";
  issue_date: string;
  customer_name: string;
  customer_cif: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_postal_code: string | null;
  customer_province: string | null;
  lines: InvoicePdfLine[];
  subtotal: number;
  vat_amount: number;
  total: number;
  payment_method: string | null;
  order_no: number | null;
  rectifies_numero?: string | null;
  rectification_reason?: string | null;
};

const OLIVE = "#55632F";
const OLIVE_MED = "#6B7A3E";
const SAGE = "#8E9C6A";
const LIGHT_SAGE = "#C2CCA2";
const CREAM = "#EEF0E4";
const TEXT = "#414A34"; // Gris oliva — texto, según guía de marca

const euro = (n: number) => `${n.toFixed(2).replace(".", ",")} \u20ac`;
const fdate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const logoPath = path.join(process.cwd(), "public", "logo-vertical.png");
    const pageWidth = doc.page.width - 100;

    // ---- Cabecera ----
    // Logo vertical (icono + wordmark + tagline en una sola imagen) a la izquierda;
    // bloque de tipo de documento/número/fecha a la derecha, alineado con la altura del logo.
    let headerBottom = 100;
    if (fs.existsSync(logoPath)) {
      const logoHeight = 62;
      doc.image(logoPath, 50, 40, { height: logoHeight });
      headerBottom = 40 + logoHeight;
    } else {
      doc.fillColor(OLIVE).fontSize(18).font("Helvetica-Bold").text("Land of Nature", 50, 50);
      doc.fillColor(TEXT).fontSize(9).font("Helvetica").text("Transformando Positivamente", 50, 74);
      headerBottom = 90;
    }

    const title = data.kind === "credit_note" ? "Factura rectificativa" : "Factura";
    doc.fillColor(SAGE).fontSize(9).font("Helvetica").text(title.toUpperCase(), 0, 50, { align: "right", width: pageWidth + 50 });
    doc.fillColor(TEXT).fontSize(13).font("Helvetica-Bold").text(data.numero, 0, 63, { align: "right", width: pageWidth + 50 });
    doc.fillColor(TEXT).fontSize(9).font("Helvetica").text(`Fecha: ${fdate(data.issue_date)}`, 0, 80, { align: "right", width: pageWidth + 50 });

    const dividerY = Math.max(headerBottom + 10, 105);
    doc.moveTo(50, dividerY).lineTo(50 + pageWidth, dividerY).lineWidth(1.5).strokeColor(OLIVE).stroke();

    // ---- Rectificativa: aviso ----
    let y = dividerY + 13;
    if (data.kind === "credit_note" && data.rectifies_numero) {
      doc.fillColor(TEXT).fontSize(9).font("Helvetica-Bold").text(`Rectifica a la factura ${data.rectifies_numero}`, 50, y);
      y += 12;
      if (data.rectification_reason) {
        doc.font("Helvetica").fillColor(TEXT).text(`Motivo: ${data.rectification_reason}`, 50, y, { width: pageWidth });
        y += 14;
      }
      y += 6;
    }

    // ---- Emisor / Cliente ----
    const colWidth = pageWidth / 2 - 10;
    doc.fillColor(OLIVE_MED).fontSize(8).font("Helvetica-Bold").text("EMISOR", 50, y);
    doc.fillColor(TEXT).fontSize(10).font("Helvetica-Bold").text("Land of Nature, S.L.", 50, y + 12);
    doc.fillColor(TEXT).fontSize(9).font("Helvetica").text(
      "CIF ESB05422639\nCalle Letonia, Nave 16, P.I. San Pedro de Alcántara\n29670 Marbella (Málaga), España\ninfo@landofnature.com",
      50, y + 26, { width: colWidth, lineGap: 2 }
    );

    const col2X = 50 + colWidth + 20;
    doc.fillColor(OLIVE_MED).fontSize(8).font("Helvetica-Bold").text("CLIENTE", col2X, y);
    doc.fillColor(TEXT).fontSize(10).font("Helvetica-Bold").text(data.customer_name, col2X, y + 12, { width: colWidth });
    const clienteLines = [
      data.customer_cif ? `NIF/CIF: ${data.customer_cif}` : null,
      [data.customer_address, data.customer_postal_code, data.customer_city, data.customer_province].filter(Boolean).join(", ") || null,
      data.customer_email,
    ].filter(Boolean).join("\n");
    doc.fillColor(TEXT).fontSize(9).font("Helvetica").text(clienteLines, col2X, y + 26, { width: colWidth, lineGap: 2 });

    y += 90;

    // ---- Tabla de líneas ----
    const cols = { desc: 50, qty: 300, price: 350, vat: 420, amount: 460 };
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).lineWidth(0.5).strokeColor(LIGHT_SAGE).stroke();
    y += 6;
    doc.fillColor(OLIVE_MED).fontSize(8).font("Helvetica-Bold");
    doc.text("PRODUCTO", cols.desc, y);
    doc.text("CANT.", cols.qty, y, { width: 40, align: "right" });
    doc.text("PRECIO", cols.price, y, { width: 60, align: "right" });
    doc.text("IVA", cols.vat, y, { width: 30, align: "right" });
    doc.text("IMPORTE", cols.amount, y, { width: pageWidth + 50 - cols.amount, align: "right" });
    y += 14;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).lineWidth(0.5).strokeColor(LIGHT_SAGE).stroke();
    y += 6;

    doc.font("Helvetica").fontSize(9).fillColor(TEXT);
    for (const line of data.lines) {
      if (line.is_note) {
        const noteWidth = pageWidth - 20;
        doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(TEXT);
        const rowHeight = Math.max(12, doc.heightOfString(line.description, { width: noteWidth }));
        doc.text(line.description, cols.desc + 10, y, { width: noteWidth });
        doc.font("Helvetica").fontSize(9);
        y += rowHeight + 6;
        continue;
      }
      const rowHeight = Math.max(14, doc.heightOfString(line.description, { width: 240 }));
      doc.text(line.description, cols.desc, y, { width: 240 });
      doc.text(String(line.quantity), cols.qty, y, { width: 40, align: "right" });
      doc.text(euro(line.unit_price ?? 0), cols.price, y, { width: 60, align: "right" });
      doc.text(`${line.vat_rate}%`, cols.vat, y, { width: 30, align: "right" });
      doc.text(euro(line.subtotal ?? 0), cols.amount, y, { width: pageWidth + 50 - cols.amount, align: "right" });
      y += rowHeight + 6;
    }

    // ---- Totales ----
    y += 8;
    doc.moveTo(50 + pageWidth - 200, y).lineTo(50 + pageWidth, y).lineWidth(0.5).strokeColor(LIGHT_SAGE).stroke();
    y += 8;
    const totalsX = 50 + pageWidth - 200;
    doc.fontSize(9).fillColor(TEXT).font("Helvetica");
    doc.text("Base imponible", totalsX, y, { width: 120 });
    doc.text(euro(data.subtotal), totalsX + 120, y, { width: 80, align: "right" });
    y += 14;
    doc.text("IVA", totalsX, y, { width: 120 });
    doc.text(euro(data.vat_amount), totalsX + 120, y, { width: 80, align: "right" });
    y += 16;
    doc.moveTo(totalsX, y).lineTo(totalsX + 200, y).lineWidth(1).strokeColor(OLIVE).stroke();
    y += 6;
    doc.fillColor(TEXT).fontSize(12).font("Helvetica-Bold").text("Total", totalsX, y, { width: 120 });
    doc.text(euro(data.total), totalsX + 120, y, { width: 80, align: "right" });

    // ---- Pie ----
    const footerY = doc.page.height - 90;
    doc.moveTo(50, footerY).lineTo(50 + pageWidth, footerY).lineWidth(0.5).strokeColor(LIGHT_SAGE).stroke();
    const paymentLabel = data.payment_method === "card" ? "Tarjeta" : data.payment_method === "transfer" ? "Transferencia bancaria" : (data.payment_method || "—");
    doc.fillColor(SAGE).fontSize(8).font("Helvetica").text(
      `Forma de pago: ${paymentLabel}${data.order_no ? ` \u00b7 Ref. pedido #${data.order_no}` : ""}\nEspacio reservado para c\u00f3digo QR de verificaci\u00f3n (Verifactu, desde 2027)`,
      50, footerY + 10, { width: pageWidth, lineGap: 2 }
    );

    doc.end();
  });
}
