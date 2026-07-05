import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* llamado desde un Server Component: se ignora */ }
      },
    },
  });
}
