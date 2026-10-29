# ADR 0090 — Comparación individual: las tarjetas se salían de su cuadro

**Fecha:** 2026-10-29
**Estado:** Aceptada
**Decidido por:** Yako (detectado al revisar la ficha de equivalencias)

## Contexto

En Comparación → Individual, las tarjetas de equivalencias (una por marca) sobresalían por
debajo del cuadro que las contiene: el fondo del cuadro terminaba y las tarjetas seguían
fuera de él.

## Causa

Regresión mía del ADR 0083 (v1.0.43): para que el Ranking completo ocupara todo el alto
disponible y solo hiciera scroll la tabla, añadí a `#screen-compare` y a su `<article>`
`flex: 1; min-height: 0` (patrón de Exportación). Pero esa regla se aplicaba SIEMPRE, también
en la vista individual, cuyo contenido no es una tabla con scroll propio: con `min-height: 0`
el artículo se encogía al alto de la ventana y las tarjetas (más altas) desbordaban su caja.
Medido en un arnés con la estructura real: con esas reglas las tarjetas sobresalían 574 px del
cuadro.

## Decisión

Las reglas de "ocupar el alto de la pantalla" solo se aplican con la clase `.ranking-mode`
sobre `#screen-compare`, que pone/quita `setCompareMode()`. La vista individual vuelve a su
alto natural (con scroll de la ventana si hace falta). El Ranking conserva el comportamiento
del ADR 0083.

## Verificación

Arnés con el markup real de la sección y 5 tarjetas, ventana de 530 px de alto:

- Individual: las tarjetas quedan dentro del cuadro (borde inferior del cuadro 39 px por
  debajo de las tarjetas); la ventana hace scroll.
- Reglas antiguas forzadas a mano: las tarjetas sobresalen 574 px (reproduce el fallo).
- Ranking (120 filas): la ventana NO hace scroll (`scrollHeight == clientHeight`) y la tabla
  sí, por dentro.

No probado en la app real (requiere login).
