# ADR 0027 — "1+2"/"PVP Neto" como modos por formato en PVP; Netos Bonus fijo; quitar "Añadir nivel"

**Fecha:** 2026-08-10
**Estado:** Aceptada — sustituye el mecanismo de niveles del [ADR 0026](0026-promocion-1x2-y-listado-regalo.md)
**Decidido por:** Yako

## Contexto

Recién implementado el ADR 0026 ("1+2" como nivel independiente que se añade/quita con
"Añadir nivel", igual que "Bidones y Cubas Neto"), Yako pidió cambiarlo tras probarlo:

> Me gustaría cambiarlo de alguna forma más visual. Si debajo de cada margen por formato
> ponemos un botón "1+2" encendido o apagado para indicar que ese formato se va a calcular
> con el PVP preparado para hacer 1+2. De la misma forma con el PVP Neto (bidones y
> cubas), apagado por defecto. Estos dos presets desaparecerían de "Añadir nivel".
>
> Netos Bonus es otra cosa — son precios que no van a Skrit, los usan los comerciales
> impresos en hojas. Sería una tarifa completa diferente: elegir el origen del precio, el
> margen en cada formato, y activar los formatos que van a tener salida impresa. Con esto
> desaparecía el cuadro "Añadir nivel".

Motivo de fondo, ya presente en el ADR 0026 pero que se hace explícito ahora: para un
formato concreto de una tarifa, solo tiene sentido UNA forma de precio a la vez — normal,
"1+2" o "PVP Neto" — nunca dos. Modelarlos como niveles `priceLevels` independientes (cada
uno con su propio PVP) permitía activarlos "en paralelo" sin que la UI lo dejara claro.

También se aprovechó para corregir un dato que había quedado mal desde el ADR 0016: Netos
Bonus tenía `goesToSkrit: true` a pesar de ser, según la propia descripción de Yako,
precios que nunca van a Skrit.

## Decisión 1 — "1+2" y "PVP Neto" pasan a ser modos por formato dentro de PVP

Se elimina el preset `promo_1x2` y el preset `cubas_neto` como niveles independientes.
En su lugar, el nivel `pvp` (que siempre existe) gana un campo `formatModes` — un mapa
`formatKey → '1x2' | 'pvp_neto'` — y la tabla de margen por formato de Reglas gana dos
filas de interruptor (botón encendido/apagado, mismo lenguaje visual que los botones
`.mode-btn` ya usados en Tarifas): "1+2" (solo formatos ≤5L) y "PVP Neto" (solo formatos
≥150L). Al activar un modo para un formato, `Pricing.compute()` sustituye el margen normal
(por defecto o por formato) por la fórmula fija de ese modo:

- `1x2`: 83,33% de margen sobre venta (igual que antes, ver ADR 0026 original).
- `pvp_neto`: 20% sobre venta si el litraje real de la fila es &lt;500L ("bidón"), 15% si es
  ≥500L ("cuba") — el propio litraje decide el tramo, no una lista fija de formatKeys por
  marca (a diferencia del antiguo `onlyFormats` de "Bidones y Cubas Neto").

La exclusión mutua es automática por construcción: `formatModes[formatKey]` es un único
valor, así que activar `pvp_neto` para un formato borra cualquier `1x2` que hubiera ahí (y
viceversa) — no hace falta lógica de validación aparte.

Migración de configs ya guardadas con los niveles antiguos (`migrateLevels()` en
`screen-rules.js`, corre en cada `renderLevels()`): los formatos que cumplían el
`maxLiters` de un `promo_1x2` existente pasan a `pvp.formatModes[formato] = '1x2'`; los
formatos del `onlyFormats` de un `cubas_neto` existente pasan a `'pvp_neto'`; ambos niveles
se eliminan del array después.

## Decisión 2 — Netos Bonus: tarifa fija, nunca va a Skrit, "Salida impresa" por formato

Netos Bonus deja de ser un preset opcional — como PVP, siempre existe (se sintetiza si no
hay config todavía) y no se puede eliminar. Cambios sobre el ADR 0016 original:

- `goesToSkrit` se fija a `false` siempre (era `true` por error — Yako confirma que estos
  precios nunca van a Skrit, son hojas impresas para comerciales).
- Se elimina `onlyFormats` (antes limitaba el nivel a bidones/cubas). El margen por formato
  ahora es libremente editable para CUALQUIER formato, igual que en PVP.
- Nuevo campo `printFormats` (mapa `formatKey → true`), con su propia fila de interruptor
  ("Salida impresa") en la tabla de margen por formato — decide qué formatos entran en la
  hoja impresa/exportada, independiente de si tienen precio calculado o no. Por defecto
  vacío (todo apagado); al migrar una config antigua, los formatos que estaban en el
  `onlyFormats` de antes se marcan como `printFormats` para no perder ese ajuste.

En Exportación, `list:regalo_1x1` ahora comprueba `pvp.formatModes` (no busca un nivel
`promo_1x2`) y el nivel `netos_bonus` se ofrece siempre (ya no depende de `goesToSkrit`,
que además ahora es explícitamente `false`); su previsualización y su export filtran las
filas por `printFormats[formatKey]` antes de pintarlas/exportarlas (mismo criterio en
ambos sitios, WYSIWYG, ver ADR 0023).

## Decisión 3 — Se quita "Añadir nivel"

Con "1+2"/"PVP Neto" absorbidos en PVP y Netos Bonus fijo como PVP, no queda ningún nivel
opcional que añadir — se retira la sección completa (`#newLevelPreset`/`#btnAddLevel`) de
Reglas. Efecto secundario aceptado: se pierde la posibilidad de crear un nivel 100% a
medida ad-hoc (la salida que se dio en el ADR 0016 para "Netos Especiales") — si hiciera
falta un tercer tipo de tarifa en el futuro, se añadirá explícitamente como PVP/Netos
Bonus, no como un mecanismo genérico.

## Decisión 4 — Reorganización del cuadro de campos (feedback de layout)

Motivado por una captura de Yako: el desplegable "Base de coste" pegaba el texto contra la
flecha, "Margen por defecto" partía su etiqueta en dos líneas por columna estrecha, y
"Redondeo"/"¿Va a Skrit?" quedaban en una fila aparte por debajo del margen por formato en
vez de junto a los otros 3 campos (había sitio de sobra). Se corrige:

- `.level-field select` gana su propio padding-derecho y posición de flecha (antes
  compartía regla con `input`, con un padding uniforme insuficiente para el ancho de la
  flecha de Pico).
- Columna mínima del grid de campos ampliada (125px → 160px) — con eso, y con la tabla de
  margen por formato ahora FUERA de ese grid (era el motivo real de que Redondeo/Skrit
  cayeran a otra fila: al ser wide, `grid-column:1/-1`, cortaba la fila), los 5 campos
  entran en una sola fila.
- "Margen por defecto" gana un sufijo "%" visual (span absoluto dentro de un wrapper
  `.input-suffix`, no un input distinto).

## Verificación

Probado en navegador (Castrol, puerto nuevo para evitar caché de CSS/JS — ver nota de
`file:// `/servidor del ADR 0008): tabla de margen por formato de PVP muestra "1+2"
disponible solo en ≤5L y "PVP Neto" solo en ≥150L (el resto, celda "—"); activar "1+2" en
1L calcula PVP = coste×6 (verificado 57,07€ → 342,34€); activar "PVP Neto" en 208L da 20%
(817,86€ → 1022,33€) y en 1000L da 15% — confirma el tramo por litraje real, no por lista
de formatos. Netos Bonus con "Salida impresa" activada solo en 208L/1000L: previsualización
y export muestran solo esas 163 filas, con el PVP correctamente calculado con coste en
cascada + premio + margen (antes de corregir un bug de este mismo cambio, ver más abajo).
"Añadir nivel" ya no aparece; los 6 desplegables de Exportación se reducen a "PVP",
"Netos Bonus", 3 listados de compra y "Valor Regalo 1+1" (condicionado a tener algún
formato en modo "1x2").

**Bug encontrado y corregido durante esta misma verificación**: al exportar "Todas las
gamas", `doExport()` pasaba `levelForGama` (una función que espera un string de gama)
directamente como resolver a `ExcelWriter.exportSkritV2`, que en realidad invoca al
resolver con la FILA completa — el nivel resuelto salía `undefined` en cascada y
`Pricing.compute` caía a un coste sin `baseCostField` reconocible. Corregido envolviendo en
`(row) => levelForGama(row.gama)` antes de pasarlo a `exportSkritV2`, igual que hacía el
código original antes de esta refactorización.

## Consecuencias

- `js/core/pricing.js`: `compute()` resuelve `cfg.formatModes[row.formatKey]` antes que
  `byFormat`/`defaultMargin`, con las fórmulas fijas de "1+2" y "PVP Neto" (por umbral de
  litros real, no de formatKey).
- `js/screens/screen-rules.js`: reescrito — sin `PRESETS` de niveles opcionales, sin
  `addLevel`/`deleteLevel`; `migrateLevels()` (antigua config → nueva forma);
  `levelCardHtml`/`formatTableHtml` con tabla de formato + filas de interruptor.
- `app/index.html`: se quita la sección "Añadir nivel"; copy de Reglas actualizado.
- `js/screens/screen-export.js`: `promo1x2LevelFor` → `pvpLevelFor`; gating de
  "Valor Regalo 1+1" vía `formatModes`; Netos Bonus siempre ofrecido, filtrado por
  `printFormats` en previsualización y export.
- `css/styles.css`: `.level-fields` con columnas más anchas; `.level-field select` con su
  propio padding/posición de flecha; `.input-suffix`; se sustituye `.byformat-grid`/
  `.format-row` por `.format-table`/`.format-toggle-btn`.

## Referencias

- `js/core/pricing.js`, `js/screens/screen-rules.js`, `js/screens/screen-export.js`,
  `css/styles.css`.
- [ADR 0026](0026-promocion-1x2-y-listado-regalo.md) (diseño original de "1+2"/regalo,
  sustituido aquí), [ADR 0015](0015-nivel-bidones-cubas-neto.md)/
  [ADR 0016](0016-nivel-netos-bonus.md) (origen de "Bidones y Cubas Neto"/Netos Bonus).
