# ADR 0049 — Los alias de Castrol ("Sustituye a") heredan la verificación

**Fecha:** 2026-08-19
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako reporta que Shell sale perfecto (0 pendientes) pero Castrol muestra muchas
referencias "sin verificar" que sí están en su Excel de descripciones validadas — sospecha
un fallo general del maestro.

Investigado a fondo: **no es un fallo del maestro**. Es un comportamiento de
`profile-castrol.js` que ya existía desde antes (ver su comentario "Sustituye a") —
cuando Castrol renombra un código de producto, la tarifa trae AMBOS: el código nuevo y,
en la columna "Sustituye a", el código antiguo. Por decisión explícita de Yako en su
momento ("no eliminar la antigua, para no romper Turfview"), el perfil duplica la fila
bajo el código antiguo además de crearla bajo el nuevo.

El problema: el código antiguo, por definición, **nunca va a estar en el maestro de
descripciones** (está retirado) — así que esa fila duplicada se quedaba "pendiente de
validar" para siempre, aunque el producto real (bajo su código nuevo) ya estuviera
perfectamente verificado. Comprobado en la tarifa real de julio 2026: 78 filas de este
tipo en toda la tarifa Castrol, 18 de ellas justo en la gama "Other" — el mismo número
que Yako veía como "pendientes" en esa gama. Shell no tiene este mecanismo de
duplicación, por eso no le pasa.

## Decisión

- `profile-castrol.js`: la fila duplicada bajo el código antiguo lleva ahora un campo
  `_aliasOf` apuntando al código nuevo (`row.ref`) — no se guarda en el maestro, solo lo
  lee `MasterDB.putRows()` al procesar el lote.
- `MasterDB.putRows()`: antes de guardar nada, resuelve la verificación de **todo el
  lote** de una vez (no fila a fila) — si una referencia no tiene verificación propia
  pero tiene `_aliasOf` y esa otra referencia SÍ está verificada (de fábrica, o corregida
  a mano), hereda esa misma descripción/litros y queda `descVerified: true`. Si el código
  nuevo tampoco está verificado, el alias se queda igual de pendiente — no se falsea nada.
- Solo Castrol tiene este patrón hoy (comprobado: Repsol tiene su propio rebranding, pero
  sustituye la referencia en vez de duplicarla, así que no le afecta este problema).

## Verificación

Simulado el caso real (`CAT16081A`, verificado de fábrica, junto a su alias `CAT1503AA`
en el mismo lote): el alias queda `descVerified: true` con la misma descripción exacta
("HIGH TEMPERATURE GREASE 18KG"), sin estar él mismo en el maestro. Caso de control (un
alias de una referencia que TAMPOCO está verificada): se queda correctamente sin
verificar, sin falsos positivos. Consola sin errores.

**Importante**: esto no es retroactivo solo. Las filas de Castrol que Yako ya tenía
importadas en su navegador se guardaron ANTES de este cambio, sin el dato `_aliasOf`
(nunca se persiste) — para que se corrijan hace falta **reimportar la tarifa Castrol**
una vez (la migración de fondo no puede reconstruir sola qué código sustituye a cuál,
solo el Excel original lo sabe).

## Consecuencias

- `js/profiles/profile-castrol.js`: `_aliasOf` en la fila duplicada.
- `js/core/db.js`: `putRows()` resuelve la verificación de todo el lote antes de guardar,
  con herencia por `_aliasOf`.

## Referencias

- `js/profiles/profile-castrol.js`, `js/core/db.js`.
- [ADR 0043](0043-maestro-de-descripciones-verificadas.md) (maestro de descripciones,
  base de este ADR).
