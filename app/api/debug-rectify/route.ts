import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createCreditNote } from "@/lib/invoice";

function esc(term: string): string {
  return `"${term.replace(/"/g, '\\"')}"`;
}

export async function GET() {
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ hasKey: false });

  const like = "%Pino%";
  const [nativeRes, erpRes] = await Promise.all([
    supabase.from("native_invoices").select("id,numero,customer_name,total,issue_date").eq("kind", "invoice").or(`numero.ilike.${esc(like)},customer_name.ilike.${esc(like)}`).limit(5),
    supabase.from("erp_invoices_sale").select("numero,partner,total,fecha,cif").or(`numero.ilike.${esc(like)},partner.ilike.${esc(like)}`).limit(5),
  ]);

  // Probar una rectificativa completa sobre una factura de Odoo real
  const { data: sampleInvoice } = await supabase.from("erp_invoices_sale").select("numero,partner,cif").ilike("partner", "%Pino%").limit(1).maybeSingle();

  let creditNoteResult = null;
  if (sampleInvoice) {
    creditNoteResult = await createCreditNote({
      rectifies_numero_externo: sampleInvoice.numero,
      customer_name: sampleInvoice.partner || "Test",
      customer_cif: sampleInvoice.cif,
      reason: "Prueba de diagnóstico",
      lines: [{ description: "Línea de prueba", quantity: 1, unit_price: 10, vat_rate: 21 }],
      send_email: false,
    });
    if (creditNoteResult.ok && creditNoteResult.id) {
      await supabase.from("native_invoice_lines").delete().eq("invoice_id", creditNoteResult.id);
      await supabase.from("native_invoices").delete().eq("id", creditNoteResult.id);
    }
  }

  return NextResponse.json({
    nativeSearch: { data: nativeRes.data, error: nativeRes.error?.message },
    erpSearch: { data: erpRes.data, error: erpRes.error?.message },
    sampleInvoiceFound: sampleInvoice,
    creditNoteResult,
  });
}
