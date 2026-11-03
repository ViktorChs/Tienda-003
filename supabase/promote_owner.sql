-- ============================================================
--  promote_owner.sql  -  Enlaza un usuario de Supabase Auth
--  como ADMIN OWNER del panel.
-- ============================================================
--  PASOS:
--   1) Supabase -> Authentication -> Users -> Add user
--        email:    admin@gigahertzstore.com
--        password: <tu-contrasena-segura>
--      (marca "Auto Confirm User" para poder entrar sin correo)
--   2) Ejecuta este archivo en el SQL Editor.
--
--  Si usas OTRO email, cambia 'admin@gigahertzstore.com' abajo.
--  Idempotente: puedes correrlo varias veces.
-- ============================================================

insert into public.admins (id, name, username, role, active)
select u.id, 'Administrador', 'admin', 'owner', true
from auth.users u
where lower(u.email) = lower('admin@gigahertzstore.com')
on conflict (id) do update
  set role = 'owner', active = true;

-- Verificacion rapida (debe devolver 1 fila)
select a.id, a.name, a.username, a.role, a.active, u.email
from public.admins a
join auth.users u on u.id = a.id;
