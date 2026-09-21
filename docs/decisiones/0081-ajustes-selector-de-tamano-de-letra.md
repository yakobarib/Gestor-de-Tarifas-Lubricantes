# ADR 0081 — Pantalla de Ajustes: selector de tamaño de letra (3 tamaños)

**Fecha:** 2026-09-21
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

El botón "Ajustes" del header no hacía nada todavía (solo un aviso "próximamente").
Yako pidió un selector de tamaño de letra con tres opciones, siendo el tamaño actual de
la app el más grande de las tres (es decir, las dos opciones nuevas son más pequeñas,
no se añade nada más grande).

## Decisión

**Nuevo módulo `fontsize.js`**, mismo patrón que `theme.js` (ADR previo, sin número
propio — toggle claro/oscuro): un `data-font-size` explícito en `<html>`, persistido en
`Storage` (localStorage). "Grande" es la ausencia del atributo (el tamaño de siempre, sin
tocar nada); "Mediano" y "Pequeño" fijan `font-size: 90%` / `80%` en `:root` — comprobado
antes de este cambio que **toda la hoja de estilos mide en `rem`** (ni un solo
`font-size` en `px`), y `rem` siempre es relativo a `<html>`, así que una sola regla CSS
escala de golpe cualquier texto de la app entera, sin tener que tocar cada componente
suelto.

**Nueva pantalla modal `#modalSettings`** (mismo patrón que `#modalObsolete`): un
selector de 3 botones (`.mode-toggle`/`.mode-btn`, el mismo estilo ya usado para el modo
de margen y las pestañas de gama) — Pequeño/Mediano/Grande. El botón "Ajustes" del
header abre este modal en vez de mostrar el aviso de "próximamente"; `FontSize.init()` se
llama en el arranque (`app.js`, junto a `Theme.init()`) para aplicar la preferencia
guardada antes de que se pinte nada.

## Verificación

- `node --check` sobre `fontsize.js` y `app.js`.
- Confirmado por grep: cero `font-size` en `px` en `styles.css`, cero también en HTML/JS
  (nada que se saltara el escalado por `rem`).
- No se puede probar visualmente desde aquí (la app exige login real, sin credenciales
  en esta sesión) — pendiente de que Yako lo confirme en el navegador.

## Referencias

- `js/core/theme.js` (patrón que se copia).
- `js/core/fontsize.js`, `js/app.js`, `app/index.html`, `app/css/styles.css`.
