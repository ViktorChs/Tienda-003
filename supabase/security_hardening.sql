-- ============================================================
--  security_hardening.sql  —  Endurecimiento extra del panel
--  Orden: schema.sql -> multistore.sql -> security.sql -> ESTE.
--  Idempotente. Ejecutar en Supabase -> SQL Editor.
--
--  Qué corrige:
--   1) admins: un editor ya NO puede tocar el perfil de otro usuario.
--      Solo su propia fila (id = auth.uid()) o el propietario de la tienda.
--   2) El alta de cuentas (INSERT en admins) queda SOLO para el owner.
--      Esto cierra cualquier intento de un usuario recién registrado de
--      darse de alta a sí mismo como admin.
--   3) Revoca EXECUTE innecesario a anon en helpers internos.
-- ============================================================

-- ============================================================
-- 1. admins: corta la edición cruzada entre editores.
--    multistore.sql dejó "admins write" = is_admin_of(store_id), que
--    permite a un editor modificar a otro editor de su tienda.
-- ============================================================
drop policy if exists "admins write" on public.admins;

-- UPDATE: solo mi propia fila o el owner.
drop policy if exists "admins update" on public.admins;
create policy "admins update" on public.admins for update to authenticated
  using (id = auth.uid() or public.is_owner_of(store_id))
  with check (id = auth.uid() or public.is_owner_of(store_id));

-- INSERT: solo el owner (el trigger admins_guard revalida rol/tienda).
drop policy if exists "admins insert" on public.admins;
create policy "admins insert" on public.admins for insert to authenticated
  with check (public.is_owner_of(store_id));

-- DELETE: solo el owner.
drop policy if exists "admins delete" on public.admins;
create policy "admins delete" on public.admins for delete to authenticated
  using (public.is_owner_of(store_id));

-- "admins read" (multistore.sql) queda igual: leo mi perfil o los de mi tienda.

-- ============================================================
-- 2. helpers internos: sin EXECUTE para anon
--    (is_admin_of SÍ queda accesible a anon: lo evalúan las policies
--     públicas de lectura; para anon siempre devuelve false).
-- ============================================================
revoke execute on function public.is_owner_of(bigint) from anon;

-- ============================================================
-- ENDURECER SUPABASE (desde el Dashboard — no es SQL):
--
--   Authentication > Rate Limits:
--     - "Sign-ups and sign-ins" (por IP): bajar de 30/5min a 10/5min.
--     - "Token endpoint" (por IP): bajar de 150/5min a 60/5min.
--
--   Authentication > Settings (Email):
--     - Activar "Leaked password protection" (HaveIBeenPwned).
--     - Activar CAPTCHA (Cloudflare Turnstile / hCaptcha).
--     - "JWT expiry": bajar de 3600 s a 1800 s (el panel renueva solo).
--
--   Authentication > Settings:
--     - Si NO creas usuarios desde el panel, DESACTIVA "Allow new users
--       to sign up". El registro abierto es la vía más usada para entrar.
--       (Si lo usas, déjalo activo: RLS ya impide que un extraño haga
--        algo con su cuenta.)
-- ============================================================
