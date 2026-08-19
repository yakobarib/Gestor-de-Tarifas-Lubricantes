# ADR 0047 — Referencias inexistentes: descartar al importar y borrar si ya estaban

**Fecha:** 2026-08-17
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Del lote de referencias pendientes de AD Parts (patrón "CC [litros]l. [porcentaje]% [color]"),
Yako revisó el catálogo real y confirma que `ADP11505`, `ADP16403`, `ADP16502` y
`ADP16503` **no existen como producto** — la tarifa del proveedor las trae, pero son un
error de origen (probablemente arrastre de una referencia retirada o mal codificada).
`ADP12302`, del mismo lote, sí es real (y ya se incorporó al maestro en el ADR 0046, con
el texto de refrigerantes corregido — "AD" añadido y el typo "REFRIGEANTE" resuelto en
las 37 entradas existentes de ese mismo Excel).

Como estas referencias nunca llegaron a estar en `MasterDescriptions` (por eso salían
"pendientes"), no había nada que "borrar del maestro" en sentido literal — lo que sí hay
son filas reales, ya importadas de la tarifa de AD Parts, guardadas en `MasterDB`
(IndexedDB, en el navegador de Yako). Al no tener acceso a ese navegador desde aquí, la
única forma de que "se borren" es que la propia app lo haga sola.

## Decisión

- `MasterDescriptions.INVALID_REFS` (nuevo): lista de referencias, por marca, confirmadas
  como inexistentes — hoy solo `ad_parts_aceite: ['ADP11505', 'ADP16403', 'ADP16502',
  'ADP16503']`. `isInvalidRef(brandId, ref)` la consulta.
- `MasterDB.putRows()` descarta esas referencias ANTES de guardarlas — si la tarifa del
  proveedor las vuelve a traer en una futura importación, ni siquiera llegan a
  persistirse (no se resuelve como "pendiente de validar", sencillamente no existe en la
  app).
- Para las que ya estaban importadas de antes (el caso real de Yako): `Migration.run()`
  reutiliza el mecanismo de versión del ADR 0046 (`MasterDescriptions.VERSION`, ahora en
  `4`) — al detectar una versión nueva, además de reaplicar el maestro, recorre TODAS las
  filas guardadas y borra (`MasterDB.deleteRow`, nuevo) las que coincidan con
  `INVALID_REFS`. Es autom ático: no requiere que Yako haga nada, se limpia sola la
  próxima vez que abra la app.

## Verificación

Simulado un navegador con `applied_master_version: 3` (todavía sin el borrado) y dos
filas ya importadas: `ADP16403` (inválida) y `ADP12302` (válida, con texto viejo). Tras
recargar: `ADP16403` desaparece de `MasterDB` (`getByRef` devuelve `null`);
`ADP12302` se actualiza con la descripción/litros correctos del maestro y queda
`descVerified: true`. Probado también que una importación NUEVA con `ADP16502`
(inválida) nunca llega a guardarse, mientras una referencia normal sí. Consola sin
errores en ambas pruebas.

## Consecuencias

- `js/data/master-descriptions.js`: `INVALID_REFS`, `isInvalidRef()`, `VERSION` a `4`.
- `js/core/db.js`: `putRows()` descarta referencias inválidas; nuevo `deleteRow()`.
- `js/core/migration.js`: `applyMasterDescriptions()` borra las inválidas ya importadas,
  además de reaplicar el maestro (mismo paso, misma comparación de versión).

## Referencias

- `js/data/master-descriptions.js`, `js/core/db.js`, `js/core/migration.js`.
- [ADR 0046](0046-lote-refrigerantes-quimicos-y-version-maestro.md) (maestro versionado,
  mecanismo que este ADR reutiliza).
