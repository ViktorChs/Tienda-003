-- ============================================================
--  07. INTEGRACION OX1 (control plane) + LIMITES DE SUSCRIPCION
--  Ejecutar DESPUES de schema.sql, multistore.sql, security.sql,
--  security_hardening.sql y store_lifecycle.sql.
--  Idempotente.
--
--  - OX1 manda el bloqueo: stores.ox1_blocked + reason.
--  - La tienda bloqueada deja de leerse por anon y no acepta pedidos.
--  - Tier local (free/basico/profesional/empresarial) para fallback y
--    para que la base pueda validar limites aunque OX1 no responda.
--  - Limites:
--      free/basico  = Pequeno Emprendimiento: 7 visibles / 1 imagen
--      profesional  = Emprendimiento:         25 visibles / 2 imagenes
--      empresarial  = Empresario:            100 visibles / 5 imagenes
--    Ocultos: +20 por tienda, no cuentan contra el limite visible.
--  - Solo service_role / SQL editor puede cambiar tier o bloqueo.
-- ============================================================

-- ============================================================
-- 1. COLUMNAS OX1 + EMAIL DE ADMINS
-- ============================================================
alter table public.stores add column if not exists ox1_blocked boolean not null default false;
alter table public.stores add column if not exists ox1_blocked_reason text;
alter table public.stores add column if not exists ox1_synced_at timestamptz;
alter table public.stores add column if not exists subscription_tier text not null default 'free';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_subscription_tier_chk') then
    alter table public.stores
      add constraint stores_subscription_tier_chk
      check (subscription_tier in ('free', 'basico', 'profesional', 'empresarial'));
  end if;
end $$;

alter table public.admins add column if not exists email text;

update public.admins a
   set email = lower(u.email)
  from auth.users u
 where a.id = u.id
   and (a.email is null or btrim(a.email) = '');

create index if not exists admins_store_email_idx on public.admins (store_id, lower(email));

-- ============================================================
-- 2. LIMITES POR TIER (fuente unica en la base)
-- ============================================================
create or replace function public.store_plan_limits(p_tier text)
returns jsonb
language sql
immutable
as $$
  select case coalesce(nullif(btrim(p_tier), ''), 'free')
    when 'empresarial' then jsonb_build_object(
      'tier', 'empresarial',
      'label', 'Empresario',
      'visible_limit', 100,
      'image_limit', 5,
      'hidden_limit', 20,
      'upgrade_url', 'https://wa.me/584121049705'
    )
    when 'profesional' then jsonb_build_object(
      'tier', 'profesional',
      'label', 'Emprendimiento',
      'visible_limit', 25,
      'image_limit', 2,
      'hidden_limit', 20,
      'upgrade_url', 'https://wa.me/584121049705'
    )
    when 'basico' then jsonb_build_object(
      'tier', 'basico',
      'label', 'Pequeno Emprendimiento',
      'visible_limit', 7,
      'image_limit', 1,
      'hidden_limit', 20,
      'upgrade_url', 'https://wa.me/584121049705'
    )
    else jsonb_build_object(
      'tier', 'free',
      'label', 'Prueba',
      'visible_limit', 7,
      'image_limit', 1,
      'hidden_limit', 20,
      'upgrade_url', 'https://wa.me/584121049705'
    )
  end;
$$;

grant execute on function public.store_plan_limits(text) to anon, authenticated, service_role;

-- ============================================================
-- 3. HELPERS DE AUTORIZACION: tienda activa y NO bloqueada por OX1
-- ============================================================
create or replace function public.store_is_open(p_store bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.stores st
      left join public.settings se on se.store_id = st.id
     where st.id = p_store
       and st.active
       and not coalesce(st.ox1_blocked, false)
       and coalesce((se.data #>> '{store,open}')::boolean, true)
  );
$$;

grant execute on function public.store_is_open(bigint) to anon, authenticated, service_role;

create or replace function public.current_admin_store()
returns bigint
language sql stable security definer set search_path = public
as $$
  select a.store_id
    from public.admins a
    join public.stores st on st.id = a.store_id
   where a.id = auth.uid()
     and a.active
     and st.active
     and not coalesce(st.ox1_blocked, false);
$$;

create or replace function public.is_admin_of(p_store bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1
      from public.admins a
      join public.stores st on st.id = a.store_id
     where a.id = auth.uid()
       and a.active
       and a.store_id = p_store
       and st.active
       and not coalesce(st.ox1_blocked, false)
  );
$$;

create or replace function public.is_owner_of(p_store bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1
      from public.admins a
      join public.stores st on st.id = a.store_id
     where a.id = auth.uid()
       and a.active
       and a.role = 'owner'
       and a.store_id = p_store
       and st.active
       and not coalesce(st.ox1_blocked, false)
  );
$$;

grant execute on function public.current_admin_store() to authenticated, service_role;
grant execute on function public.is_admin_of(bigint) to anon, authenticated, service_role;
grant execute on function public.is_owner_of(bigint) to authenticated, service_role;

-- ============================================================
-- 4. ESTADO PUBLICO: incluye bloqueo OX1 y tier actual
-- ============================================================
create or replace function public.store_public_status(p_store_id bigint)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'id', st.id,
    'slug', st.slug,
    'name', st.name,
    'active', st.active,
    'open', public.store_is_open(st.id),
    'ox1_blocked', coalesce(st.ox1_blocked, false),
    'tier', st.subscription_tier,
    'subscription_tier', st.subscription_tier,
    'limits', public.store_plan_limits(st.subscription_tier),
    'message', coalesce(se.data #>> '{store,closedMessage}', 'La tienda esta cerrada en este momento')
  )
  from public.stores st
  left join public.settings se on se.store_id = st.id
  where st.id = p_store_id;
$$;

grant execute on function public.store_public_status(bigint) to anon, authenticated, service_role;

-- ============================================================
-- 5. USO DEL PLAN (panel: barra de progreso y bloqueo de alta)
-- ============================================================
create or replace function public.store_product_usage(p_store_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tier   text;
  v_limits jsonb;
  v_visible int;
  v_hidden  int;
  v_total   int;
begin
  if auth.uid() is not null and not public.is_admin_of(p_store_id) then
    raise exception 'Sin permiso para ver el uso de esta tienda';
  end if;

  select coalesce(subscription_tier, 'free')
    into v_tier
    from public.stores
   where id = p_store_id;

  if not found then
    raise exception 'Tienda no valida';
  end if;

  v_limits := public.store_plan_limits(v_tier);

  select count(*) filter (where hidden = false),
         count(*) filter (where hidden = true),
         count(*)
    into v_visible, v_hidden, v_total
    from public.products
   where store_id = p_store_id;

  return v_limits || jsonb_build_object(
    'visible_count', v_visible,
    'hidden_count', v_hidden,
    'total_count', v_total,
    'can_add_visible', v_visible < (v_limits ->> 'visible_limit')::int,
    'can_add_hidden', v_hidden < (v_limits ->> 'hidden_limit')::int,
    'upgrade_url', 'https://wa.me/584121049705'
  );
end;
$$;

grant execute on function public.store_product_usage(bigint) to authenticated, service_role;

-- ============================================================
-- 6. GUARDIA: el owner NO puede cambiarse el plan ni desbloquearse
--    (service_role y SQL editor tienen auth.uid() null y sí pueden).
-- ============================================================
create or replace function public.stores_ox1_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.subscription_tier is distinct from old.subscription_tier)
     or (new.ox1_blocked is distinct from old.ox1_blocked)
     or (new.ox1_blocked_reason is distinct from old.ox1_blocked_reason)
     or (new.ox1_synced_at is distinct from old.ox1_synced_at) then
    raise exception 'Solo OX1 puede cambiar el plan o el bloqueo de la tienda';
  end if;

  return new;
end;
$$;

drop trigger if exists stores_ox1_guard_tg on public.stores;
create trigger stores_ox1_guard_tg
  before update on public.stores
  for each row execute function public.stores_ox1_guard();

-- ============================================================
-- 7. GUARDIA: limite de productos visibles/ocultos
-- ============================================================
create or replace function public.products_limits_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier    text;
  v_limits  jsonb;
  v_visible int;
  v_hidden  int;
  v_limit   int;
begin
  -- service_role / SQL editor no se limita (migraciones y soporte).
  if auth.uid() is null then
    return new;
  end if;

  select coalesce(subscription_tier, 'free')
    into v_tier
    from public.stores
   where id = new.store_id;

  if not found then
    raise exception 'Tienda no valida';
  end if;

  v_limits := public.store_plan_limits(v_tier);

  select count(*) filter (where hidden = false and (tg_op = 'INSERT' or id <> new.id)),
         count(*) filter (where hidden = true  and (tg_op = 'INSERT' or id <> new.id))
    into v_visible, v_hidden
    from public.products
   where store_id = new.store_id;

  if new.hidden then
    v_limit := (v_limits ->> 'hidden_limit')::int;
    if v_hidden >= v_limit then
      raise exception 'Limite de productos ocultos alcanzado (% de %). Contacta a OX1 para subir tu suscripcion: https://wa.me/584121049705', v_hidden, v_limit;
    end if;
  else
    v_limit := (v_limits ->> 'visible_limit')::int;
    if v_visible >= v_limit then
      raise exception 'Limite de productos alcanzado (% de %). Contacta a OX1 para subir tu suscripcion: https://wa.me/584121049705', v_visible, v_limit;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists products_limits_guard_tg on public.products;
create trigger products_limits_guard_tg
  before insert or update of hidden, store_id on public.products
  for each row execute function public.products_limits_guard();

-- ============================================================
-- 8. GUARDIA: limite de imagenes por producto
--    Cuenta imagen principal + galeria. Los combos no se limitan aqui
--    porque usan varias piezas para componer su imagen.
-- ============================================================
create or replace function public.products_images_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier    text;
  v_limits  jsonb;
  v_limit   int;
  v_gallery int;
  v_total   int;
begin
  if auth.uid() is null or new.type <> 'product' then
    return new;
  end if;

  select coalesce(subscription_tier, 'free')
    into v_tier
    from public.stores
   where id = new.store_id;

  if not found then
    raise exception 'Tienda no valida';
  end if;

  v_limits := public.store_plan_limits(v_tier);
  v_limit := (v_limits ->> 'image_limit')::int;

  v_gallery := case
    when jsonb_typeof(coalesce(new.images, '[]'::jsonb)) = 'array'
      then jsonb_array_length(coalesce(new.images, '[]'::jsonb))
    else 0
  end;

  v_total := v_gallery + case when coalesce(btrim(new.image), '') <> '' then 1 else 0 end;

  if v_total > v_limit then
    raise exception 'Tu plan permite % imagen(es) por producto. Contacta a OX1 para subir tu suscripcion: https://wa.me/584121049705', v_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists products_images_guard_tg on public.products;
create trigger products_images_guard_tg
  before insert or update of image, images, type, store_id on public.products
  for each row execute function public.products_images_guard();

-- ============================================================
-- 9. SEMILLA DE TIERS PARA LAS 3 TIENDAS DE PRUEBA
--    Store 1 conserva su catalogo: Empresario.
--    Stores 2 y 3 arrancan en Pequeno Emprendimiento.
-- ============================================================
update public.stores
   set subscription_tier = 'empresarial'
 where id = 1
   and subscription_tier = 'free';

update public.stores
   set subscription_tier = 'basico'
 where id in (2, 3)
   and subscription_tier = 'free';

-- ============================================================
-- 10. VERIFICACION
-- ============================================================
select st.id,
       st.slug,
       st.name,
       st.active,
       st.subscription_tier,
       coalesce(st.ox1_blocked, false) as ox1_blocked,
       public.store_is_open(st.id) as open,
       public.store_plan_limits(st.subscription_tier) as limits
  from public.stores st
 order by st.id;
