-- ADR 0092 — Rastro de cambios de reglas de margen ("quién cambió qué y cuándo").
-- Tabla SOLO DE AÑADIR: los usuarios autenticados de la lista blanca pueden insertar y leer,
-- pero NO modificar ni borrar — nadie puede reescribir el historial desde la app.
-- Mismo modelo de seguridad que `pricing_rules` (RLS por lista blanca `allowed_emails`).
--
-- Notas del proyecto (ver memoria neon_direct_db_access):
--  * Este proyecto Neon usa el rol `authenticated` (no existe `anon`): se revoca de `public`.
--  * El ACL por defecto del esquema concede a `authenticated` DML completo (incluido DELETE)
--    en toda tabla nueva — por eso se revoca TODO y se vuelve a conceder solo select+insert.
--  * Tras crear la tabla hay que refrescar la caché del Data API:
--      npx neon@latest data-api refresh-schema --project-id silent-field-02039340

create table if not exists public.pricing_rules_log (
  id               bigint generated always as identity primary key,
  changed_at       timestamptz not null default now(),
  brand_id         text        not null,
  gama             text        not null,   -- gama real, '__all__' (varias a la vez) o '__default_template__'
  changed_by_name  text        not null,   -- nombre escrito por quien hizo el cambio (diálogo obligatorio)
  changed_by_email text,                   -- email de la sesión (Neon Auth)
  summary          text        not null,   -- resumen legible, ej. "PVP · margen formato 1000 L: 15 → 20"
  changes          jsonb       not null default '[]'::jsonb  -- [{path, before, after}]
);

create index if not exists pricing_rules_log_changed_at_idx on public.pricing_rules_log (changed_at desc);
create index if not exists pricing_rules_log_brand_idx on public.pricing_rules_log (brand_id, changed_at desc);

alter table public.pricing_rules_log enable row level security;

revoke all on public.pricing_rules_log from public;
revoke all on public.pricing_rules_log from authenticated;
grant select, insert on public.pricing_rules_log to authenticated;

drop policy if exists allowlisted_users_select on public.pricing_rules_log;
create policy allowlisted_users_select on public.pricing_rules_log
  for select to authenticated
  using (((current_setting('request.jwt.claims'::text, true))::json ->> 'email'::text) in (select email from public.allowed_emails));

drop policy if exists allowlisted_users_insert on public.pricing_rules_log;
create policy allowlisted_users_insert on public.pricing_rules_log
  for insert to authenticated
  with check (((current_setting('request.jwt.claims'::text, true))::json ->> 'email'::text) in (select email from public.allowed_emails));
