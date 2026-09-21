# ADR 0079 — El filtro de formato no perdía el dato, solo la selección visual (Exportación y Tarifas)

**Fecha:** 2026-09-21
**Estado:** Aceptada
**Decidido por:** Yako (bug real reportado)

## Contexto

Yako reportó: en Exportación, con un formato concreto elegido en el filtro (ej. "208L"),
si iba a Reglas a cambiar un margen y volvía, el desplegable de formato aparecía en
"Todos los formatos" pero la tabla seguía filtrada solo a 208L — y no había forma de
quitar el filtro, porque volver a elegir "Todos los formatos" ya era lo que el
desplegable mostraba (no disparaba ningún cambio).

Mismo patrón exacto que ADR 0073 (el desplegable de "Tipo de exportación"), sin
arreglar en este segundo sitio: `renderFormatFilter()` reconstruye las `<option>` del
`<select>` de formato en cada `renderPreview()` — que se llama, entre otras veces, desde
el listener de `rules:changed` (cualquier cambio en Reglas de la marca actual). El
propio comentario del código ya avisaba de que reconstruir el `<select>` lo deja sin
selección, pero solo ajustaba el resaltado visual (`filter-active`), no restauraba el
valor — así que `filter.format` (la variable de estado real, la que de verdad filtra las
filas) seguía teniendo "208" aunque el `<select>` mostrara vacío.

## Decisión

`renderFormatFilter()` (`screen-export.js`): tras reconstruir las opciones, restaura
`sel.value = filter.format` — si ese formato ya no existe entre las filas actuales
(cambio de marca/gama, por ejemplo), se limpia también `filter.format` para que el
desplegable y el filtro real vuelvan a coincidir. Mismo criterio que la restauración de
`currentOption` en `renderExportOptions()` (ADR 0073).

## Actualización 2026-09-21 — misma auditoría, un sitio más

Yako pidió revisar si el mismo comportamiento se repetía en otros selectores. Revisados
los cuatro ficheros que reconstruyen `<option>` dinámicamente (`screen-export.js`,
`screen-tarifas.js`, `screen-rules.js`, `screen-compare.js`):

- **Tarifas** (`renderFormatFilter()`, `screen-tarifas.js`): **mismo bug real**, sin
  arreglar hasta ahora. Se llama desde tres sitios que NO deberían resetear el filtro
  (editar los litros a mano en la propia tabla, validar o descartar una referencia en el
  panel de validación) — corregido con el mismo criterio que Exportación. Los otros
  cuatro sitios que la llaman (`renderBrandSelect`, `switchGama`, `jumpToLoaded`, el
  listener de cambio de marca) sí representan un cambio real de marca/gama, donde
  resetear el filtro es lo esperado — no se tocan.
- **Reglas** (`renderGamaSelect()`): ya restauraba `sel.value = currentGama`
  explícitamente — sin bug.
- **Comparación** (`renderBrandSelect`/`renderGamaSelect`/`renderRefOptions`): se
  reconstruyen en cada visita a la pantalla (`screen:changed`), pero el estado
  (`currentBrandId`/`currentGama`) se resetea EN el mismo sitio, a la vez que el
  `<select>` — no hay desajuste entre lo que se ve y lo que de verdad filtra, así que no
  es este bug (como mucho, una pérdida de comodidad al volver a la pantalla, no un dato
  "atascado" invisible).

## Actualización 2026-09-21 (2) — Comparación, inconsistencia relacionada

Yako probó Comparación y encontró un problema hermano de este, aunque no idéntico: al
volver a la pantalla, la Marca se conservaba, la Gama y la Referencia se reseteaban
(`currentGama` volvía a la primera gama de la marca, `compareRefSelect` a "Elige una
referencia…"), **pero las tarjetas de resultado de la búsqueda anterior se quedaban en
pantalla** — dando la impresión de que ese resultado correspondía a los selects recién
reseteados, cuando en realidad era de la búsqueda de antes de irse a otra pantalla.

Decisión de Yako, explícita: mejor pedir Marca/Gama/Referencia cada vez (aunque suponga
un clic de más) que dejar un estado a medias que no coincide con lo que se ve. Cambio en
`screen-compare.js`: el listener de `screen:changed` para `'compare'` ahora resetea
`currentBrandId`/`currentGama`/`currentRef`/`lastShown`, vacía `compareRefInput` y limpia
`compareResult`, antes de volver a pintar el selector de marca — reinicio completo, sin
memoria parcial.

## Verificación

- `node --check` sobre `screen-export.js`, `screen-tarifas.js` y `screen-compare.js`.
- Revisados los otros dos filtros de Exportación (`exportStatusFilter`,
  `exportSearchInput`) — ninguno reconstruye sus opciones dinámicamente, así que no
  tenían este mismo problema.

## Referencias

- ADR 0073 (mismo bug, en el desplegable de Tipo de exportación).
- `js/screens/screen-export.js`, `js/screens/screen-tarifas.js`, `js/screens/screen-compare.js`.
