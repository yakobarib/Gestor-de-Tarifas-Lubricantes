# ADR 0057 — Racing Oil: quitar espacios sueltos del ref al importar

**Fecha:** 2026-08-24
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Al comprobar el arreglo de prefijos (ADR 0056), Racing Oil salió con el 100% de sus
689 referencias "pendientes de validar" — mismo síntoma que tuvo Castrol, pero causa
distinta: el ref que trae la tarifa real incluye espacios sueltos en medio (ej.
`"1 0002 0001C2"`), mientras que el maestro (y el propio catálogo de Racing Oil, según
confirma Yako: "en general nunca jamás hay espacios entre las referencias") no los
lleva. `profile-racing-oil.js` solo hacía `String(ref).trim()` — quita espacios de los
extremos, no los del medio.

## Decisión

`readGamaSheet()` y `readSpecialPrices()` (`profile-racing-oil.js`) quitan ahora
**todos** los espacios del ref, no solo los de los extremos
(`String(ref).replace(/\s+/g, '').trim()`) — los espacios internos son un artefacto de
cómo Excel/la librería de lectura devuelve esa celda, no parte real del código.

## Verificación

`node --check` sobre `profile-racing-oil.js`. Confirmado con datos reales de la tarifa
de origen (`Base de Conocimiento/Tarifas Actualizadas/Racing Oil/`): el ref crudo trae
espacios de verdad en la celda (ej. `"1 0373 0001"`, no un artefacto de formato) — el
arreglo lo deja en `"10373001"`, que sí coincide con el maestro.

## Addendum (2026-08-24) — limpieza automática de filas huérfanas

Al reimportar, las 689 filas ya guardadas con espacios no se fusionaban con las 689
nuevas (sin espacios) — mismo patrón que ADR 0056 (`putRows` funde por `id`, que cambia
al cambiar el `ref`), duplicando el total a 1378. Se añade otra migración de una vez en
`migration.js` (`removeStaleSpacedRacingOilRows`, flag
`migrated_v5_remove_stale_spaced_racing_oil_refs`) que borra, en el próximo arranque de
cada usuario, cualquier fila de `racing_oil` cuyo `ref` contenga un espacio.

## Referencias

- ADR 0056 (mismo síntoma — 100% pendiente — pero causa distinta).
- `js/profiles/profile-racing-oil.js`.
