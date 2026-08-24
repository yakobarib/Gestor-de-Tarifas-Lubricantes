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

`node --check` sobre `profile-racing-oil.js`. Pendiente de confirmar con Yako tras
reimportar: el número de referencias pendientes debería bajar de 689 a algo mucho más
pequeño (las genuinamente nuevas, si las hay).

## Referencias

- ADR 0056 (mismo síntoma — 100% pendiente — pero causa distinta).
- `js/profiles/profile-racing-oil.js`.
