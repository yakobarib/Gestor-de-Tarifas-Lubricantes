# ADR 0082 — Checklist "Formatos a exportar" en Exportación

**Fecha:** 2026-09-28
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako pidió, en Exportación, poder marcar/desmarcar qué formatos entran en el fichero
exportado — algo más potente que el filtro de "Formato" ya existente (de un solo valor,
pensado para MIRAR uno concreto en pantalla, no para excluir varios a la vez del
export). Dos preguntas abiertas antes de implementar, ambas resueltas por Yako:

1. **Ubicación**: en línea en la barra de filtros (entre "Fecha tarifa" y "Exportar"),
   no como paso intermedio al pulsar Exportar — coherente con el resto de la pantalla,
   que ya funciona así (cambiar un filtro actualiza la tabla al momento).
2. **¿Convive con el filtro de "Formato" actual?** Sí, se quedan los dos — el filtro de
   un valor es para "ver e imprimir uno o todos los formatos"; el checklist nuevo es
   para "ser selectivo con la exportación final".
3. **¿El checklist también filtra la vista previa?** Sí — confirmado que no complicaba
   nada, porque la tabla y la exportación ya comparten la misma función de filtrado
   (`visibleRows()`), así que añadir un criterio ahí basta para que ambas queden
   sincronizadas sin tocar nada más.

## Decisión

Nuevo campo en la barra de Exportación: un botón ("Todos los formatos" / "N de M
formatos" / "Ningún formato", según el estado) que abre un panel flotante con una
casilla por formato (más "Todos"/"Ninguno" como atajos) — no un `<select multiple>`
nativo, poco intuitivo sin ctrl/cmd-click y con mal soporte táctil.

`visibleRows()` (`screen-export.js`) gana un criterio más: `checklistFormats` (un `Set`
de formatos marcados) — si existe y una fila no está en él, se excluye, igual que ya
hacen `filter.format`/`filter.status`. Como tanto la previsualización
(`renderPreviewTable`) como `doExport()` ya parten de `visibleRows()`, quedan
sincronizadas automáticamente, sin ningún cambio extra en la exportación en sí.

**Cuándo se reinicia a "todo marcado"**: no en cada `renderPreview()` (que también se
llama en cada `rules:changed`, ej. tocar un margen en Reglas para la misma marca/gama —
resetear ahí tiraría a la papelera una selección cuidada solo por editar un precio).
Se compara una "firma" de las claves de formato disponibles (`keys.join(',')`) contra la
anterior — solo si de verdad cambia (cambio real de marca/gama/tipo) se reinicia el
checklist; si son las mismas claves de antes, se conserva tal cual estaba. Probado en
aislado: se preserva tras un `rules:changed` de la misma marca, se reinicia al cambiar
de marca.

## Verificación

- `node --check` sobre `screen-export.js`.
- Simulado en Node el ciclo completo (render inicial → desmarcar un formato →
  `rules:changed` de la misma marca, debe conservar la selección → cambio de marca,
  debe reiniciar a "todo marcado") — los cuatro pasos se comportan como se esperaba.
- No se puede probar visualmente desde aquí (la app exige login real) — pendiente de
  que Yako lo confirme en el navegador.

## Referencias

- ADR 0031/0034 (WYSIWYG — la previsualización siempre muestra lo que se exporta).
- ADR 0079 (mismo principio de no perder selección en un `<select>` reconstruido).
- `js/screens/screen-export.js`, `app/index.html`, `app/css/styles.css`.
