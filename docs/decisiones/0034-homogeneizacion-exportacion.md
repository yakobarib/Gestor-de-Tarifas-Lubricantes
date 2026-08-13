# ADR 0034 — Homogeneización de Exportación: mayúsculas, columnas, WYSIWYG y cuadro de errores

**Fecha:** 2026-08-13
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Repaso general de la pantalla Exportación, con Yako pidiendo que deje de depender de cómo
entra cada tarifa de proveedor ("cada marca es un mundo, entren como entren"):

1. Toda salida de tarifa (pantalla, Excel, PDF) en mayúsculas; referencias sin espacios
   aunque entren con ellos.
2. El recuadro "Mostrando X de Y referencias" pasa a ser dos cuadros: el recuento y, a su
   derecha (hasta el borde del botón Exportar de la fila de arriba), un aviso de errores
   de la tarifa (litros/precio/descripción que falten), con fondo amarillo pastel
   parpadeante cuando los haya.
3. La fila de filtros de búsqueda debe medir el mismo alto que la fila de Marca/Gama/
   Tipo/Fecha.
4. El filtro de formato/estado activo se resalta en verde pastel.
5. Auditoría general: el nombre de fichero debe reflejar el tipo de exportación; todas
   las marcas deben mostrar las mismas columnas, en el mismo orden y cantidad, para un
   mismo tipo; **la pantalla debe coincidir exactamente con lo que se exporta** — con una
   única excepción explícita: "PVP (Venta)" puede seguir mostrando en pantalla columnas
   de trabajo (margen, PVP manual, ganancia, margen real) que no salen en su Excel,
   porque son ayudas de edición, no datos de la tarifa. Orden general de columnas:
   MARCA, REFERENCIA, DESCRIPCION, LITROS, FAMILIA, COSTES, VENTAS — no todas las
   plantillas tienen las 7, pero las que tienen se ordenan así.

## Decisión 1 — Mayúsculas y referencia sin espacios, en el punto de salida

`Parser.upperOut(s)`/`Parser.upperRef(s)` (nuevas) — se aplican en `excel-writer.js`,
`pdf-writer.js` y las previsualizaciones de `screen-export.js`, **nunca** sobre los datos
del maestro (no se reescribe `r.ref`/`r.description` en `MasterDB` — otras pantallas como
Tarifas/Comparación siguen mostrando el dato tal cual entró). `exportRef(ref, brandAbbr)`
normaliza ANTES de quitar el prefijo de marca (si se comparara en el orden contrario, una
ref en minúsculas nunca "empezaría por" `brandAbbr`, que siempre está en mayúsculas).

## Decisión 2 — Auditoría de columnas: WYSIWYG estricto salvo "PVP (Venta)"

Al revisar cada tipo contra su Excel se encontraron dos incumplimientos reales del WYSIWYG
del ADR 0023, además del hueco de Familia ya conocido:

- **Netos Bonus** compartía la vista rica de "PVP (Venta)" (Estado, margen, PVP manual,
  ganancia) pero su Excel (`exportSkritV2`) nunca tuvo esas columnas — a diferencia de
  "PVP (Venta)", Yako no lo eximió. Se le da su propia vista mínima, igual que el Excel:
  MARCA, REFERENCIA, DESCRIPCION, LITROS, FAMILIA, COSTE FACTURA, COSTE NETO-NETO, COSTE
  TRIPLE NETO, PVP — sin edición de PVP manual (si hiciera falta, se pide aparte).
- **Neto Factura/Neto-Neto/Triple Neto/Valor Regalo 1+1** mostraban una columna Estado
  (NUEVA/REBRAND) que su Excel (`exportPriceList`) no tiene, y no mostraban Marca (que su
  Excel sí tiene). Se corrigen ambas cosas.
- `exportSkritV2` ("PVP (Venta)"/Netos Bonus) reordena sus columnas al orden general:
  MARCA, REFERENCIA, DESCRIPCION, LITROS, FAMILIA, COSTE FACTURA, COSTE NETO-NETO, COSTE
  TRIPLE NETO, PVP (antes tenía los 3 costes y el PVP antes de Familia/Litros/Descripción).
- "PVP (Skrit)" ya tenía el orden general correcto — solo le faltaba mostrar Familia en
  pantalla (sí se exportaba, ver ADR 0032) — ahora se ve en el mismo orden en los dos
  sitios: MARCA, REFERENCIA, PRODUCTO, LITROS, FAMILIA, COSTE COMPRA, PVP.
- `exportPriceList` no tiene columna Familia — no se añade (el pedido es "si la tienen,
  reordenar", no añadir columnas que la plantilla no tenía).

Los nombres de fichero ya reflejaban el tipo tras el ADR 0033 (`...-venta-...`,
`...-pvp-...`, `...-netos-bonus-...`, `listado-neto-factura-...`, `pvp-imprimir-...`) — se
confirma en la verificación, sin cambios adicionales.

## Decisión 3 — Cuadro de recuento + cuadro de errores

`#exportVisibleCount`/`#exportTotalCount` pasan de un `<span>` inline en `.filter-bar` a
su propia fila (`.export-summary-row`) con dos cajas: `.export-count-box` (ancho fijo) y
`.export-errors-box` (`flex:1`, llega hasta el borde derecho — mismo contenedor que la
fila de Marca/Gama/Tipo/Fecha/Exportar, así que su ancho total ya coincide sin lógica de
alineación aparte). `newErrorTally()`/`trackRowErrors()`/`renderErrorsBox()` cuentan,
fila a fila visible, cuántas no tienen litros / descripción / precio — el criterio de
"precio" depende de la rama (PVP calculado, coste del listado, valor del regalo). Con
errores, `.has-errors` añade `color-mix`-free amarillo pastel (`#fdf6d3`↔`#fbe9a0`) vía
`@keyframes export-errors-blink`.

## Decisión 4 — Alto de fila igualado; filtro activo en verde pastel

La diferencia de alto (44px vs 40px) venía del `line-height` — `.filter-bar` fijaba
`1.3` y `.filter-row .field` no fijaba nada (hereda el `1.5` de Pico); se quita el
`line-height` de `.filter-bar` para que ambas filas usen el mismo valor heredado.

`filter-active` en `#exportFormatFilter`/`#exportStatusFilter` cuando su valor no es el
por defecto — verde pastel. **Bug encontrado y corregido durante la propia
implementación**: la primera versión usaba `:root:not([data-theme="light"])` para el
modo oscuro *fuera* de un `@media`, lo que la aplicaba también en modo claro (cualquier
`:root` sin el atributo `data-theme="light"` explícito, que es el caso por defecto del
tema "sistema" en claro) — pisaba el verde pastel con el color oscuro. Se corrige
envolviendo esa regla en `@media (prefers-color-scheme: dark)`, con `:root[data-theme=
"dark"]`/`:root[data-theme="light"]` explícitos aparte (mismo patrón de 3 reglas que ya
usa `.nav-*.active` en este mismo fichero).

## Verificación

AD Parts (302 refs) + Repsol (864 refs): "PVP (Skrit)" y "Neto Factura" muestran
Marca/Familia en el orden pedido y en mayúsculas, coincidiendo pantalla↔Excel exactamente
(comparado leyendo el `.xlsx` real con ExcelJS). "Netos Bonus" con "Salida impresa"
activada en 208L: 70 filas, cabecera y valores idénticos entre previsualización y Excel
(PVP 491,89€ = (343,51+50)/0,8, fórmula de ADR 0016 intacta). Cuadro de errores: cambia a
"⚠ 1 sin litros" con `animation-name:export-errors-blink` activa al elegir una marca con
huecos de datos. Alto de fila: 44px en ambas filas tras el fix de `line-height`. Resaltado
verde del filtro: confirmado que la regla CSS tiene la especificidad correcta y se
aplica (`element.matches()` la encuentra, el toggle de clase funciona) — no se pudo
confirmar visualmente por captura en este entorno de pruebas (el `<select>` nativo no
refleja cambios de `background-color` en `getComputedStyle` dentro de este navegador
automatizado, ni siquiera con estilo inline; un `<div>` de control sí lo hizo
correctamente, así que es una limitación del entorno de prueba, no del CSS).

## Consecuencias

- `js/core/parser.js`: `upperOut()`, `upperRef()`.
- `js/export/excel-writer.js`: normalización en las 3 funciones; reorden de columnas de
  `exportSkritV2`.
- `js/export/pdf-writer.js`: normalización del cuerpo de la tabla.
- `js/screens/screen-export.js`: `exportRef()`, `newErrorTally()`/`trackRowErrors()`/
  `renderErrorsBox()`; Netos Bonus con vista propia (separada de PVP); Estado fuera de
  los listados simples; Marca añadida a esos mismos listados; clase `filter-active` en
  los filtros.
- `app/index.html`: cuadro de recuento + cuadro de errores.
- `css/styles.css`: `.export-summary-row`/`.export-count-box`/`.export-errors-box`;
  `.filter-active`; `line-height` quitado de `.filter-bar`.

## Referencias

- `js/core/parser.js`, `js/export/excel-writer.js`, `js/export/pdf-writer.js`,
  `js/screens/screen-export.js`, `css/styles.css`.
- [ADR 0031](0031-skrit-imprimir-litros-filtros-ayuda.md),
  [ADR 0032](0032-excel-negrita-columnas-boton-exportar.md),
  [ADR 0033](0033-colores-pdf-columna-familia-nombres-fichero.md),
  [ADR 0023](0023-listado-calculado-en-exportacion.md) (WYSIWYG original).
