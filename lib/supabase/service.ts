import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Cliente con service_role: bypassa RLS. Solo para uso en servidor (server actions,
 * nunca en componentes cliente). Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY
 * (Project Settings -> API -> service_role, en Supabase). Si falta, se devuelve null y el
 * llamante debe abortar limpiamente en vez de fallar de forma confusa.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
