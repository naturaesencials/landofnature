"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function Logout() {
  const router = useRouter();
  return <button className="btn line" onClick={async () => { await createClient().auth.signOut(); router.push("/"); router.refresh(); }}>Cerrar sesión</button>;
}
