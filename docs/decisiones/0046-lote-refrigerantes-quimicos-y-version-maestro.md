# ADR 0046 — Segundo lote de descripciones verificadas y maestro versionado

**Fecha:** 2026-08-17
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako, en vez de validar una a una las referencias pendientes de AD Parts en el panel de
Tarifas, prefiere seguir ampliando el maestro por lotes: entrega un nuevo Excel
("Referencias Descripciones Litros AD Parts Refrigerantes Y Quimicos 2026-06.xlsx", 82
filas) con refrigerantes y otros químicos de AD Parts que le faltaban al maestro
original del ADR 0043.

Al comparar contra el maestro ya incrustado, 2 referencias (`ADP20005`, `ADP22005`)
coincidían con productos YA existentes pero completamente distintos ("DEX-ATF 5L"/"SDI
5W40 5L" vs "REFRIGERANTE CONCENTRADO UNIVERSAL OCRE"). Yako confirma, tras revisar a
mano ambos archivos y el catálogo real de AD Parts, que es un error de fábrica de AD
Parts (la misma referencia se ha usado para dos productos distintos en algún momento) —
decide eliminar las dos filas de refrigerante concentrado de su Excel (poco usado) en
vez de tocar las ya existentes.

## Decisión

- Las 80 referencias limpias (sin las 2 conflictivas, ya retiradas por Yako del Excel)
  se añaden a `DATA.ad_parts_aceite` en `master-descriptions.js` — mismo proceso del
  ADR 0043 (conversión a JS, sin fetch externo). `ADP20005`/`ADP22005` quedan como
  estaban (`DEX-ATF 5L`/`SDI 5W40 5L`), sin tocar.
- **Maestro versionado, no un flag de una sola vez**: hasta ahora, la migración que
  reaplica el maestro a filas ya importadas (`migrated_v3_apply_master_descriptions`,
  ADR 0043) corría una única vez para siempre — un lote nuevo como este no se habría
  aplicado a filas ya importadas hasta que Yako reimportara esa tarifa. Se sustituye por
  un número de versión: `MasterDescriptions.VERSION` (ahora en `2`, subía de un `1`
  implícito) se compara contra `applied_master_version` guardado en el navegador; si el
  guardado es menor, se reaplica el maestro completo a todo lo ya importado y se
  actualiza el número guardado. Cada lote nuevo que se incorpore en el futuro solo tiene
  que subir `VERSION` para que se reaplique solo, sin depender de reimportar nada.

## Verificación

Las 80 filas del Excel (ya editado por Yako) coinciden exactamente, referencia a
referencia, con lo ya incorporado al maestro — ninguna falta, ninguna con valores
distintos. Simulado un navegador con la migración antigua ya corrida
(`migrated_v3_apply_master_descriptions: true`) pero sin `applied_master_version`: al
cargar, `MasterDB.getAll()` se reaplica igualmente (versión guardada 0 < `VERSION` 2),
una fila de prueba de "ADP10301" con texto viejo del proveedor queda con la descripción
y litros del maestro nuevo (`descVerified: true`). Recargar una segunda vez no repite el
trabajo (versión guardada ya al día). Consola sin errores en ambas pruebas.

## Consecuencias

- `js/data/master-descriptions.js`: `ad_parts_aceite` pasa de 275 a 355 referencias;
  nuevo `VERSION` exportado.
- `js/core/migration.js`: el paso de reaplicar el maestro pasa de flag fijo a
  comparación de versión — futuros lotes solo necesitan subir `VERSION` en
  `master-descriptions.js`.

## Referencias

- `js/data/master-descriptions.js`, `js/core/migration.js`.
- [ADR 0043](0043-maestro-de-descripciones-verificadas.md) (maestro original y
  migración de una vez, ahora versionada por este ADR).
