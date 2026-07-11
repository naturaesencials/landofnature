// Punto de entrada único del formulario de contacto.
// Valida honeypot + Cloudflare Turnstile y luego inserta (service_role).
// El trigger AFTER INSERT (tg_contact_notify) sigue avisando al admin.
// verify_jwt = false (endpoint público). Secreto de Turnstile en public.app_config.
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const b = await req.json().catch(() => ({} as any));

    // Honeypot: campo oculto que solo rellenan los bots -> aceptamos y descartamos.
    if (b.website && String(b.website).trim() !== "") return json({ ok: true });

    const name = b.name ? String(b.name).trim() : null;
    const email = String(b.email ?? "").trim().toLowerCase();
    const phone = b.phone ? String(b.phone).trim() : null;
    const subject = b.subject ? String(b.subject).trim() : null;
    const message = String(b.message ?? "").trim();
    if (!email || !message) return json({ ok: false, error: "Faltan datos obligatorios." });
    if (!emailOk(email)) return json({ ok: false, error: "Correo no válido." });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await supabase.from("app_config").select("key,value").eq("key", "turnstile_secret").maybeSingle();
    const TURNSTILE = cfg?.value as string | undefined;

    // Verificación humana (Cloudflare Turnstile). Si aún no hay secreto, se omite
    // (el honeypot y el cierre del insert directo siguen protegiendo).
    if (TURNSTILE) {
      const token = String(b.turnstileToken ?? "");
      if (!token) return json({ ok: false, error: "Completa la verificación de seguridad." });
      const fd = new URLSearchParams();
      fd.append("secret", TURNSTILE);
      fd.append("response", token);
      const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      if (ip) fd.append("remoteip", ip);
      const vr = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd });
      const vo = await vr.json().catch(() => ({ success: false }));
      if (!vo.success) return json({ ok: false, error: "No hemos podido verificar que eres humano. Inténtalo de nuevo." });
    }

    // Anti-flood: mismo correo, máx 1 mensaje cada 3 min.
    const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: recent } = await supabase.from("contact_messages")
      .select("id").eq("email", email).gte("created_at", since).limit(1).maybeSingle();
    if (recent) return json({ ok: true });

    const { error: insErr } = await supabase.from("contact_messages").insert({ name, email, phone, subject, message, status: "new" });
    if (insErr) { console.error("insert", insErr); return json({ ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo." }); }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Error inesperado. Inténtalo de nuevo." }, 500);
  }
});
