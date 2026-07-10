-- Endurecimiento: las funciones de trigger no deben ser invocables como RPC REST.
revoke all on function public.tg_profiles_protect() from anon, authenticated;
revoke all on function public.tg_account_notify() from anon, authenticated;
revoke all on function public.tg_contact_notify() from anon, authenticated;
revoke all on function public.tg_subscribe_notify() from anon, authenticated;
alter function public.lon_shipping_cost(numeric) set search_path = public;
