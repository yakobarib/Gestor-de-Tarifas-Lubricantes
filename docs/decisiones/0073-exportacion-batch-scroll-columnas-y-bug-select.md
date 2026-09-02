# ADR 0073 — Exportación: scroll real, columnas de PDF unificadas, y bug del PVP manual

**Fecha:** 2026-09-02
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako probó los cambios de ADR 0072 y reportó varios puntos sueltos, todos sobre
Exportación:

1. **Seguía habiendo scroll de página** aunque la maquetación se veía bien — el primer
   intento (ADR 0072) restaba a mano el alto medido del header (`calc(100vh - 100px)`),
   y ese número no encajaba del todo (probablemente por el `margin-bottom` del header,
   no incluido en la medida), dejando un resto de scroll de pocos píxeles.
2. Renombrar "Triple Neto" → "Neto Triple" y colocarlo después de "Neto-Neto".
3. Renombrar "Neto-Neto" → "Neto Neto" (sin guion).
4. "Netos Gasolineras" en su impresión debe llevar solo Marca, Referencia, Producto,
   Litros y PVP Gasolineras.
5. "Netos Bonus" en su impresión debe llevar, además de lo que ya tenía, Marca por
   delante — mismo shape final que Netos Gasolineras.
6. PVP (Skrit) necesitaba scroll horizontal por una columna "Producto" demasiado ancha.
7. PVP (Datos) no necesita columna de PVP manual — se edita desde Skrit.
8. **Bug real**: al editar un PVP manual y pulsar Intro en PVP (Datos) o PVP (Skrit), la
   pantalla saltaba a "Neto Factura (Compra)".

## Decisión

**1. Scroll de página, arreglado de raíz** (`styles.css`): en vez de restar un número de
píxeles a mano, `.app-main` pasa a ser `display:flex; flex-direction:column` — sus hijos
(header + secciones) se apilan igual que en flujo normal, pero ahora `#screen-export`
puede pedir `flex:1; min-height:0` y quedarse con "todo el alto que sobre tras el header"
sin necesidad de conocer ese alto de antemano. Elimina la fuente del resto de scroll del
primer intento. El resto de pantallas no piden ese `flex` y se comportan exactamente
igual que antes (mismo `overflow-y:auto` de `.app-main` si su contenido no cabe).

**2/3. Renombrados** (`PRICE_LIST_TYPES` en `screen-export.js`): `neto_neto.label` →
`'Neto Neto'`, `triple_neto.label` → `'Neto Triple'`. Al ordenarse alfabéticamente (ver
ADR 0069), "Neto Triple" cae solo justo después de "Neto Neto" — no hizo falta forzar
ningún orden a mano.

**4/5/8. Netos Bonus y Netos Gasolineras, mismo formato PDF, bug del `<select>`
corregido de paso**: mientras se ampliaba el PDF de Netos Bonus para incluir Marca, y se
migraba Netos Gasolineras al mismo formato (dejando de ser un Excel "rico" aparte, ver
`renderExportOptions()` — ahora CUALQUIER nivel que no sea "pvp" ofrece una única opción
PDF, generalizado en vez de un caso especial por nivel), se investigó el bug nº 8 del
salto a "Neto Factura": `renderExportOptions()` reconstruye `<select id="exportTypeSelect">`
entero en cada `rules:changed` (incluida una edición de PVP manual, que dispara ese
evento) — al reconstruir las `<option>` sin marcar ninguna como `selected`, el navegador
caía por defecto en la primera opción alfabética. Arreglado restaurando `sel.value =
currentOption` tras reconstruir, si esa opción sigue existiendo. Con la selección estable,
la tabla que se estaba editando deja de cambiar de golpe a otra completamente distinta —
que era la causa real del "salto de pantalla" percibido.

`PdfWriter.exportPriceListPdf` gana un `opts.includeBrand` — antepone `brand.abbr` como
primera columna de cada fila cuando se pide (con los índices de `columnStyles`
desplazados en consecuencia); las columnas en sí siguen viniendo de `opts.columns`, ahora
sin desajuste entre cabecera y filas.

Al quedar `netos_bonus`/`netos_gasolineras` fuera de `kind: 'level'` para siempre, se
retiraron los bloques de código que ya no eran alcanzables (la vista Excel "rica" de
`renderPreviewTable` y el filtrado por `printFormats` de `doExport` para esas dos claves)
en vez de dejarlos como código muerto.

**6/7. PVP (Skrit) y PVP (Datos)**: nueva clase `table.preview td.prod`/`th.prod`
(`max-width: 260px; overflow: hidden; text-overflow: ellipsis`, el texto completo sigue
en el `title` del `<td>`) aplicada a la columna "Producto" en todas las tablas de
Exportación que la tienen — corrige el desbordamiento horizontal de PVP (Skrit) y de
paso previene el mismo problema en el resto. PVP (Datos) pierde su columna e input de
"PVP manual" — sigue mostrando en azul el PVP cuando hay uno fijado a mano desde otra
vista (WYSIWYG de solo lectura), pero ya no se edita desde aquí.

## Pendiente (explícitamente aplazado por Yako)

"Valor Regalo 1+1" debería mostrar solo los artículos con "1+2" activado en Reglas —
Yako sospecha que el cálculo actual está mal, o que lo explicó mal la primera vez. Sin
tocar en este cambio, queda para una sesión aparte.

## Verificación

- `node --check` sobre `screen-export.js`, `pdf-writer.js`, `screen-help.js`.
- Revisado a mano cada uso de `key === 'netos_bonus'`/`'netos_gasolineras'` restante tras
  el cambio — ninguno queda en una ruta ya inalcanzable.

## Referencias

- ADR 0072 (primer intento del layout sin scroll, corregido aquí).
- ADR 0069 (orden alfabético del desplegable).
- ADR 0039 (origen del PDF "PVP Bonus").
- `app/css/styles.css`, `js/screens/screen-export.js`, `js/export/pdf-writer.js`,
  `js/screens/screen-help.js`.
