# ADR 0064 — Plantilla por marca, familia "Bidones y Cubas" y PDF de políticas narrativo

**Fecha:** 2026-08-27
**Estado:** Aceptada
**Decidido por:** Yako (relayando pedido de su jefe)

## Contexto

El jefe de Yako, tras ver la app, pidió tres cosas. Aclarado con Yako antes de diseñar:

1. Que el margen/1+2/PVP Neto "persista entre reinicios y sea igual para cualquier
   usuario" — la parte de sincronización **ya estaba resuelta** (ADR 0062). Lo que
   faltaba de verdad: una **plantilla por defecto por marca** — guardar la configuración
   vigente como plantilla, y un botón para volver a ella.
2. Un PDF de políticas de precios "muy muy detallado" — el que ya existía
   (`exportPolicyPdf`, ADR 0041) resumía en tabla, siempre "todas las gamas" de una
   marca. Yako pidió un documento **narrativo, por marca y gama concreta** (la
   seleccionada en Reglas), con una línea por formato.
3. Una familia nueva **"Bidones y Cubas"** (no viene en ninguna tarifa, inventada por el
   equipo) para formatos grandes, que Skrit trata de forma especial — confirmado con
   Yako: columna nueva y **separada** en los exports, sin tocar la FAMILIA del
   proveedor. Investigado a fondo (ver plan): un único corte de litros no vale — Repsol
   guarda su bidón de 180kg como `formatKey` `"180"` (no lo convierte a 208L para el
   cálculo, a diferencia de Castrol/Eni), así que un umbral tipo "≥185L" se lo saltaría.

## Decisión

### A. "Bidones y Cubas" — checkbox por formato real

`cfg.bigContainerFormats = { [formatKey]: true }`, hermano de `priceLevels` en el mismo
blob que ya sincroniza `pricing_rules` (Fase 2, sin cambios de esquema). Fila de toggles
nueva en Reglas (`#bigContainerSection`, mismo patrón `format-toggle-btn` que "1+2"/"PVP
Neto"), fuera de las tarjetas de nivel — no es una regla de margen. Columna nueva
"BIDONES Y CUBAS" (SÍ/vacío) **al lado de FAMILIA, sin tocarla**, en `exportSkritLean`/
`exportSkritV2` (Excel) y las previsualizaciones "skrit"/"netos_bonus" en pantalla
(Exportación).

### B. Plantilla por defecto por marca

Reutiliza `pricing_rules` con `gama = '__default_template__'` (sentinel reservado, nunca
una gama real — mismo esquema, sin migración). `RulesStore.loadTemplate(brandId)`/
`saveTemplate(brandId, cfg)`. Dos botones nuevos en Reglas: **"Establecer como plantilla
por defecto"** (guarda el `cfg` del scope actual — gama sola o "Todas las gamas" — como
plantilla de la marca) y **"Volver a la plantilla por defecto"** (aplica la plantilla al
scope actual, con confirmación — avisa si la marca no tiene plantilla todavía).

### C. PDF de políticas — narrativo, por marca y gama concreta

La exportación de **una marca** (no "todas") pasa a usar la gama seleccionada en pantalla
(antes forzaba siempre "todas las gamas") — WYSIWYG con Reglas. `exportAllPoliciesPdf`
("todas las marcas") se queda igual. `exportPolicyPdf` reescrito: cabecera "Políticas de
precios de la marca X para la gama Y a día de Z", base de coste/modo/redondeo en una
línea (sin "margen por defecto"), y una lista con guiones por formato (margen %, "1+2"/
"PVP Neto" solo si están ACTIVOS para ese formato, "Bidones y Cubas" si está marcado),
igual para PVP y Netos Bonus. Nota final si la config actual difiere de la plantilla de
la marca (comparación simple por `JSON.stringify`, no diff campo a campo — v1). A4
vertical con paginación automática (antes A4 apaisado, dos tablas fijas en una hoja).

**Bug real encontrado y corregido de paso**: `effectiveMarginInfo` (ya existía, usado por
el PDF viejo también) montaba una fila ficticia con `costFactura`/`costNetoNeto`/
`costTripleNeto` a 100, pero un nivel PVP recién sintetizado o con "Coste factura"
elegido a mano tiene `baseCostField: 'costPerPack'` (no `'costFactura'` — ver
`Migration.synthesizePvpLevel`/`updateLevelField`), así que el margen salía **"—" para
el caso más común de todos**, tanto en el PDF viejo como en el nuevo si no se arreglaba.
Corregido añadiendo `costPerPack: 100` a la fila ficticia.

## Ficheros

**Modificar:** `js/screens/screen-rules.js` (toggle Bidones y Cubas, 2 botones de
plantilla, `gatherBrandPolicy`/`doExportPolicies` con gama real, `GAMA_LABELS`/
`gamaLabelFor` compartidos), `js/core/rules-store.js` (`loadTemplate`/`saveTemplate`),
`js/export/excel-writer.js` (columna nueva en `exportSkritLean`/`exportSkritV2`),
`js/screens/screen-export.js` (columna nueva en 2 previsualizaciones, helpers
`bigContainerFormatsFor`/`bigContainerFormatsByGama`), `js/export/pdf-writer.js`
(`exportPolicyPdf` reescrito, `effectiveMarginInfo` corregido), `app/index.html`
(`#bigContainerSection`, `#btnSaveTemplate`, `#btnResetTemplate`).
**Sin cambios:** esquema Neon (reutiliza `pricing_rules`), `neon-rules.js`,
`js/core/pricing.js`, `js/core/migration.js` (concepto nuevo, sin datos históricos),
`exportAllPoliciesPdf`.

## Verificación

- `node --check` sobre todos los ficheros modificados.
- Pendiente de probar en la app real (sin acceso de login en esta sesión): marcar
  "Bidones y Cubas" en un par de formatos y exportar el Excel Skrit; establecer y volver
  a una plantilla; generar el PDF de políticas para una marca+gama concreta y comparar
  con lo configurado en Reglas — comprobar en particular que el margen ya NO sale "—"
  para el caso "Coste factura" (el bug corregido).
- Confirmar en Neon (acceso directo autorizado) que la plantilla y `bigContainerFormats`
  llegan a `pricing_rules` igual que cualquier otro cambio de reglas.

## Adenda (2026-08-27, mismo día) — PDF rehecho de nuevo: tabla, no prosa

El formato narrativo (guiones, prosa) de la sección C no era lo que el jefe de Yako quería
— tras ver el resultado, Yako especificó exactamente lo que hacía falta:

- **"Todas las marcas" deja de ser un resumen compacto**: pasa a ser **una hoja por
  marca**, con el mismo detalle que la exportación de una sola marca (antes: una fila por
  marca en una tabla única). `exportAllPoliciesPdf` ahora recorre `brandPolicies` y llama
  a un `renderBrandPolicyPage(doc, policy)` compartido por cada una, añadiendo página
  nueva salvo en la primera — mismo helper que usa `exportPolicyPdf` para una sola marca.
- **Tabla, no prosa** — columnas exactas pedidas por Yako para PVP: Formato / Coste
  (factura, neto-neto o triple-neto) / Tipo de margen (venta/compra) / Margen (%) /
  **Beneficio** (%, el margen REAL tras redondeo — `Pricing.compute`'s `realMarginPct`,
  ya existía, no se usaba en este PDF) / 1+2 ("Sí (permitido)"/"No (no permitido)") /
  **Bidones y Cubas** ("Neto" si el formato tiene el modo especial "PVP Neto" activo,
  "PVP" si no). **Importante**: esta última columna reusa el NOMBRE "Bidones y Cubas"
  pero para un concepto DISTINTO al de la sección A (la casilla nueva de exportación a
  Skrit) — es literalmente el interruptor "PVP Neto" que ya existía antes de hoy,
  renombrado en esta columna a petición explícita de Yako. Los dos conceptos conviven sin
  relacionarse: la casilla de exportación no aparece en este PDF.
  Netos Bonus con columnas equivalentes (Formato/Margen/Beneficio/Obsequio/Salida
  impresa), mismo patrón que el PDF anterior a ADR 0041.
- **"Diferencia con la plantilla por defecto" deja de ser una nota booleana** ("sí/no
  difiere") — ahora es una explicación real, campo a campo: `computeTemplateDiff(template,
  cfg)` compara base de coste/modo/margen por defecto/redondeo de ambos niveles, más cada
  entrada de `byFormat`/`formatModes`/`premiumByFormat`/`printFormats`/
  `bigContainerFormats`, y lista qué cambió ("PVP — margen: formato 20L: 30% → 35%.").
- `gatherBrandPolicy` (screen-rules.js) pasa a devolver `cfg`/`template` en crudo (antes
  solo un booleano `templateDiffers`) para que `pdf-writer.js` pueda construir ese diff.
  `PdfWriter.exportPolicyPdf`/`exportAllPoliciesPdf` pasan a recibir el objeto `policy`
  completo en vez de una lista larga de argumentos posicionales.

## Referencias

- ADR 0041 (PDF de políticas original).
- ADR 0062 (reglas de márgenes compartidas — Fase 2).
- Plan completo: `C:\Users\RIB\.claude\plans\playful-crafting-snail.md`.
