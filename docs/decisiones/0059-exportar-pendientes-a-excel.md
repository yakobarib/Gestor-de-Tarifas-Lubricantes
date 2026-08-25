# ADR 0059 — Exportar referencias pendientes de validar a Excel

**Fecha:** 2026-08-25
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Con el maestro compartido en Neon (ADR 0054), Yako ya no depende de mí para incorporar
correcciones — pero para lotes grandes de referencias pendientes (ej. 81 en Castrol),
validarlas una a una en el panel de Tarifas es lento. Yako pide poder exportarlas a
Excel, corregirlas con calma (como ya hace con las plantillas "Maestro {Marca}.xlsx"), y
cargarlas de vuelta al maestro con el flujo SQL ya establecido.

## Decisión

Nuevo botón "Exportar pendientes a Excel" en el modal de validación de Tarifas — genera
un `.xlsx` con el mismo formato que las plantillas "Maestro {Marca}.xlsx"
(REFERENCIA/DESCRIPCION/LITROS/NOTAS), relleno con la descripción cruda del proveedor y
los litros detectados como punto de partida (no como respuesta ya verificada). Yako lo
corrige con el mismo criterio de siempre y me lo pasa para regenerar el SQL de carga a
Neon — mismo flujo ya usado para la carga inicial de las 6 marcas.

`ExcelWriter.exportPendingValidation(rows, brandLabel)` (nuevo, en `excel-writer.js`,
reusa `downloadWorkbook`/`setColumns` ya existentes) — exporta siempre las pendientes de
la marca/gama actual (`pendingDescRows()`), sin importar qué pestaña del modal esté
activa.

## Verificación

Probado en vivo: exportar 2 referencias de prueba genera un `.xlsx` con las columnas y
filas correctas (descripción en mayúsculas, litros numéricos, NOTAS vacía) — confirmado
recargando el buffer generado con ExcelJS y leyendo las celdas de vuelta. `node --check`
sobre `excel-writer.js` y `screen-tarifas.js`.

## Referencias

- ADR 0043 (panel de validación original).
- ADR 0054 (maestro compartido en Neon).
- `js/export/excel-writer.js`, `js/screens/screen-tarifas.js`, `app/index.html`.
