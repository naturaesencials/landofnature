-- Los mensajes de contacto solo entran vía la edge function contact-submit
-- (honeypot + Turnstile, service_role). Se elimina el INSERT público directo.
drop policy if exists contact_insert_anon on public.contact_messages;
