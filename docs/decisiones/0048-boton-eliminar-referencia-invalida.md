# ADR 0048 — Botón "Eliminar" para referencias inexistentes en el panel de validación

**Fecha:** 2026-08-17
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras el ADR 0047, Yako sigue encontrando referencias de AD Parts que no existen como
producto real (patrón "CC [litros]l. [porcentaje]% [color]") y, en vez de pedírmelo caso
a caso, quiere un botón "Eliminar" en el propio panel de validación que borre del
maestro toda huella de la referencia. De paso confirma la 6ª pendiente que faltaba
identificar: `ADP16508`, también inexistente.

## Decisión

- **Botón "Eliminar"** junto a "Guardar" en cada fila del modal de validación (tanto en
  Pendientes como en Ya validadas) — con confirmación (`confirm()`, acción destructiva
  sobre datos reales ya importados).
- Al confirmar:
  1. `MasterDB.deleteRow(brandId, gama, ref)` (nuevo) borra la fila de IndexedDB — la
     referencia desaparece de verdad de la tarifa, no solo de la lista de pendientes.
  2. `LocalInvalidRefs.add(brandId, ref)` (nuevo módulo, mismo patrón que
     `DescriptionOverrides`: vive en `localStorage`, no en el maestro de fábrica) marca
     la referencia como descartada — `MasterDB.putRows()` la ignora en cualquier
     importación futura, en este navegador, aunque la tarifa del proveedor la siga
     trayendo.
  3. `DescriptionOverrides.remove()` (nuevo) limpia cualquier corrección que hubiera
     quedado guardada para esa ref, ya no aplica a nada.
- El aviso persistente de "correcciones sin incorporar" pasa a sumar también
  `LocalInvalidRefs.countAll()` — un descarte hecho en el panel es, igual que una
  corrección de descripción, algo que solo vive en ese navegador hasta que se incorpore
  a `MasterDescriptions.INVALID_REFS` (fábrica) y se suba.
- Se añade `ADP16508` a `INVALID_REFS` (`VERSION` a `5`) — la 6ª referencia confirmada,
  ya incorporada de fábrica en vez de quedar solo como descarte local.
- **Maquetado**: la fila del modal gana una columna más (6 en vez de 5) — el modal pasa
  de 1180px a 1340px de ancho máximo para que no se amontonen los campos.

## Verificación

Fila de prueba `ADP99977` ("CC 600l. 60% lila"): al pulsar "Eliminar" y confirmar,
`MasterDB.getByRef` devuelve `null` (borrada de verdad), `LocalInvalidRefs.has()` pasa a
`true`, y desaparece de la lista del modal. Reimportar la misma referencia después
confirma que se descarta silenciosamente (`putRows` no la vuelve a guardar). Aviso
persistente pasa a "1 corrección/descarte guardado solo en este navegador". Ancho de
fila comprobado por posición real: los dos botones caben dentro del ancho de la fila sin
solaparse ni desbordar. Consola sin errores en todas las pruebas.

## Consecuencias

- `js/core/local-invalid-refs.js` (nuevo módulo).
- `js/core/db.js`: `putRows()` también descarta por `LocalInvalidRefs`; nuevo
  `deleteRow()` (ya usado por la migración del ADR 0047, ahora también por este botón).
- `js/core/description-overrides.js`: nuevo `remove()`.
- `js/screens/screen-tarifas.js`: botón y `discardDescValidation()`.
- `js/data/master-descriptions.js`: `ADP16508` añadida a `INVALID_REFS`, `VERSION` a `5`.
- `app/css/styles.css`: modal y fila más anchos, estilo del botón "Eliminar" (rojizo
  pastel, para distinguirlo de "Guardar").

## Referencias

- `js/core/local-invalid-refs.js`, `js/core/db.js`, `js/core/description-overrides.js`,
  `js/screens/screen-tarifas.js`, `js/data/master-descriptions.js`.
- [ADR 0047](0047-referencias-invalidas-descartadas.md) (lista de fábrica que este ADR
  complementa con la vía local/self-service).
