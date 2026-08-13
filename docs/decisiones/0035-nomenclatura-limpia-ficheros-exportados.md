# ADR 0035 — Nomenclatura limpia y homogénea de los ficheros exportados

**Fecha:** 2026-08-13
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Los nombres de fichero heredados (`tarifa-skrit-adp-venta-2026-08-13.xlsx`,
`listado-neto-factura-rep-2026-08-13.xlsx`, `pvp-imprimir-adp-2026-08-13.pdf`…) usaban
kebab-case técnico, mezclaban el `abbr` interno de marca (ADP/REP/CAT/SHL/ENI/RAC) y no
seguían un patrón único entre tipos de exportación. Yako pide un formato limpio y
consistente para los siete tipos, con ejemplos exactos por marca:

```
Tarifa AD PVP Venta 13-08-2026
Tarifa Repsol PVP Venta 13-08-2026
Tarifa AD PVP SKRIT 13-08-2026
Tarifa Repsol PVP SKRIT 13-08-2026
Tarifa AD PVP Comerciales 13-08-2026        (PVP Imprimir, caso especial)
Tarifa AD Neto Bonus 13-08-2026
Tarifa Repsol Neto Bonus 13-08-2026
Tarifa AD Neto Factura 13-08-2026
Tarifa Repsol Neto Factura 13-08-2026
Tarifa AD Neto-Neto 13-08-2026
Tarifa Repsol Neto-Neto 13-08-2026
Tarifa AD Triple-Neto 13-08-2026
```

"Igual para todas las marcas" — sin guiones salvo en la fecha (`dd-mm-aaaa`) y en los dos
tipos que ya llevan uno de por sí (Neto-Neto, Triple-Neto).

## Decisión

Patrón único: **`Tarifa {Marca} {Tipo} {dd-mm-aaaa}.{ext}`**, construido por
`ExcelWriter.buildFilename(brandAbbr, typeLabel, tariffDate, ext)` (nuevo, en
`excel-writer.js`) y reutilizado por `pdf-writer.js` para el único tipo que genera PDF.

- **Marca**: casi siempre el `label` de la marca (Repsol, Castrol, Shell, Eni Live, Racing
  Oil) — excepto AD Parts, que Yako quiere acortado a "AD" (ni "AD Parts" ni el `abbr`
  interno "ADP", que sigue usándose tal cual en la columna MARCA del Excel y para quitar
  el prefijo de la referencia — ver ADR 0034). Tabla fija `FILE_BRAND_LABELS` en
  `excel-writer.js`, indexada por `abbr` (que es lo único que llega a las funciones de
  exportación, no el `brandId`).
- **Tipo**: no se deriva de ningún slug automático (el `label` en pantalla no siempre
  coincide con el que quiere en el nombre de fichero — p. ej. "Triple Neto" en el
  desplegable pero "Triple-Neto" en el fichero) — se define explícitamente en
  `EXPORT_FILE_TYPE_LABELS` (`screen-export.js`), indexado por el mismo `"kind:key"` que ya
  usa `currentOption` para elegir la rama de exportación, así no hay dos sitios que puedan
  desincronizarse:
  - `level:pvp` → "PVP Venta" · `skrit:pvp` → "PVP SKRIT" · `print:pvp` → "PVP Comerciales"
    (caso especial: pierde la palabra "Imprimir") · `level:netos_bonus` → "Neto Bonus"
    (singular, no "Netos Bonus" como en el desplegable) · `list:neto_factura` → "Neto
    Factura" · `list:neto_neto` → "Neto-Neto" · `list:triple_neto` → "Triple-Neto" ·
    `list:regalo_1x1` → "Valor Regalo 1+1" (no pedido explícitamente, pero se homogeniza
    igual para no dejar un tipo con el nombre viejo).
- **Fecha**: `tariffDate` llega en `aaaa-mm-dd` (nativo del `<input type="date">|`) — se
  reordena a `dd-mm-aaaa` dentro de `buildFilename`, sin tocar el resto de la app (el
  `<input>` y el resto de cálculos que usan `tariffDate` siguen en ISO).

## Consecuencias

- `exportSkritV2`/`exportSkritLean`/`exportPriceList` (`excel-writer.js`) y
  `exportPriceListPdf` (`pdf-writer.js`) reciben ahora un `typeLabel` explícito en vez de
  derivar un slug de `levelId`/`label`; sus llamadas en `screen-export.js::doExport()`
  pasan siempre `EXPORT_FILE_TYPE_LABELS[currentOption]`.
- Se retira el alias "pvp→venta" del ADR 0033 (ya no hace falta: cada tipo tiene su
  `typeLabel` propio y explícito, no un slug compartido que pudiera colisionar).
- Los nombres de fichero cambian de forma visible para Yako a partir de esta versión —
  es un cambio de nomenclatura, no de contenido (columnas/filas intactas, ver ADR 0034).

## Verificación

`ExcelWriter.buildFilename(...)` probado en consola del navegador con las 16
combinaciones marca×tipo de los ejemplos de Yako (AD/Repsol/Castrol/Shell/Eni
Live/Racing Oil × PVP Venta/SKRIT/Comerciales/Neto Bonus/Neto Factura/Neto-Neto/Triple-
Neto) — las 16 salidas coinciden carácter a carácter con el formato pedido. Consola sin
errores tras cargar la pantalla Exportación.

## Referencias

- `js/export/excel-writer.js`, `js/export/pdf-writer.js`, `js/screens/screen-export.js`.
- [ADR 0033](0033-colores-pdf-columna-familia-nombres-fichero.md) (nomenclatura anterior),
  [ADR 0034](0034-homogeneizacion-exportacion.md) (mayúsculas/columnas, no tocado aquí).
