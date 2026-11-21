-- ============================================================
--  08. CREAR TIENDAS 002 Y 003 (idempotente)
--  Ejecutar DESPUES de 07_ox1_integration.sql.
--
--  Crea las tiendas vacias copiando configuracion, temas,
--  navegacion y armador de la tienda 1. NO copia productos.
--  Luego las deja en plan basico.
--
--  Incluye la funcion create_store() por si el proyecto no
--  ejecuto store_lifecycle.sql. NO ejecutes store_lifecycle.sql
--  completo despues de 07: sobrescribe store_public_status().
-- ============================================================

create or replace function public.create_store(
  p_slug   text,
  p_name   text,
  p_source bigint default 1
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_slot record;
  v_new_slot bigint;
  v_group record;
  v_new_group bigint;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,40}$' then
    raise exception 'Slug no valido';
  end if;
  if p_name is null or btrim(p_name) = '' or length(p_name) > 80 then
    raise exception 'Nombre no valido';
  end if;

  if auth.uid() is not null and not public.is_owner_of(p_source) then
    raise exception 'Solo el propietario puede crear tiendas';
  end if;

  if exists (select 1 from public.stores where slug = p_slug) then
    raise exception 'Ya existe una tienda con ese slug';
  end if;

  insert into public.stores (slug, name) values (p_slug, btrim(p_name))
  returning id into v_id;

  insert into public.settings (store_id, data)
  select v_id,
         jsonb_set(
           jsonb_set(coalesce(data, '{}'::jsonb), '{store,name}', to_jsonb(btrim(p_name)), true),
           '{store,open}', 'true'::jsonb, true
         )
    from public.settings where store_id = p_source;

  if not found then
    insert into public.settings (store_id, data)
    values (v_id, jsonb_build_object(
      'store', jsonb_build_object(
        'name', btrim(p_name), 'open', true,
        'closedMessage', 'La tienda esta cerrada en este momento'
      )
    ));
  end if;

  insert into public.themes (store_id, key, label, colors, decorations, is_active)
  select v_id, key, label, colors, decorations, is_active
    from public.themes where store_id = p_source;

  for v_group in select * from public.nav_groups where store_id = p_source order by position, id loop
    insert into public.nav_groups (store_id, name, icon, position, hidden)
    values (v_id, v_group.name, v_group.icon, v_group.position, v_group.hidden)
    returning id into v_new_group;
    insert into public.nav_items (store_id, group_id, name, position)
    select v_id, v_new_group, name, position from public.nav_items where group_id = v_group.id order by position, id;
  end loop;

  for v_slot in select * from public.builder_slots where store_id = p_source order by position, id loop
    insert into public.builder_slots (store_id, key, name, label, icon, position)
    values (v_id, v_slot.key, v_slot.name, v_slot.label, v_slot.icon, v_slot.position)
    returning id into v_new_slot;
    insert into public.builder_parts (store_id, slot_id, name, short, price, image, position)
    select v_id, v_new_slot, name, short, price, image, position
      from public.builder_parts where slot_id = v_slot.id order by position, id;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.create_store(text,text,bigint) from public, anon, authenticated;
grant execute on function public.create_store(text,text,bigint) to service_role;

do $$
begin
  if not exists (select 1 from public.stores where slug = 'tienda-002') then
    perform public.create_store('tienda-002', 'WhatShop Demo 2', 1);
  end if;

  if not exists (select 1 from public.stores where slug = 'tienda-003') then
    perform public.create_store('tienda-003', 'WhatShop Demo 3', 1);
  end if;
end $$;

update public.stores
   set name = 'WhatShop Demo 2'
 where slug = 'tienda-002';

update public.stores
   set name = 'WhatShop Demo 3'
 where slug = 'tienda-003';

update public.stores
   set subscription_tier = 'basico'
 where slug in ('tienda-002', 'tienda-003')
   and subscription_tier = 'free';

-- Verificacion
select st.id,
       st.slug,
       st.name,
       st.active,
       st.subscription_tier,
       coalesce(st.ox1_blocked, false) as ox1_blocked,
       public.store_is_open(st.id) as open,
       public.store_plan_limits(st.subscription_tier) as limits
  from public.stores st
 where st.slug in ('maniaworld', 'tienda-002', 'tienda-003')
 order by st.id;
