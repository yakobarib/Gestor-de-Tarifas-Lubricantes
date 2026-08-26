# ADR 0062 — Reglas de márgenes compartidas en Neon (Fase 2 de 3)

**Fecha:** 2026-08-26
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Continuación de [ADR 0061](0061-tarifas-importadas-compartidas.md) (Fase 1: tarifas
importadas compartidas) — Albert, Ernesto y Nuria necesitan también ver los mismos
márgenes/reglas de precio que Yako ya tiene configurados, sin tener que rehacerlos cada
uno en su propio ordenador. Hasta ahora cada config vivía solo en `localStorage`
(`config_${brandId}[_${gama}]`), con la clave y el acceso duplicados sin compartir código
en `screen-rules.js`, `screen-export.js` y `screen-compare.js`.

## Decisión

Nueva tabla `pricing_rules(brand_id, gama, config jsonb, updated_by, updated_at,
created_at, primary key (brand_id, gama))` — un blob JSON por marca/gama, espejo exacto de
lo que ya vivía en `localStorage`. A diferencia de las tarifas importadas (Fase 1), aquí
**no hace falta merge parcial por columna** — guardar una regla ya era "reescribir el
documento entero" (`priceLevels` con sus dos niveles, PVP y Netos Bonus, con
`manualOverride` de PVP anidado dentro), así que el upsert manda el blob completo cada vez,
igual que antes se sobreescribía entero en `localStorage`. Misma RLS de lista blanca que
las otras dos tablas — y esta vez sin el error de "anon" (ya se sabía que este proyecto usa
otros nombres de rol) ni el privilegio DELETE de más (revocado explícitamente desde el
principio, lección de la Fase 1).

Nuevo `js/core/rules-store.js` sustituye las 3 copias sueltas de
`configKeyFor`/`Storage.get`/`Storage.set`:
- `load(brandId, gama)` — síncrono contra `Storage` (localStorage), sin cambios de
  comportamiento para quien llama — las 3 pantallas leen/escriben reglas muchas veces por
  render, no pueden depender de una llamada async.
- `save(brandId, gama, cfg)` — escribe en local al instante (se ve ya) y empuja a Neon en
  segundo plano; si falla, solo avisa con un toast — un margen que tarde en llegar a los
  demás no es tan grave como para bloquear la edición (a diferencia de guardar una
  validación de descripción, ADR 0054, que si falla no se aplica ni en local).
- `refresh()` — al arrancar, vuelca en `Storage` lo que el equipo tenga en Neon bajo las
  mismas claves `config_*` de siempre. Degrada con gracia si Neon no responde.

`js/core/neon-rules.js` (mismo patrón que `neon-master.js`/`neon-tariffs.js`):
`fetchAll()` paginado, `upsert(brandId, gama, config)`.

Migración de una sola vez (`Migration.pushLocalRulesToNeonOnce`, flag
`migrated_v7_push_local_rules_to_neon`): sube las reglas que Yako ya tuviera configuradas
antes de que existiera esta tabla — se ejecuta ANTES de `RulesStore.refresh()`, mismo orden
que la migración equivalente de tarifas (Fase 1), para no pisar lo local con un Neon aún
vacío la primera vez. Las claves `config_${brandId}[_${gama}]` no se pueden trocear a
ciegas (los IDs de marca ya llevan guión bajo, ej. `ad_parts_aceite`) — se resuelven contra
la lista real de `BRANDS`.

**"Todas las gamas"** se queda igual que siempre — fan-out client-side (N escrituras, una
por gama real de la marca), cada una ahora también sincroniza por separado con
`RulesStore.save`.

## Ficheros

**Crear:** `js/core/neon-rules.js`, `js/core/rules-store.js`,
`Archivo Maestro/_sql_carga_neon/schema_pricing_rules.sql`.
**Modificar:** `app/index.html` (2 script tags), `js/core/migration.js`
(`pushLocalRulesToNeonOnce`), `js/app.js` (llamada + `RulesStore.refresh()` en
`finishBoot`), `js/screens/screen-rules.js`/`screen-export.js`/`screen-compare.js` (su
`configKeyFor`/`Storage.get`/`Storage.set` local sustituido por `RulesStore`).
**Sin cambios:** `js/core/pricing.js` (sigue recibiendo el mismo objeto de nivel de
siempre, no le importa de dónde salió), `js/core/storage.js`.

## Verificación

- `node --check` sobre los ficheros nuevos/modificados.
- Tabla creada y verificada directamente contra Neon (acceso autorizado por Yako, ver
  memoria `neon_direct_db_access`): RLS activa, política correcta, sin DELETE de más para
  `authenticated`, trigger de `updated_at` en su sitio.
- Pendiente de probar en la app real: cambiar un margen en Reglas y confirmar en Neon que
  el blob llega actualizado; recargar (o desde otra cuenta) y confirmar que se ve el cambio
  sin haberlo tocado en ese dispositivo.

## Referencias

- ADR 0054 (maestro compartido en Neon — patrón original).
- ADR 0061 (Fase 1 — tarifas importadas compartidas).
- Plan completo (Fases 1/2/3): `C:\Users\RIB\.claude\plans\playful-crafting-snail.md`.
