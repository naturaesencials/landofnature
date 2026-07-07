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

  const [{ data: products }, { data: orders }, { data: requests }] = await Promise.all([
    supabase.from("products").select("id,brand,name,size,sku,public_price,stock,active,units_per_box,family,category").order("brand").order("name"),
    supabase.from("orders").select("id,order_no,created_at,name,email,phone,address,postal_code,city,province,country,payment_method,status,total,order_items(name_snapshot,qty,unit_price)").order("created_at", { ascending: false }).limit(100),
    supabase.from("account_requests").select("id,contact_name,company,cif,business_type,email,phone,message,status,created_at").order("created_at", { ascending: false }),
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
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AdminPanel products={(products ?? []) as any} orders={(orders ?? []) as any} requests={(requests ?? []) as any} />
    </div></section>
  );
}
