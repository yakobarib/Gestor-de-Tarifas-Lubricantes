# ADR 0028 — Scroll dentro de `.app-main`, no de la página, para que la barra lateral y el header no se muevan

**Fecha:** 2026-08-10
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Reglas es la única pantalla cuyo contenido puede superar la altura del viewport (dos
tarjetas — PVP y Netos Bonus — con tabla de margen por formato, más larga cuantos más
formatos tenga la marca). Yako lo detectó por captura: al hacer scroll en Reglas, la barra
lateral "se sube" con el resto de la página, en vez de quedarse fija como pasa en las
demás pantallas.

Causa: la barra lateral usaba `position: sticky; top: 0.75rem; height: calc(100vh -
1.5rem)`. Con `sticky`, el rango en el que un elemento se queda "pegado" al hacer scroll
está limitado a la altura de su propia caja — y esa caja mide casi un viewport completo
(`100vh - 1.5rem`). En pantallas cortas eso es indistinguible de estar fija todo el rato,
pero en cuanto el scroll total de la página supera esa altura (como en Reglas con muchos
formatos), el `sticky` se "despega" y la barra empieza a desplazarse con el resto.

## Decisión

En vez de sticky, se invierte quién hace scroll: la página (`html`/`body`) deja de
desplazarse — `overflow: hidden` — y es `.app-main` (el contenido de la pantalla activa,
hermano de `.sidebar` dentro de `.app-shell`) quien tiene su propio scroll interno
(`overflow-y: auto`), con `.app-shell` fijado a `height: 100vh` en vez de `min-height`.
Como `.sidebar` y `.app-main` son hermanos flex con `align-items: stretch`, los dos miden
siempre exactamente el alto del viewport — la barra lateral nunca necesita
"pegarse" porque, sencillamente, nunca se mueve: no hay contenedor exterior que se
desplace debajo de ella.

En el media query de móvil (`max-width: 860px`, donde la barra pasa a ser una franja
horizontal arriba, no una columna) se revierte todo a scroll de página normal
(`height: auto`, `overflow: visible`) — ahí no hay nada que proteger de moverse, y el
scroll de página es el comportamiento esperado.

## Verificación

Probado en navegador con Castrol importado (tabla de formato larga en Reglas, contenido
de `.app-main` de ~2180px de alto sobre un viewport de ~700px): tras desplazar `.app-main`
hasta el final, la posición de `.sidebar` (`getBoundingClientRect()`) es idéntica antes y
después — no se mueve un píxel — mientras que `.app-main` sí registra el scroll interno.
`document.documentElement.scrollTop` se mantiene en 0 todo el tiempo (la página en sí
nunca se desplaza). Las otras 4 pantallas siguen sin necesitar scroll (ya tenían sus
propias tablas con scroll interno acotado, `.table-wrap { max-height: 66vh }`). En móvil
(375px), el scroll de página vuelve a funcionar con normalidad.

## Decisión 2 — El header (título + iconos) también fijo, dentro de `.app-main`

Yako pidió, de paso, que el título de la pantalla activa y los iconos de tema/ayuda/
ajustes/login (`.app-header`, dentro de `.app-main`) tampoco se movieran al hacer scroll
en Reglas. A diferencia de la barra lateral, aquí `position: sticky; top: 0` sí es la
solución correcta y suficiente: el problema anterior de sticky era que el rango de "pegado"
está limitado a la altura de la propia caja, y `.app-header` es pequeño (~90px) frente al
contenido que hay debajo — se queda pegado durante todo el scroll sin ningún límite
práctico. Se le añade `background: var(--page-bg)` (el mismo fondo de la página, para que
el contenido no se vea "a través" al pasar por debajo) y `z-index: 5` (por encima de las
tarjetas normales, por debajo de modales).

## Consecuencias

- `css/styles.css`: `html, body` pasan de `overflow-x: hidden` a `height:100%;
  overflow:hidden`; `.app-shell` de `min-height:100vh` a `height:100vh`; `.sidebar` pierde
  `position/top/align-self/height` (ya no le hacen falta); `.app-main` gana
  `height:100%; overflow-y:auto; overflow-x:hidden`; `.app-header` gana
  `position:sticky; top:0; z-index:5; background:var(--page-bg)`. Media query de móvil
  añade el reverso de los cambios de `.app-shell`/`.sidebar`/`.app-main` (el header sigue
  sticky en móvil, sin problema — su contenedor de scroll pasa a ser la página, pero sigue
  siendo pequeño frente al contenido).
- Ningún JS dependía de la posición de scroll de `document.body`/`window` (comprobado, no
  hay llamadas a `scrollTo`/`scrollTop` en `js/`), así que no hace falta tocar nada más.

## Referencias

- `css/styles.css`.
