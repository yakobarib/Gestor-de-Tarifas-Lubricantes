# ADR 0070 — Netos Gasolineras (copia de Netos Bonus) + selector de nivel en Reglas

**Fecha:** 2026-08-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tres peticiones relacionadas:

1. **Exportación**: título "Exportar a Skrit" → "Exportar Tarifas" (hay varios modos de
   exportar, no solo para Skrit).
2. **Nueva tarifa "Netos Gasolineras"**: un tercer nivel de precio fijo, además de PVP y
   Netos Bonus — "copia el patrón de Netos Bonus, es prácticamente lo mismo, si luego
   quiero modificar algo ya te diré". Debe aparecer en el desplegable de Exportación como
   "Netos Gasolineras (uso interno)".
3. **Selector de nivel en Reglas**: con 3 niveles fijos, mostrarlos todos a la vez ocupaba
   demasiada pantalla — Yako pidió un selector para ver uno solo cada vez, y que la
   leyenda explicativa (antes un único párrafo describiendo PVP y Netos Bonus juntos)
   pasara a explicar solo el nivel visible.

## Decisión

**Netos Gasolineras** (`screen-rules.js`): nuevo `defaultNetosGasolinerasLevel()`,
literalmente igual que `defaultNetosBonusLevel()` (mismo `costCascade`, `mode: 'sale'`,
`defaultMargin: 20`, `goesToSkrit: false`) salvo `id`/`label`. `migrateLevels()` la da de
alta perezosamente (igual que ya hacía con Netos Bonus) la primera vez que se abre esa
marca/gama en Reglas después de este cambio — orden final `['pvp', 'netos_bonus',
'netos_gasolineras']`.

**Generalización en vez de duplicar código**: en lugar de añadir un tercer `if (lvl.id ===
'netos_gasolineras')` en cada sitio, se generalizó "cualquier nivel que no sea PVP se
comporta como Netos Bonus" — `formatTableHtml`/`levelCardHtml` en `screen-rules.js` ya
usan `lvl.id !== 'pvp'` en vez de comparar con `'netos_bonus'` explícitamente. Esto deja
la puerta abierta a copiar el patrón otra vez en el futuro sin tocar este código. En
`screen-export.js`, donde el patrón SÍ estaba más entrelazado con el Excel/PDF de "PVP
(Bonus)" (exclusivo de Netos Bonus, no pedido para Gasolineras), se optó por ampliar
literalmente las dos condiciones que hacía falta (`key === 'netos_bonus' ||
key === 'netos_gasolineras'`) en vez de generalizar del todo — el desplegable de tipos de
exportación en sí ya era genérico (cualquier nivel no-PVP cae en la rama `else` y sale
listado solo, sin tocar código) y no necesitó cambios.

**Selector de nivel** (`screen-rules.js` + `index.html`): nuevo `<select
id="rulesLevelSelect">` (mismo patrón que Marca/Gama), estado `currentLevelId` (por
defecto `'pvp'`). `renderLevels()` ya no pinta las 3 tarjetas de golpe — busca el índice
real del nivel elegido dentro de `cfg.priceLevels` (necesario porque
`updateLevelField`/`updateByFormat`/etc. escriben por índice) y pinta solo esa. La leyenda
(`<p id="rulesLevelLegend">`, antes texto fijo en `index.html`) se rellena desde JS con
`LEVEL_LEGENDS[currentLevelId]` — un texto por nivel en vez de uno combinado.

**Ayuda integrada** (`screen-help.js`): actualizada para mencionar Netos Gasolineras y el
selector; de paso corregido un texto que ya estaba desactualizado ("PVP (Venta)" → "PVP
(Datos)", pendiente desde el cambio de nombre anterior, ver ADR 0069).

**Fuera de alcance de este cambio** (no pedido): el PDF de "Políticas de Precios"
(`pdf-writer.js`) sigue mostrando solo PVP y Netos Bonus — `gatherBrandPolicy` ya expone
`gasolineras` por si se pide más adelante, pero el PDF no lo usa todavía. Tampoco se tocó
`migration.js` (`clearUntouchedBonusSeed` es un fix histórico de un bug de semilla
exclusivo de Netos Bonus, sin equivalente en un nivel nuevo sin datos históricos).

## Efecto práctico para Yako

Una marca que ya tuviera configurada Reglas antes de este cambio no mostrará "Netos
Gasolineras" en el desplegable de Exportación hasta que se abra esa marca en Reglas una
vez (con "Todas las gamas" seleccionada, para darla de alta en todas las gamas de golpe) —
mismo mecanismo de alta perezosa que ya existía para Netos Bonus.

## Verificación

- `node --check` sobre `screen-rules.js`, `screen-export.js`, `screen-help.js`.
- Revisado a mano cada uso de `'netos_bonus'` en el código (`grep`) para decidir, caso a
  caso, si generalizar o ampliar literalmente — nada se dejó sin decidir explícitamente.

## Referencias

- ADR 0026 v2 (patrón "niveles fijos, sin añadir/quitar" del que nace Netos Bonus).
- ADR 0034/0039 (vista mínima de Netos Bonus, PDF "PVP Bonus").
- ADR 0069 (renombrado "PVP (Ventas)" → "PVP (Datos)").
- `js/screens/screen-rules.js`, `js/screens/screen-export.js`, `js/screens/screen-help.js`.
