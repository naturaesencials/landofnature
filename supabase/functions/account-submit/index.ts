// Punto de entrada único de solicitudes de cuenta profesional.
// Valida honeypot + Cloudflare Turnstile, registra la solicitud como 'unverified'
// y envía el correo de confirmación (doble opt-in). Secretos en public.app_config.
// verify_jwt = false (endpoint público).
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const esc = (s: unknown) => (s ?? "").toString().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function shell(site: string, preheader: string, contentHtml: string): string {
  const dominio = site.replace(/^https?:\/\//, "");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#EEF0E4;font-family:Arial,Helvetica,sans-serif;color:#414A34">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EEF0E4">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0E4;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(65,74,52,.08)">
<tr><td style="padding:0;font-size:0;line-height:0"><a href="${site}"><img src="${site}/email-cabecera-clara.png" alt="Land of Nature" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0"></a></td></tr>
<tr><td style="height:4px;font-size:0;line-height:0;background:#6B7A3E;background-image:linear-gradient(90deg,#55632F,#8E9C6A)">&nbsp;</td></tr>
<tr><td style="padding:34px 40px">${contentHtml}</td></tr>
<tr><td style="padding:26px 40px 32px;border-top:1px solid #E3E7D8">
<div style="text-align:center">
<div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;color:#8E9C6A">Transformando Positivamente</div>
<div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a927e"><a href="${site}" style="color:#6B7A3E;text-decoration:none;font-weight:700">${dominio}</a> &nbsp;&middot;&nbsp; <a href="mailto:info@landofnature.com" style="color:#6B7A3E;text-decoration:none">info@landofnature.com</a></div>
<div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a7ad9c">Calle Letonia 16, San Pedro de Alc&aacute;ntara</div>
</div></td></tr>
</table>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a7ad9c;margin-top:14px">&copy; ${new Date().getFullYear()} Land of Nature</div>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const b = await req.json().catch(() => ({} as any));

    // Honeypot: campo oculto que solo rellenan los bots -> aceptamos y descartamos.
    if (b.website && String(b.website).trim() !== "") return json({ ok: true });

    const contact_name = String(b.contact_name ?? "").trim();
    const company = String(b.company ?? "").trim();
    const cif = String(b.cif ?? "").trim();
    const business_type = b.business_type ? String(b.business_type).trim() : null;
    const email = String(b.email ?? "").trim().toLowerCase();
    const phone = String(b.phone ?? "").trim();
    const message = b.message ? String(b.message).trim() : null;
    if (!contact_name || !company || !cif || !email || !phone) return json({ ok: false, error: "Faltan datos obligatorios." });
    if (!emailOk(email)) return json({ ok: false, error: "Correo no válido." });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await supabase.from("app_config").select("key,value").in("key", ["resend_api_key", "notify_from", "site_url", "turnstile_secret"]);
    const m: Record<string, string> = {};
    for (const c of (cfg ?? []) as any[]) m[c.key] = c.value;
    const RESEND = m["resend_api_key"];
    const FROM = m["notify_from"] || "Land of Nature <info@landofnature.com>";
    const SITE = (m["site_url"] || "https://www.landofnature.com").replace(/\/$/, "");
    const TURNSTILE = m["turnstile_secret"];

    // Verificación humana (Cloudflare Turnstile). Si aún no hay secreto configurado,
    // se omite para no bloquear el formulario (honeypot + doble opt-in siguen activos).
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

    // Anti-flood: una sola solicitud sin confirmar por correo cada 20 min.
    const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: recent } = await supabase.from("account_requests")
      .select("id").eq("email", email).eq("status", "unverified").gte("created_at", since).limit(1).maybeSingle();
    if (recent) return json({ ok: true });

    const verify_token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    const { error: insErr } = await supabase.from("account_requests").insert({
      contact_name, company, cif, business_type, email, phone, message,
      status: "unverified", email_verified: false, verify_token, verify_sent_at: new Date().toISOString(),
    });
    if (insErr) { console.error("insert", insErr); return json({ ok: false, error: "No se pudo registrar la solicitud. Inténtalo de nuevo." }); }

    if (RESEND) {
      const link = `${SITE}/verificar?token=${verify_token}`;
      const saludo = contact_name ? `Hola ${esc(contact_name)},` : "Hola,";
      const html = `<h1 style="font-family:Georgia,serif;font-size:23px;font-weight:600;color:#55632F;margin:0 0 14px">Confirma tu correo</h1>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#414A34;margin:0 0 14px">${saludo} para completar tu solicitud de <b>cuenta profesional</b>${company ? " para <b>" + esc(company) + "</b>" : ""} solo falta un paso: confirma que este correo es tuyo.</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#414A34;margin:0 0 22px">Tu solicitud <b>no llegará a nuestro equipo</b> hasta que pulses el botón:</p>
<p style="margin:0 0 26px"><a href="${link}" style="display:inline-block;background:#55632F;color:#EEF0E4;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;padding:14px 34px;border-radius:8px;text-decoration:none;letter-spacing:.5px">Confirmar mi solicitud</a></p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.6;color:#64705A;margin:0 0 6px">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#6B7A3E;word-break:break-all;margin:0 0 20px">${link}</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#a7ad9c;margin:0">Si no has solicitado una cuenta en Land of Nature, ignora este mensaje: no se creará ninguna cuenta.</p>`;
      const text = `${contact_name ? "Hola " + contact_name : "Hola"},\n\nPara completar tu solicitud de cuenta profesional en Land of Nature, confirma tu correo pulsando este enlace:\n${link}\n\nTu solicitud no llegará a nuestro equipo hasta que la confirmes. Si no has solicitado nada, ignora este mensaje.\n\nLand of Nature · ${SITE.replace(/^https?:\/\//, "")}`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: email, subject: "Confirma tu correo para completar tu solicitud · Land of Nature", html, text, reply_to: "info@landofnature.com" }),
      });
      if (!r.ok) console.error("resend", r.status, await r.text());
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Error inesperado. Inténtalo de nuevo." }, 500);
  }
});
