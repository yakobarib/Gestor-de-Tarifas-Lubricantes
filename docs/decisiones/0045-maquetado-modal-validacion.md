# ADR 0045 — Maquetado del modal de validación: ancho, alto y scroll único

**Fecha:** 2026-08-17
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras el ADR 0043/0044, Yako reporta tres problemas de maquetado en el modal de
validación de descripciones (pantalla Tarifas):

1. Litros de 4 cifras (1000) no cabían en su casilla.
2. Referencias anchas se partían en dos líneas ("RPG300BCH" + "C") y descripciones
   largas se cortaban a media palabra.
3. El propio modal tenía scroll doble: uno del modal entero y otro, dentro, de la lista
   de referencias — pedía que solo la lista scrollee, con el título, los avisos, las
   pestañas y el botón "Cerrar" siempre visibles sin tener que mover la ventana
   principal.

## Decisión

- **Casillas más anchas**: `.desc-validation-row` pasa de columnas `100px 1fr 1fr 70px
  auto` a `150px 1.3fr 1.3fr 100px auto` (litros, el problema original, de 70 a 100px);
  fuente y padding de inputs/botón suben de 0.82rem a 0.9rem.
- **Referencia y descripción sin partirse**: `.ref-col`/`.raw-col` cambian de
  `word-break: break-all` (partía a media palabra) a `white-space: nowrap` +
  `text-overflow: ellipsis` — con la columna ya más ancha, el caso normal cabe entero en
  una línea; solo si un día no cupiera se recortaría con "…" en vez de partirse.
- **Modal más ancho**: `.modal-wide` de 780px→900px→**1180px** (dos iteraciones, hasta
  que las referencias/descripciones de la captura de Yako cupieran enteras).
- **Un solo scroll**: `.modal` (la clase base, usada también por el modal de
  "Referencias desaparecidas") lleva `overflow: auto; max-height: 80vh` — con contenido
  variable (título + avisos + pestañas + lista + botón) eso podía hacer scrollar el
  modal ENTERO además de la lista, que ya scrollea por su cuenta. `.modal-wide` pasa a
  `display: flex; flex-direction: column; height: 88vh; max-height: 88vh; overflow:
  hidden` — el título/avisos/pestañas/botón se quedan a su tamaño natural
  (`flex: 0 0 auto`) y `.desc-validation-list` crece para ocupar todo el resto
  (`flex: 1 1 auto; min-height: 0; max-height: none` — anula el `max-height: 55vh` de la
  regla base, que si no seguía capando la lista aunque hubiera más hueco disponible).

## Verificación

Con 47 referencias pendientes: el modal mide exactamente 88vh y **no** necesita scroll
de sí mismo (`scrollHeight === clientHeight`); la lista sí lo necesita
(`scrollHeight` 3290px contra 233px visibles) y es la única que scrollea. Título,
pestañas y botón "Cerrar" quedan dentro de los límites del modal en cualquier punto.
Con referencias reales de la captura de Yako ("RPG300BCHC", "EXTREME 4T 5W-40 12X1L"):
ninguna se recorta (`scrollWidth <= clientWidth` en ambas columnas) y la referencia ya
no se parte en dos líneas. Litros "1000" cabe sin recortarse. Consola sin errores en
todas las pruebas.

## Consecuencias

- `app/css/styles.css`: `.modal-wide`, `.desc-validation-row` y columnas hijas.
- Sin cambios en HTML/JS — es un ajuste puramente de maquetado sobre el modal ya
  construido en el ADR 0043/0044.

## Referencias

- `app/css/styles.css`.
- [ADR 0043](0043-maestro-de-descripciones-verificadas.md) (panel de validación
  original), [ADR 0044](0044-consistencia-sufijo-litros-editar-validadas.md) (pestañas
  Pendientes/Ya validadas).
