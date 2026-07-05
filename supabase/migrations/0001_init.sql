-- ============================================================
-- Land of Nature — Tienda B2B/B2C · Esquema inicial (v1)
-- ============================================================
-- Modelo de seguridad (reglas Albion):
--   · RLS ACTIVADO en todas las tablas.
--   · Políticas SIEMPRE "TO authenticated", nunca "TO public".
--   · El escaparate público (catálogo, precio público) y los inserts de
--     invitado (pedido de invitado, solicitud de alta) NO tocan la BD con
--     el rol anon: se sirven desde el servidor Next.js con la SERVICE_ROLE
--     key (solo en servidor, nunca expuesta), con validación en servidor.
--   · NEXT_PUBLIC_ solo para URL y anon key (sesión de clientes profesionales).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Tarifas (A/B/C/D) ----------
create table public.tariffs (
  code text primary key,
  name text not null,
  sort int  not null default 0
);

-- ---------- Productos (catálogo) ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  brand text not null,
  name  text not null,
  category text not null,
  size text,
  sku text unique not null,
  description text,
  inci text,
  inci_verified boolean not null default false,
  public_price numeric(10,2) not null,          -- PVP / tarifa pública (invitado)
  stock int not null default 0,
  low_stock_threshold int not null default 20,
  active boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Precio por tarifa (profesional) ----------
create table public.product_tariff_prices (
  product_id uuid not null references public.products(id) on delete cascade,
  tariff_code text not null references public.tariffs(code) on delete cascade,
  price numeric(10,2) not null,
  primary key (product_id, tariff_code)
);

-- ---------- Perfiles (clientes profesionales + admin) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  cif text,
  phone text,
  role text not null default 'client' check (role in ('client','admin')),
  tariff_code text references public.tariffs(code),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

-- ---------- Solicitudes de alta (formulario "crear cuenta") ----------
create table public.account_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  company text not null,
  cif text not null,
  business_type text,
  email text not null,
  phone text not null,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- ---------- Pedidos ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity,
  type text not null check (type in ('guest','pro')),
  client_id uuid references public.profiles(id),
  email text not null,
  name text,
  phone text,
  payment_method text check (payment_method in ('transfer','card','gocardless')),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','processing','shipped','cancelled')),
  subtotal numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  name_snapshot text not null,
  sku_snapshot text,
  qty int not null check (qty > 0),
  unit_price numeric(10,2) not null
);

-- ---------- Helper: ¿es admin? ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.tariffs               enable row level security;
alter table public.products              enable row level security;
alter table public.product_tariff_prices enable row level security;
alter table public.profiles              enable row level security;
alter table public.account_requests      enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;

-- Tarifas: lectura a autenticados
create policy tariffs_read on public.tariffs
  for select to authenticated using (true);

-- Productos: catálogo activo legible por público (escaparate); admin gestiona todo
create policy products_read_public on public.products
  for select to anon, authenticated using (active = true);
create policy products_admin_all on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Precios por tarifa: cada cliente ve SOLO su tarifa; admin ve todo
create policy prices_read_own on public.product_tariff_prices
  for select to authenticated using (
    tariff_code = (select tariff_code from public.profiles where id = auth.uid())
    or public.is_admin()
  );
create policy prices_admin_all on public.product_tariff_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Perfiles: cada uno el suyo; admin todo
create policy profiles_self on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Solicitudes de alta: el público puede CREAR (formulario); solo admin lee/gestiona
create policy account_requests_insert_public on public.account_requests
  for insert to anon, authenticated with check (status = 'pending');
create policy account_requests_admin on public.account_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pedidos: cliente ve los suyos; admin todo (inserts de invitado por service_role)
create policy orders_own on public.orders
  for select to authenticated using (client_id = auth.uid() or public.is_admin());
create policy orders_admin_all on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_read on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o
            where o.id = order_id and (o.client_id = auth.uid() or public.is_admin()))
  );
create policy order_items_admin_all on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Clientes profesionales autenticados: crean sus propios pedidos
create policy orders_insert_pro on public.orders
  for insert to authenticated with check (client_id = auth.uid() and type = 'pro');
create policy order_items_insert_pro on public.order_items
  for insert to authenticated with check (
    exists (select 1 from public.orders o where o.id = order_id and o.client_id = auth.uid())
  );

-- ---------- RPC controlada para pedidos de invitado ----------
-- El invitado NO inserta en las tablas directamente: llama a esta función,
-- que valida stock y recalcula precios desde la BD (no se fía del cliente).
create or replace function public.create_guest_order(
  p_email text, p_name text, p_phone text, p_payment_method text, p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_order_no bigint;
  it jsonb;
  v_prod public.products%rowtype;
  v_sub numeric(10,2) := 0;
begin
  if p_payment_method is null or p_payment_method not in ('transfer','card') then
    p_payment_method := 'transfer';
  end if;
  insert into public.orders(type,email,name,phone,payment_method,status,subtotal)
    values ('guest', p_email, p_name, p_phone, p_payment_method, 'pending_payment', 0)
    returning id, order_no into v_order_id, v_order_no;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from public.products
      where id = (it->>'product_id')::uuid and active = true;
    if not found then raise exception 'Producto no disponible'; end if;
    if v_prod.stock < (it->>'qty')::int then
      raise exception 'Sin stock suficiente de %', v_prod.name;
    end if;
    insert into public.order_items(order_id,product_id,name_snapshot,sku_snapshot,qty,unit_price)
      values (v_order_id, v_prod.id, v_prod.name, v_prod.sku, (it->>'qty')::int, v_prod.public_price);
    v_sub := v_sub + v_prod.public_price * (it->>'qty')::int;
  end loop;
  update public.orders set subtotal = v_sub where id = v_order_id;
  return v_order_no;
end$$;
revoke all on function public.create_guest_order(text,text,text,text,jsonb) from public;
grant execute on function public.create_guest_order(text,text,text,text,jsonb) to anon, authenticated;

-- ============================================================
-- SEED (datos de muestra — se reemplazan por el Excel real)
-- ============================================================
insert into public.tariffs (code,name,sort) values
  ('A','Tarifa A',1),('B','Tarifa B',2),('C','Tarifa C',3),('D','Tarifa D',4);

insert into public.products
  (slug,brand,name,category,size,sku,description,inci,inci_verified,public_price,stock,active)
values
 ('jabon-liquido-ubuntu','Ubuntu Liquid','Jabón líquido natural mediterráneo','Corporal','500 ml','LON-UBU-500',
  'Jabón líquido de origen natural con aceites esenciales del mediterráneo.',
  'Aqua, Potassium Olivate, Potassium Cocoate, Glycerin, Aloe Barbadensis Leaf Juice, Citrus Aurantium Dulcis Peel Oil, Lavandula Angustifolia Oil, Citral, Limonene, Linalool',
  false, 9.83, 142, true),
 ('champu-hunhu','Hunhu Natural','Champú de origen natural','Capilar','250 ml','LON-HUN-CH25',
  'Champú de origen natural que respeta la barrera del cabello.',
  'Aqua, Sodium Cocoyl Isethionate, Coco-Glucoside, Glycerin, Aloe Barbadensis Leaf Juice, Panthenol, Rosmarinus Officinalis Leaf Extract, Parfum, Limonene, Linalool',
  false, 9.83, 88, true),
 ('body-milk-shikoba','Shikoba Care','Body milk de origen natural','Corporal','200 ml','LON-SHK-BM20',
  'Leche corporal de origen natural con ingredientes del mediterráneo andaluz.',
  'Aqua, Helianthus Annuus Seed Oil, Glycerin, Cetearyl Alcohol, Butyrospermum Parkii Butter, Tocopherol, Parfum, Benzyl Alcohol, Dehydroacetic Acid',
  false, 13.12, 34, true),
 ('detergente-hoop','Hoop Natural','Detergente de ropa de origen natural','Hogar','1 L','LON-HOO-DET1',
  'Detergente líquido de origen natural para el lavado de ropa.',
  'Aqua, Sodium Coco-Sulfate, Coco-Glucoside, Sodium Citrate, Glycerin, Citrus Limon Peel Oil, Parfum, Limonene',
  false, 13.50, 210, true),
 ('acondicionador-hunhu','Hunhu Natural','Acondicionador de origen natural','Capilar','250 ml','LON-HUN-AC25',
  'Acondicionador de origen natural para nutrición diaria del cabello.',
  'Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Glycerin, Argania Spinosa Kernel Oil, Panthenol, Parfum, Benzyl Alcohol',
  false, 11.20, 61, true),
 ('champu-mascotas-muntu','Muntu Animal Care','Champú natural para mascotas','Mascota','250 ml','LON-MUN-CH25',
  'Champú de origen natural para el cuidado del pelaje de mascotas.',
  'Aqua, Coco-Glucoside, Glycerin, Aloe Barbadensis Leaf Juice, Chamomilla Recutita Flower Extract, Parfum, Benzyl Alcohol',
  false, 11.90, 0, true);

-- Precios por tarifa (ejemplo: descuento sobre PVP → A -35%, B -30%, C -25%, D -20%)
insert into public.product_tariff_prices (product_id, tariff_code, price)
select p.id, t.code,
       round(p.public_price * (case t.code when 'A' then 0.65 when 'B' then 0.70 when 'C' then 0.75 else 0.80 end), 2)
from public.products p cross join public.tariffs t;

-- Hardening: is_admin() solo la usa RLS para autenticados; se retira de anon/public.
revoke execute on function public.is_admin() from anon, public;
grant  execute on function public.is_admin() to authenticated;
