# ADR 0066 — Detalles de Exportación y Comparación: PVP manual en todas las vistas, tarjetas en rejilla, beneficio en €

**Fecha:** 2026-08-27
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Serie de ajustes pequeños pedidos tras revisar la app en marcha, agrupados en un solo
cambio a petición de Yako (para no mezclar detalles de diseño con la investigación de un
posible error de datos aparte, ver conversación).

## Decisión

1. **Exportación — orden y nombre del tipo**: "PVP (Skrit)" pasa a ser la primera opción
   del desplegable (antes segunda); "PVP (Venta)" se renombra a "PVP (Ventas)" (plural) y
   pasa a segunda posición. Como el `<select>` sin "selected" explícito toma el primer
   `<option>`, esto también cambia cuál es el tipo de exportación por defecto al abrir la
   pantalla — pasa a ser Skrit.

2. **PVP manual disponible en cualquier vista con PVP, no solo "PVP (Ventas)"**: antes
   solo la tabla rica de "PVP (Ventas)" tenía la casilla para fijar un precio a mano — las
   vistas de "PVP (Skrit)" y "Netos Bonus (uso interno)" eran de solo lectura. Yako señaló
   que su jefe (y otros usuarios) van a querer fijar precios a mano desde la pestaña que
   tengan abierta, no solo desde "Ventas". Como el dato (`level.manualOverride[ref]`) ya
   era compartido entre todas las vistas de un mismo nivel — solo faltaba la casilla en
   pantalla — se añadió la misma columna "PVP manual" a las 3 vistas
   (`js/screens/screen-export.js`, nuevos helpers compartidos `manualPvpInputHtml`/
   `bindManualPvpInputs` en vez de repetir el HTML/listener 3 veces). Al guardarse, ya se
   refleja igual en el Excel exportado de esa vista (mismo `Pricing.compute` de siempre).

3. **Aviso visual de PVP fijado a mano**: nueva clase `.manual-pvp-input.is-manual` (fondo
   ámbar llamativo, ver `app/css/styles.css`) en la propia casilla cuando ya tiene un
   valor — antes solo cambiaba de color el PVP calculado al lado (`c.isManual`), no la
   casilla de entrada en sí, así que un precio manual podía pasar desapercibido al mirar
   solo la columna de inputs.

4. **Comparación — tarjetas en rejilla**: las tarjetas de "Equivalencias de {ref}" se
   colocan una al lado de otra (`display: grid`, `auto-fill`), no apiladas en una columna
   larga — más fácil comparar varias marcas de un vistazo. `js/screens/screen-compare.js`
   envuelve las tarjetas en `<div class="compare-members-grid">`; `.compare-member` pasa
   de "fila con borde inferior" a tarjeta propia (fondo, borde, sombra — mismo estilo que
   `.level-card` de Reglas).

5. **Comparación — beneficio en €**: cada tarjeta añade una fila `compare-member-gains`
   con el beneficio en € por nivel (mismo `c.gain` que ya calculaba `Pricing.compute`,
   nada nuevo que calcular) — verde, debajo de la fila de costes y de la de PVP.

## Ficheros

**Modificar:** `app/js/screens/screen-export.js` (reorden/rename dropdown, helpers
compartidos de PVP manual, columna nueva en 2 vistas), `app/css/styles.css` (clase
`.manual-pvp-input.is-manual`, `.compare-members-grid`, `.compare-member` como tarjeta,
`.chip.gain`), `app/js/screens/screen-compare.js` (rejilla + fila de beneficio).
**Sin cambios:** `js/core/pricing.js`, esquema de datos (`manualOverride` ya existía por
nivel, solo se añadió UI para tocarlo desde más sitios).

## Verificación

- `node --check` sobre los 2 ficheros JS modificados.
- Pendiente de revisar en la app real (Yako lo está haciendo en vivo): que "PVP (Skrit)"
  salga primero y por defecto; fijar un precio a mano desde "PVP (Skrit)"/"Netos Bonus" y
  confirmar que persiste igual que desde "PVP (Ventas)" y que se ve resaltado; que las
  tarjetas de Comparación se vean en rejilla; que el beneficio en € aparezca por marca.

## Referencias

- Conversación de esta sesión (2026-08-27) — mismo día que ADR 0065 (fórmula de PVP en
  dos pasos), que motivó revisar Exportación/Comparación con más detalle.
