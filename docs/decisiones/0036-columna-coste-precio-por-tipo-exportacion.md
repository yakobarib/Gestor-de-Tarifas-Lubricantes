# ADR 0036 — Cabecera de coste homogénea por tipo de exportación

**Fecha:** 2026-08-13
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Revisando en Excel tres exportaciones de "PVP (Skrit)" (AD, Castrol, Eni Live), Yako
detecta columnas distintas entre marcas. Al comparar los ficheros con detalle, la causa
no es el código de `exportSkritLean` (que ya es fijo e idéntico para las 6 marcas desde
el ADR 0034) sino que dos de los tres ficheros de la captura eran de un tipo de
exportación distinto ("PVP (Venta)", 9 columnas) guardados de una sesión de pruebas
anterior a la nomenclatura del ADR 0035 (el nombre de fichero, con guiones y sufijo
`-venta-`, delata que no eran "PVP (Skrit)"). Confirmado leyendo `exportSkritLean` y
`renderPreviewTable` (rama `kind === 'skrit'`): las columnas de "PVP (Skrit)" son fijas,
sin ninguna rama por marca — así que un mismo tipo de exportación ya produce siempre las
mismas columnas para las 6 marcas.

Aparte de esa confusión de ficheros, Yako aprovecha para pedir cabeceras de coste más
claras (hoy "COSTE COMPRA" en Skrit era ambiguo con los otros tipos, que sí distinguen
factura/neto-neto/triple-neto):

- Skrit: la única columna de coste debe llamarse **COSTE FACTURA** (antes "COSTE
  COMPRA"); la única de venta sigue siendo **PVP** (ya estaba bien).
- Listado Neto-Neto: su columna de coste debe llamarse **COMPRA NETO-NETO** (antes
  "NETO-NETO").
- Listado Triple-Neto: **COMPRA TRIPLE-NETO** (antes "TRIPLE NETO", sin guion).
- Listado Neto Factura (no en los ejemplos originales, confirmado con Yako aparte):
  **COMPRA FACTURA** (antes "NETO FACTURA"), mismo patrón que los otros dos listados.

## Decisión

- `exportSkritLean` (`excel-writer.js`): columna de coste renombrada a "COSTE FACTURA".
  Su previsualización en pantalla (`screen-export.js`, rama `kind === 'skrit'`) se
  actualiza igual ("Coste factura") para no romper el WYSIWYG del ADR 0034.
- `PRICE_LIST_TYPES` (`screen-export.js`) gana un campo `columnHeader`, distinto de
  `label` — `label` sigue siendo el nombre del tipo (dropdown, nombre de hoja, texto de
  ayuda: "Neto Factura", "Neto-Neto", "Triple Neto"); `columnHeader` es el texto real de
  la columna de coste ("Compra Factura", "Compra Neto-Neto", "Compra Triple-Neto"), en
  mayúsculas en el Excel (mismo patrón `.toUpperCase()` que ya se aplicaba) y tal cual en
  pantalla. `exportPriceList` (`excel-writer.js`) acepta ahora un `columnHeader` explícito
  en vez de derivar siempre la cabecera de `label`.
- El nombre de fichero (ADR 0035, `EXPORT_FILE_TYPE_LABELS`) no cambia — sigue
  independiente de estas cabeceras de columna, cada uno resuelto por su propia tabla.

## Verificación

`ExcelWriter.exportSkritLean`/`exportPriceList` probados en consola del navegador con
filas de ejemplo — las 4 combinaciones (Skrit, Neto Factura, Neto-Neto, Triple-Neto) se
generan sin error y con el nombre de fichero esperado (ADR 0035 intacto). Cabeceras
confirmadas por lectura directa del código fuente tras el cambio: "COSTE FACTURA" en
Skrit (Excel y pantalla), "COMPRA FACTURA"/"COMPRA NETO-NETO"/"COMPRA TRIPLE-NETO" en los
tres listados. Consola sin errores.

## Referencias

- `js/export/excel-writer.js`, `js/screens/screen-export.js`.
- [ADR 0034](0034-homogeneizacion-exportacion.md) (columnas/WYSIWYG, sin cambios aquí en
  el resto de columnas), [ADR 0035](0035-nomenclatura-limpia-ficheros-exportados.md)
  (nombre de fichero, tabla independiente de esta).
