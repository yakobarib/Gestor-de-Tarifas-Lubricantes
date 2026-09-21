# ADR 0079 — El filtro de formato en Exportación no perdía el dato, solo la selección visual

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

## Verificación

- `node --check` sobre `screen-export.js`.
- Revisados los otros dos filtros de Exportación (`exportStatusFilter`,
  `exportSearchInput`) — ninguno reconstruye sus opciones dinámicamente, así que no
  tenían este mismo problema.

## Referencias

- ADR 0073 (mismo bug, en el desplegable de Tipo de exportación).
- `js/screens/screen-export.js`.
