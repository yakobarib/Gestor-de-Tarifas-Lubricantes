-- ADR 0093 — Activar RLS en `allowed_emails` sin bloquear a nadie.
-- Neon avisaba: "allowed_emails has RLS disabled. All authenticated users can view all rows".
-- Las políticas del resto de tablas hacen `email in (select email from allowed_emails)`; esa
-- subconsulta se evalúa con los permisos de quien consulta, así que ANTES de activar RLS hace
-- falta una política de lectura. Cada usuario ve solo SU fila (basta para que su pertenencia
-- a la lista se compruebe) y nadie puede modificar la lista desde la app. Todo en una
-- transacción: si algo falla, no queda nada a medias.
-- Ejecutar en el SQL Editor de Neon (rama production). Se gestiona la lista con el rol propietario
-- (SQL Editor / CLI), que no queda afectado por RLS.

begin;

drop policy if exists own_row_select on public.allowed_emails;
create policy own_row_select on public.allowed_emails
  for select to authenticated
  using (email = ((current_setting('request.jwt.claims'::text, true))::json ->> 'email'::text));

revoke insert, update, delete, truncate, references, trigger on public.allowed_emails from authenticated;
revoke all on public.allowed_emails from public;
grant select on public.allowed_emails to authenticated;

alter table public.allowed_emails enable row level security;

commit;

-- Comprobación (debe devolver relrowsecurity = true y la política own_row_select):
select relrowsecurity from pg_class where relname = 'allowed_emails';
select policyname, cmd from pg_policies where tablename = 'allowed_emails';

-- Si tras ejecutarlo alguien no pudiera entrar en la app (no debería), se deshace con:
--   alter table public.allowed_emails disable row level security;
