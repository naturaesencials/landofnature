import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logout from "@/components/Logout";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };
export const revalidate = 0;

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/acceso");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const sinceYear = new Date().getFullYear() - 2;

  const [
    { data: products }, { data: orders }, { data: requests }, { data: clients },
    { data: tariffs }, { data: tariffPrices },
    { data: contracts }, { data: targets }, { data: commissions },
    { data: invoices }, { data: payments }, { data: clientOrders },
  ] = await Promise.all([
    supabase.from("products").select("id,brand,name,size,sku,public_price,stock,active,units_per_box,family,category").order("brand").order("name"),
    supabase.from("orders").select("id,order_no,created_at,client_id,name,email,phone,address,postal_code,city,province,country,payment_method,status,total,shipping,carrier,carrier_name,tracking_number,tracking_url,shipped_at,order_items(name_snapshot,qty,unit_price)").order("created_at", { ascending: false }).limit(100),
    supabase.from("account_requests").select("id,contact_name,company,cif,business_type,email,phone,message,status,created_at").neq("status", "unverified").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,company,cif,phone,role,tariff_code,status,allow_transfer,commercial_agreement,gc_mandate_status,created_at").neq("role", "admin").order("created_at", { ascending: false }),
    supabase.from("tariffs").select("code,name,sort").order("sort"),
    supabase.from("product_tariff_prices").select("product_id,tariff_code,price"),
    supabase.from("client_contracts").select("*").order("start_date", { ascending: false }),
    supabase.from("contract_targets").select("*").order("year"),
    supabase.from("contract_commissions").select("*").order("period_year", { ascending: false }).order("period_no", { ascending: false }),
    supabase.from("invoices").select("*").order("issue_date", { ascending: false }).limit(400),
    supabase.from("invoice_payments").select("*").order("paid_on", { ascending: false }).limit(600),
    supabase.from("orders").select("client_id,created_at,total,status").not("client_id", "is", null).gte("created_at", `${sinceYear}-01-01`),
  ]);

  return (
    <section className="page"><div className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <h1>Administración</h1>
          <p className="lead" style={{ margin: 0 }}>Panel interno · {profile?.full_name || user.email}</p>
        </div>
        <Logout />
      </div>
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      <AdminPanel
        products={(products ?? []) as any}
        orders={(orders ?? []) as any}
        requests={(requests ?? []) as any}
        clients={(clients ?? []) as any}
        tariffs={(tariffs ?? []) as any}
        tariffPrices={(tariffPrices ?? []) as any}
        contracts={(contracts ?? []) as any}
        targets={(targets ?? []) as any}
        commissions={(commissions ?? []) as any}
        invoices={(invoices ?? []) as any}
        payments={(payments ?? []) as any}
        clientOrders={(clientOrders ?? []) as any}
      />
      {/* eslint-enable @typescript-eslint/no-explicit-any */}
    </div></section>
  );
}
