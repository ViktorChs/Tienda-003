-- ============================================================
--  CREDENCIALES VISIBLES PARA EL PROPIETARIO
--  Ejecutar DESPUES de schema.sql, multistore.sql y security.sql.
--
--  ADVERTENCIA: guarda la contrasena en texto plano para que el
--  propietario pueda verla desde el panel. Cualquier persona con
--  acceso de owner a esa tienda podra leerla. No uses contrasenas
--  que reutilices en otros servicios.
--
--  - admin_credentials: una fila por administrador.
--  - El owner de la tienda puede leer/gestionar todas las de su tienda.
--  - Cada admin puede leer/actualizar su propia fila (para sincronizar
--    cuando cambie su contrasena desde "Mi cuenta").
-- ============================================================

create table if not exists public.admin_credentials (
  admin_id   uuid primary key references public.admins(id) on delete cascade,
  store_id   bigint not null references public.stores(id) on delete cascade,
  email      text,
  password   text not null,
  updated_at timestamptz not null default now()
);

create index if not exists admin_credentials_store_idx
  on public.admin_credentials (store_id);

alter table public.admin_credentials enable row level security;

drop policy if exists "credentials owner" on public.admin_credentials;
drop policy if exists "credentials self read" on public.admin_credentials;
drop policy if exists "credentials self insert" on public.admin_credentials;
drop policy if exists "credentials self update" on public.admin_credentials;

create policy "credentials owner" on public.admin_credentials for all to authenticated
  using (public.is_owner_of(store_id))
  with check (
    public.is_owner_of(store_id)
    and exists (
      select 1 from public.admins a
       where a.id = admin_credentials.admin_id
         and a.store_id = admin_credentials.store_id
    )
  );

create policy "credentials self read" on public.admin_credentials for select to authenticated
  using (admin_id = auth.uid());

create policy "credentials self insert" on public.admin_credentials for insert to authenticated
  with check (
    admin_id = auth.uid()
    and exists (
      select 1 from public.admins a
       where a.id = auth.uid()
         and a.store_id = admin_credentials.store_id
    )
  );

create policy "credentials self update" on public.admin_credentials for update to authenticated
  using (admin_id = auth.uid())
  with check (
    admin_id = auth.uid()
    and exists (
      select 1 from public.admins a
       where a.id = auth.uid()
         and a.store_id = admin_credentials.store_id
    )
  );

grant select, insert, update, delete on public.admin_credentials to authenticated;

-- Verificacion (opcional)
select a.id, a.name, a.role, a.store_id, c.email,
       case when c.password is null then 'sin credencial guardada' else 'con credencial' end as estado
  from public.admins a
  left join public.admin_credentials c on c.admin_id = a.id
 order by a.store_id, a.created_at;
