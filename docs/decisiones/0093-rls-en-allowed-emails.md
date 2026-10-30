# ADR 0093 — RLS en `allowed_emails`

**Fecha:** 2026-10-30
**Estado:** Aplicada y verificada en Neon
**Decidido por:** Yako (aviso de Neon: "allowed_emails has RLS disabled")

Cualquier usuario con sesión podía leer la lista completa de emails autorizados. Se activó RLS
con una política de lectura `own_row_select` (cada usuario ve solo su fila) y se quitó la
escritura a `authenticated` (solo SELECT). Las políticas de las demás tablas
(`email in (select email from allowed_emails)`) siguen funcionando porque cada usuario ve su
propia fila. La lista se gestiona con el rol propietario (SQL Editor/CLI). SQL:
`docs/sql/0093-allowed-emails-rls.sql`. Verificado con conexión directa: RLS activo, política
presente, `authenticated` solo con SELECT; Yako confirmó que sigue entrando en la app.
