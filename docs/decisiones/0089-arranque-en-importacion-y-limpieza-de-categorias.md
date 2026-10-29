# ADR 0089 — Arranque siempre en Importación, tarjetas sin esperar a la red y purga de categorías retiradas

**Fecha:** 2026-10-29
**Estado:** Aceptada
**Decidido por:** Yako (detectado al recargar la app)

## Contexto

Yako notó tres cosas al recargar la app:

1. Estando en Comparación y recargando, la app arrancaba en Importación y "seguidamente se
   iba sola" a Comparación.
2. Al arrancar aparecían primero las zonas de rebranding y equivalencias, y mucho después
   las tarjetas de cada marca con sus fechas.
3. En Importación consta la tarifa de Castrol (459 refs), pero en Comparación una
   referencia de Castrol salía "sin tarifa importada".

## Causas

1. `Router.init()` hacía `show(current())`, y `current()` lee el hash de la URL (`#compare`),
   que el navegador conserva al recargar. Mientras `finishBoot()` esperaba a la red, el HTML
   estático mostraba Importación; al terminar, el router saltaba a la pantalla del hash.
2. Las tarjetas se pintan en `ScreenImport.init()`, que solo se llama al final de
   `finishBoot()`, tras ~6 awaits de red (maestro, 3 migraciones, tarifas, reglas,
   equivalencias). Pero `renderBrandCards()` únicamente lee metadatos locales
   (`import_meta_*` en localStorage) — no necesitaba esperar. No es una regresión del
   rediseño del ADR 0087: el orden de arranque era el mismo, solo se hizo más visible.
3. **No es un fallo**: la referencia (143AB3, aceite hidráulico) no existe en la tarifa de
   Castrol importada ni en ninguna otra marca. 36 de las 154 refs de Castrol que aparecen en
   las equivalencias actuales no están en la tarifa (16 de ellas hidráulicos 143xxx/144xxx;
   el resto de Transmisión, Vehículo Pesado/Ligero/Eléctrico). La tarifa de Castrol no trae
   esa gama. "Sin tarifa importada" es correcto.

Hallazgo adicional, comprobado en Neon (solo lectura): el índice de equivalencias seguía
conteniendo las categorías antiguas (`aceites` 218 grupos, `motor_industrial` 44,
`transmision_ejes` 43) además de las 7 vigentes, porque `build()` fusiona por categoría y
nada las retiraba (ver actualización del ADR 0085). Eso duplica grupos en el Ranking y hace
que la ficha individual elija entre versiones antigua y nueva según el orden.

## Decisión

- **Router**: `init()` arranca siempre en Importación (`show('import')`), ignorando el hash
  inicial. La navegación en sesión (menú, atrás/adelante) sigue usando el hash. Si se prefiere
  conservar la pantalla al recargar, basta volver a `show(current())`, pero entonces habría que
  mostrar esa pantalla desde el primer instante para evitar el salto.
- **Tarjetas**: `app.js` llama a `ScreenImport.renderBrandCards()` al inicio del
  `DOMContentLoaded`, antes de `Auth.init()` y de la red. `init()` las vuelve a pintar luego.
- **Categorías retiradas**: `EquivalenceReader` exporta `KNOWN_CATEGORIES` y
  `EquivalenceIndex.build()` descarta del índice cacheado los grupos de cualquier categoría
  fuera de esa lista, además de reemplazar las que llegan en la importación. Reimportar un
  fichero basta para purgar las antiguas, sin pasar por "Vaciar equivalencias" (que sigue
  existiendo). Al añadir una categoría nueva a `readKnownFile` hay que añadirla también a
  `KNOWN_CATEGORIES`.

## Verificación

- Router con DOM simulado y URL `#compare`: arranca en `import`; la navegación posterior a
  `#compare` funciona.
- `build()` con un índice cacheado que contenía `aceites`/`motor_industrial`/
  `transmision_ejes` + `grasas`/`vehiculo_ligero`, reimportando solo `vehiculo_pesado`: quedan
  `grasas`, `vehiculo_ligero` y `vehiculo_pesado`; las antiguas desaparecen y su refs ya no se
  encuentran.
- No probado en la app real (requiere login).

## Pendiente (no hecho)

- Las tarjetas leen `import_meta_*` de localStorage, que solo escribe el PC que importa: en
  otro ordenador (o tras borrar datos del navegador) mostrarían "sin importar" aunque las
  tarifas estén en Neon. Se podría derivar de las filas compartidas (`cost_factura_imported_at`),
  pero el recuento no coincidiría exacto con el de la importación (las filas se acumulan entre
  importaciones). Pendiente de que Yako decida.
