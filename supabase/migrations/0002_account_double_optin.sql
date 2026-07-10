-- Doble opt-in de solicitudes de cuenta profesional.
-- Las solicitudes entran como 'unverified' vía la edge function account-submit
-- (honeypot + Turnstile) y solo pasan a 'pending' (visibles para admin) cuando
-- el solicitante confirma su correo mediante confirm_account_request(token).

alter table public.account_requests
  add column if not exists email_verified boolean not null default false,
  add column if not exists verify_token text,
  add column if not exists verify_sent_at timestamptz,
  add column if not exists verified_at timestamptz;

alter table public.account_requests drop constraint if exists account_requests_status_check;
alter table public.account_requests
  add constraint account_requests_status_check
  check (status in ('unverified','pending','approved','rejected'));

create unique index if not exists account_requests_verify_token_key
  on public.account_requests (verify_token) where verify_token is not null;

-- El público ya no inserta directo en la tabla: solo la edge function (service_role).
drop policy if exists account_requests_insert_public on public.account_requests;

create or replace function public.confirm_account_request(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_token is null or length(p_token) < 10 then return 'invalid'; end if;
  update public.account_requests
     set status = 'pending', email_verified = true, verified_at = now(), verify_token = null
   where verify_token = p_token and status = 'unverified'
   returning id into v_id;
  if v_id is null then return 'invalid'; end if;
  return 'ok';
end $$;

revoke all on function public.confirm_account_request(text) from public;
grant execute on function public.confirm_account_request(text) to anon, authenticated;

-- Avisar al admin solo cuando la solicitud queda confirmada (status = 'pending').
drop trigger if exists trg_account_notify on public.account_requests;
create trigger trg_account_notify
  after insert or update on public.account_requests
  for each row
  when (new.status = 'pending' and new.notified_at is null)
  execute function public.tg_account_notify();
