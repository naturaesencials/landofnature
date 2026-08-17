import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ hasKey: false });

  const testNumero = `TEST/DEBUG/${Date.now()}`;
  const { data, error } = await supabase.from("native_invoices").insert({
    numero: testNumero, kind: "invoice", status: "issued", issue_date: new Date().toISOString(),
    customer_name: "Diagnóstico", subtotal: 1, vat_amount: 0.21, total: 1.21,
  }).select().single();

  if (error) {
    return NextResponse.json({ hasKey: true, insertOk: false, errorCode: error.code, errorMessage: error.message });
  }

  await supabase.from("native_invoices").delete().eq("id", data.id);

  const { data: seq, error: rpcError } = await supabase.rpc("next_invoice_seq", { p_key: "DEBUG-TEST" });

  return NextResponse.json({ hasKey: true, insertOk: true, rpcOk: !rpcError, rpcValue: seq, rpcError: rpcError?.message });
}
