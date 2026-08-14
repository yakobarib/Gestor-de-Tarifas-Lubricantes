# ADR 0039 — Nuevo tipo de exportación "PVP (Bonus)" (PDF)

**Fecha:** 2026-08-14
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Netos Bonus (hojas para comerciales, nunca va a Skrit) solo tenía salida en Excel
(`exportSkritV2`, 9 columnas de auditoría: coste factura/neto-neto/triple-neto y PVP).
Yako pide una plantilla de impresión hermana de "PVP (Imprimir)" — mismo PDF sin coste,
mismo maquetado — pero con el resultado de Netos Bonus en vez de PVP normal, y solo 4
columnas: REFERENCIA, DESCRIPCION, LITROS, PVP BONUS.

## Decisión

Nueva opción **"PVP (Bonus)"** (`print:netos_bonus`) en el desplegable de tipo de
exportación, justo debajo de "Netos Bonus (uso interno)" — mismo patrón que "PVP
(Imprimir)" (`print:pvp`) pero apuntando al nivel `netos_bonus` en vez de `pvp`.

- `renderPreviewTable`/`doExport` (`screen-export.js`), rama `kind === 'print'`:
  generalizados para resolver el nivel por `key` (antes solo aceptaban `'pvp'`
  hardcodeado) — así una misma rama sirve para "PVP (Imprimir)" y "PVP (Bonus)" sin
  duplicar código.
- "PVP (Bonus)" además filtra por `printFormats` — solo entran los formatos marcados
  "Salida impresa" en Reglas/Netos Bonus, el mismo criterio que ya usa su Excel (ver ADR
  0027) — así la hoja impresa en PDF y en Excel muestran siempre las mismas filas.
- `PdfWriter.exportPriceListPdf` (`pdf-writer.js`) acepta un `opts` opcional
  (`{title, columns}`) para poder reusar el mismo maquetado (color de marca, pie de
  página, formato A4) sin duplicar la función — "PVP (Imprimir)" sigue con sus valores
  por defecto ("Tarifa de venta", columnas Referencia/Producto/Litros/PVP); "PVP
  (Bonus)" pasa `{title: 'Tarifa Netos Bonus', columns: ['Referencia', 'Descripción',
  'Litros', 'PVP Bonus']}`.
- Nombre de fichero, mismo patrón del ADR 0035: `Tarifa {Marca} PVP Bonus
  dd-mm-aaaa.pdf`.

## Verificación

Con una fila de prueba (AD Parts, formato 208L) marcada "Salida impresa" en Netos Bonus:
previsualización de "PVP (Bonus)" muestra la cabecera Referencia/Descripción/
Litros/PVP Bonus y solo esa fila (1 de 2, la otra sin marcar queda fuera); exportar
genera `Tarifa AD PVP Bonus 14-08-2026.pdf` (1 fila). "PVP (Imprimir)" comprobado sin
regresión tras el cambio: misma cabecera de siempre (Referencia/Producto/Litros/PVP),
las 2 filas (sin filtro de "Salida impresa", como corresponde a PVP normal), mismo
nombre de fichero (`Tarifa AD PVP Comerciales 14-08-2026.pdf`). Consola sin errores.

## Consecuencias

- `js/screens/screen-export.js`: nueva entrada en `EXPORT_FILE_TYPE_LABELS`, nueva
  opción en `renderExportOptions`, ramas `kind === 'print'` de `renderPreviewTable` y
  `doExport` generalizadas por `key` en vez de `'pvp'` fijo.
- `js/export/pdf-writer.js`: `exportPriceListPdf` acepta `opts` opcional.

## Referencias

- `js/screens/screen-export.js`, `js/export/pdf-writer.js`.
- [ADR 0031](0031-skrit-imprimir-litros-filtros-ayuda.md) ("PVP (Imprimir)" original),
  [ADR 0027](0027-pvp-modos-por-formato-y-netos-bonus-fijo.md) (`printFormats` de
  Netos Bonus), [ADR 0035](0035-nomenclatura-limpia-ficheros-exportados.md) (nombre de
  fichero).
