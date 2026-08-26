# ADR 0063 — Equivalencias compartidas en Neon (Fase 3 de 3)

**Fecha:** 2026-08-26
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Última fase de "extender lo compartido en Neon" (ver [ADR 0061](0061-tarifas-importadas-compartidas.md)
y [ADR 0062](0062-reglas-margenes-compartidas.md)) — el fichero de equivalencias entre
marcas (`EquivalenceIndex`, usado por la pantalla Comparación) vivía solo en
`localStorage` del navegador de quien lo hubiera subido, así que en un ordenador nuevo la
Comparación no encontraba nada hasta que alguien volviera a subir los 5 Excel.

A diferencia de tarifas (por marca/gama/ref) y reglas (por marca/gama), este dataset es
**uno solo para toda la app** — un único índice combinado de las 5 categorías de
equivalencias, semi-estático (Yako lo sube de vez en cuando, no cada sesión).

## Decisión

Nueva tabla `equivalences` — una única fila (`id = 'singleton'`) con el mismo JSON que ya
se guardaba en `localStorage` (`{groups, refToGroup, builtAt}`). Misma RLS de lista blanca
que las otras tres tablas, sin DELETE de más desde el principio.

`js/core/neon-equivalences.js` (mismo patrón que las otras `neon-*.js`): `fetch()`
devuelve el JSON guardado o `null` si nadie lo ha subido nunca; `upsert(data)` lo
sobrescribe entero (como ya hacía `localStorage`, sin merge parcial — no hace falta,
subir el fichero siempre reemplaza el índice completo).

`EquivalenceIndex.build()` (ya existente, único punto de entrada — la pantalla Comparación
dejó de tener su propio uploader hace tiempo, solo queda el de Importación) ahora también
empuja el índice recién construido a Neon tras guardarlo en local — mismo patrón "local al
instante + Neon en segundo plano, avisa si falla" que Reglas (Fase 2). Nueva
`EquivalenceIndex.refresh()` hidrata `Storage` desde Neon al arrancar.

Migración de una sola vez (`Migration.pushLocalEquivalencesToNeonOnce`, flag
`migrated_v8_push_local_equivalences_to_neon`): si este ordenador ya tenía equivalencias
cargadas, las sube antes de que `refresh()` traiga lo de Neon (mismo orden que las otras
dos migraciones, para no pisar lo local con un Neon aún vacío la primera vez). Si nunca se
subió nada en este navegador, no hay nada que subir — no es un error.

## Ficheros

**Crear:** `js/core/neon-equivalences.js`,
`Archivo Maestro/_sql_carga_neon/schema_equivalences.sql`.
**Modificar:** `app/index.html` (script tag), `js/comparison/equivalence-index.js`
(`build()` empuja a Neon, nueva `refresh()`), `js/core/migration.js`
(`pushLocalEquivalencesToNeonOnce`), `js/app.js` (llamada + `EquivalenceIndex.refresh()`
en `finishBoot`).
**Sin cambios:** `js/comparison/equivalence-reader.js`, `js/screens/screen-import.js`
(sigue llamando a `EquivalenceIndex.build(categories)` igual que siempre),
`js/screens/screen-compare.js` (solo lee, `isLoaded()`/`findEquivalents()`, sin cambios).

## Verificación

- `node --check` sobre los ficheros nuevos/modificados.
- Tabla creada y verificada directamente contra Neon (RLS, política, sin DELETE de más,
  trigger de `updated_at`); Data API refrescada por CLI (`neon data-api refresh-schema`,
  lección de la Fase 2) antes de dar la tabla por lista.
- Pendiente de probar en la app real: subir los 5 Excel de equivalencias en Importación,
  confirmar en Neon que la fila `singleton` llega con el índice; recargar (o desde otra
  cuenta) y confirmar que Comparación encuentra equivalencias sin haber subido nada en ese
  dispositivo.

## Referencias

- ADR 0054 (maestro compartido en Neon — patrón original).
- ADR 0061 (Fase 1 — tarifas importadas compartidas).
- ADR 0062 (Fase 2 — reglas de márgenes compartidas).
- Plan completo (Fases 1/2/3): `C:\Users\RIB\.claude\plans\playful-crafting-snail.md`.
