-- Código de barras para escaneo (no todos los productos lo tendrán de inicio)
alter table public.products add column if not exists barcode text;
create unique index if not exists products_barcode_key on public.products (barcode) where barcode is not null;

-- Almacenes
create table if not exists public.warehouses (
  id text primary key,
  name text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.warehouses (id, name, sort)
values ('principal', 'Almacén Principal', 0)
on conflict (id) do nothing;

-- Stock por almacén
create table if not exists public.inventory_levels (
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id text not null references public.warehouses(id) on delete restrict,
  on_hand integer not null default 0 check (on_hand >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, warehouse_id)
);

-- Migrar el stock actual al almacén principal
insert into public.inventory_levels (product_id, warehouse_id, on_hand)
select id, 'principal', coalesce(stock, 0) from public.products
on conflict (product_id, warehouse_id) do nothing;

-- Historial
create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  type text not null check (type in ('count','transfer')),
  product_id uuid references public.products(id) on delete set null,
  product_title text,
  sku text,
  barcode text,
  warehouse_id text,
  previous_qty integer,
  counted_qty integer,
  from_warehouse_id text,
  to_warehouse_id text,
  transfer_qty integer,
  from_previous_qty integer,
  to_previous_qty integer,
  note text
);
create index if not exists inventory_events_created_at_idx on public.inventory_events (created_at desc);
create index if not exists inventory_events_type_idx on public.inventory_events (type);
create index if not exists inventory_events_product_idx on public.inventory_events (product_id);

-- Mantener products.stock como total sincronizado (para no tocar checkout/pedidos)
create or replace function public.sync_product_stock() returns trigger as $$
declare
  v_pid uuid;
begin
  v_pid := coalesce(new.product_id, old.product_id);
  update public.products
    set stock = (select coalesce(sum(on_hand),0) from public.inventory_levels where product_id = v_pid),
        updated_at = now()
    where id = v_pid;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists inventory_levels_sync_stock on public.inventory_levels;
create trigger inventory_levels_sync_stock
after insert or update or delete on public.inventory_levels
for each row execute function public.sync_product_stock();

-- Recuento: upsert de inventory_levels + evento, en una función atómica
create or replace function public.inventory_record_count(
  p_product_id uuid, p_warehouse_id text, p_counted_qty integer, p_note text default null
) returns void as $$
declare
  v_previous integer;
  v_title text; v_sku text; v_barcode text;
begin
  if p_counted_qty < 0 then
    raise exception 'La cantidad no puede ser negativa';
  end if;

  select coalesce(on_hand,0) into v_previous from public.inventory_levels
    where product_id = p_product_id and warehouse_id = p_warehouse_id for update;
  if not found then v_previous := 0; end if;

  select trim(brand || ' ' || name), sku, barcode into v_title, v_sku, v_barcode
    from public.products where id = p_product_id;

  insert into public.inventory_levels (product_id, warehouse_id, on_hand)
    values (p_product_id, p_warehouse_id, p_counted_qty)
    on conflict (product_id, warehouse_id) do update set on_hand = p_counted_qty, updated_at = now();

  insert into public.inventory_events (type, product_id, product_title, sku, barcode, warehouse_id, previous_qty, counted_qty, note, created_by)
    values ('count', p_product_id, v_title, v_sku, v_barcode, p_warehouse_id, v_previous, p_counted_qty, p_note, auth.uid());
end;
$$ language plpgsql security definer set search_path = public;

-- Transferencia atómica entre almacenes + evento
create or replace function public.inventory_transfer(
  p_product_id uuid, p_from text, p_to text, p_qty integer, p_note text default null
) returns void as $$
declare
  v_from_qty integer; v_to_qty integer;
  v_title text; v_sku text; v_barcode text;
begin
  if p_from = p_to then raise exception 'El almacén de origen y destino no pueden coincidir'; end if;
  if p_qty <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;

  select coalesce(on_hand,0) into v_from_qty from public.inventory_levels
    where product_id = p_product_id and warehouse_id = p_from for update;
  if v_from_qty is null or v_from_qty < p_qty then
    raise exception 'Stock insuficiente en origen (hay %, se pide %)', coalesce(v_from_qty,0), p_qty;
  end if;

  select coalesce(on_hand,0) into v_to_qty from public.inventory_levels
    where product_id = p_product_id and warehouse_id = p_to for update;
  if not found then v_to_qty := 0; end if;

  select trim(brand || ' ' || name), sku, barcode into v_title, v_sku, v_barcode
    from public.products where id = p_product_id;

  update public.inventory_levels set on_hand = on_hand - p_qty, updated_at = now()
    where product_id = p_product_id and warehouse_id = p_from;

  insert into public.inventory_levels (product_id, warehouse_id, on_hand)
    values (p_product_id, p_to, p_qty)
    on conflict (product_id, warehouse_id) do update set on_hand = inventory_levels.on_hand + p_qty, updated_at = now();

  insert into public.inventory_events (type, product_id, product_title, sku, barcode, from_warehouse_id, to_warehouse_id, transfer_qty, from_previous_qty, to_previous_qty, note, created_by)
    values ('transfer', p_product_id, v_title, v_sku, v_barcode, p_from, p_to, p_qty, v_from_qty, v_to_qty, p_note, auth.uid());
end;
$$ language plpgsql security definer set search_path = public;

-- RLS: mismo patrón que el resto del panel (is_admin())
alter table public.warehouses enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.inventory_events enable row level security;

create policy warehouses_admin_all on public.warehouses for all to authenticated using (is_admin()) with check (is_admin());
create policy inventory_levels_admin_all on public.inventory_levels for all to authenticated using (is_admin()) with check (is_admin());
create policy inventory_events_admin_all on public.inventory_events for all to authenticated using (is_admin()) with check (is_admin());

grant execute on function public.inventory_record_count(uuid, text, integer, text) to authenticated;
grant execute on function public.inventory_transfer(uuid, text, text, integer, text) to authenticated;
