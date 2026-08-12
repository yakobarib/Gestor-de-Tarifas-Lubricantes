# ADR 0031 — Litros en Comparación, exportación filtrada, "PVP (Skrit)"/"PVP (Imprimir)" y manual de ayuda

**Fecha:** 2026-08-12
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Cuatro peticiones sueltas de pulido, todas sobre pantallas ya existentes:

1. El desplegable de "Referencia" en Comparación solo mostraba ref + descripción — sin
   litros, obligaba a adivinar el formato antes de elegir.
2. Los filtros de búsqueda/formato/estado de Exportación solo afectaban a la
   previsualización en pantalla — el Excel exportado siempre llevaba TODAS las filas de
   la marca/gama, no las filtradas. "Si hay formatos filtrados, la salida del Excel o PDF
   será igualmente filtrada."
3. Falta un tipo de exportación mínimo, "tal cual se sube a Skrit" (Marca, Referencia,
   Descripción editada, Litros por envase, Precio de compra, PVP — sin las columnas de
   trabajo de "PVP (Venta)"), y otro que genere un PDF sin coste para entregar a un
   cliente o comercial.
4. El botón de Ayuda no hacía nada ("próximamente") — pidió un manual por pestañas
   explicando qué se puede hacer y el flujo de trabajo esperado en cada una.

## Decisión 1 — Litros en el desplegable de Referencia (Comparación)

`renderRefOptions()` añade `Parser.formatLabel(r.liters)` entre paréntesis a cada opción:
`ADP10005 — DS3 SAE 30 (5 L)`.

## Decisión 2 — Exportar siempre lo que se ve filtrado en pantalla

`doExport()` calculaba el fichero a partir de `rows` (el maestro completo de esa
marca/gama) — los filtros de búsqueda/formato/estado (`filter.text/format/status`) solo
afectaban a la tabla de previsualización, nunca al Excel/PDF real. Se cambia a partir de
`visibleRows()` (la misma función que ya usa la previsualización) en todos los tipos de
exportación, incluidos los que ya existían — no es un caso nuevo, es corregir uno que ya
estaba mal desde que se introdujeron los filtros (ADR 0021/0022).

## Decisión 3 — El nivel PVP se ofrece en 3 salidas: Venta / Skrit / Imprimir

En vez de un cuarto tipo suelto, se generaliza el propio nivel "pvp" (que ya calcula el
mismo PVP con la misma configuración de Reglas) a tres presentaciones distintas en el
desplegable de "Tipo de exportación":

- **PVP (Venta)**: la tabla rica de siempre (margen, PVP manual, ganancia, margen real) —
  sin cambios, para revisar/ajustar.
- **PVP (Skrit)** (`kind: 'skrit'`): Excel mínimo — MARCA, REFERENCIA (sin prefijo),
  DESCRIPCION (editada, `descriptionExport` si existe), LITROS (por envase — el propio
  `row.liters` ya lo es: se deriva del tamaño de UN envase, no de la caja completa, ver
  ADR 0007/0010), COSTE COMPRA (el que use la base de coste del nivel) y PVP.
  `ExcelWriter.exportSkritLean()`.
- **PVP (Imprimir)** (`kind: 'print'`): PDF sin ningún coste — Referencia, Producto,
  Litros, PVP — para dar a un cliente o comercial. `PdfWriter.exportPriceListPdf()`
  (jsPDF + jspdf-autotable, CDN, ver `app/index.html`), con cabecera de marca/gama/fecha,
  tabla con el color de la marca, y numeración de página.

Los tres comparten el mismo nivel "pvp" y la misma resolución de gama fila a fila en
"Todas" que ya usaba "PVP (Venta)" — no hay lógica de cálculo nueva, solo presentación.

## Verificación

Probado con AD Parts (302 refs importadas): "PVP (Skrit)" filtrado a formato "5 L" (302 →
75) exporta exactamente 75 filas con las 6 columnas pedidas, coincidiendo con la
previsualización. "PVP (Imprimir)" con el mismo filtro genera un PDF real (1 página,
~6 KB, verificado interceptando `jsPDF`) con la tabla Referencia/Producto/Litros/PVP.
"PVP (Venta)" sin filtro sigue exportando las 302 filas completas — sin regresión.

## Decisión 4 — Manual de ayuda: modal con una pestaña por pantalla

El botón de ayuda abre un modal (`#helpModal`, `ScreenHelp`) con una pestaña por pantalla
real de la app (Importación/Tarifas/Reglas/Comparación/Exportación) y contenido fijo en
HTML dentro de `screen-help.js` — no depende de datos, hay que mantenerlo a mano si
cambia el comportamiento de alguna pantalla. Se abre directamente en la pestaña de la
pantalla activa (`Router.current()`). Cierra con la X, con clic fuera (backdrop) o con
Escape.

## Consecuencias

- `js/screens/screen-compare.js`: litros en `renderRefOptions()`.
- `js/screens/screen-export.js`: `doExport()` usa `visibleRows()` en vez de `rows`;
  nuevas ramas `kind === 'skrit'`/`'print'` en `renderPreviewTable()`/`doExport()`;
  `exportDescription()` local (antes solo existía en `excel-writer.js`).
- `js/export/excel-writer.js`: `exportSkritLean()`.
- `js/export/pdf-writer.js` (nuevo): `exportPriceListPdf()`.
- `js/screens/screen-help.js` (nuevo), `js/app.js`: `btnHelp` abre el modal en vez del
  toast "próximamente".
- `app/index.html`: CDN de jsPDF + jspdf-autotable; markup del modal de ayuda.
- `css/styles.css`: `.help-modal`/`.help-tabs`/`.help-tab`/`.help-body`.

## Referencias

- `js/screens/screen-compare.js`, `js/screens/screen-export.js`,
  `js/export/excel-writer.js`, `js/export/pdf-writer.js`, `js/screens/screen-help.js`,
  `js/app.js`.
- [ADR 0021](0021-reglas-todas-las-gamas-y-coste-disponible.md)/
  [ADR 0022](0022-tarifas-en-crudo-y-margen-por-formato.md) (filtros de Exportación,
  ahora corregidos para afectar también al export), [ADR 0023](0023-listado-calculado-en-exportacion.md)
  (WYSIWYG previsualización → export).
