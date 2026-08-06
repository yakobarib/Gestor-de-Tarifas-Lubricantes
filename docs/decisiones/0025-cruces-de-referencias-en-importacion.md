# ADR 0025 — Cruces de referencias (equivalencias) cargables desde Importación

**Fecha:** 2026-08-06
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Al repasar los cambios anteriores, Yako reportó varias incidencias:

1. En Tarifas, la columna "Estado" salía siempre vacía.
2. En Reglas, los campos de margen por formato se atropellaban con las descripciones.
3. En Reglas → "Añadir nivel", el preset por defecto era uno real (se podía añadir un
   nivel sin querer) — debería empezar en "Ningún nivel añadido".
4. La base de conocimiento de equivalencias (usada por Comparación) solo se podía
   cargar desde la propia pantalla Comparación — un problema real cuando se actualiza el
   fichero o se abre la app en otro ordenador, porque hay que recordar ir a esa pantalla
   concreta a recargarla.
5. El cuadro de rebranding explicaba también "para cargar la tarifa de un proveedor,
   usa la tarjeta de esa marca" — ruido que no pinta nada en un cuadro que ya es solo
   para rebranding.
6. Ese nuevo cuadro de equivalencias necesita su propia explicación de qué son los
   "cruces de referencias" entre marcas.

## Bug 1: "Estado" vacío en Tarifas (vista "Todas")

`loadTariffData()` en modo "Todas" hacía DOS lecturas independientes del maestro: una
para las filas que se pintan (`rows`) y otra, dentro de `computeAllGamasDiff()`, para
calcular los totales del diff — cada una obtenía sus propios objetos de fila (copias
distintas de IndexedDB). `History.diff()` anota `_status`/`_rebrandedFrom` MUTANDO los
objetos que recibe — como mutaba la copia de `computeAllGamasDiff()` y no la de `rows`,
la tabla pintada nunca veía esas anotaciones. En la vista de una sola gama sí funcionaba,
porque ahí `rows` y el diff comparten los mismos objetos.

**Corregido**: `loadRowsWithStatus(brand, gama)` hace la lectura y el diff sobre los
MISMOS objetos y devuelve ambos (`{ rows, diff }`); `loadAllGamasWithStatus(brand)` lo
llama una vez por gama real y concatena esas mismas filas ya anotadas. Ya no hay lectura
duplicada.

## Bug 2: margen por formato atropellado

El grid exterior (`.byformat-grid`) usaba columnas de mínimo 150px, pero cada tarjeta de
formato (`.format-row`) necesitaba un layout horizontal de 3 columnas (etiqueta + input
de 84px + contador de 54px) que no cabía en 150px — con marcas de muchos formatos
(Castrol tiene 10) el resultado se apelmazaba. Se rediseña `.format-row` como una
"chapa" vertical (etiqueta arriba, input, refs debajo) en vez de un grid horizontal
rígido, y se reduce el mínimo de columna del grid exterior a 84px para que quepan más
chapas por fila sin apretarlas.

## "Añadir nivel" por defecto en "Ningún nivel añadido"

Se añade `<option value="">Ningún nivel añadido</option>` como primera opción (y por
defecto) en `#newLevelPreset`; el botón "Añadir nivel" avisa con un `alert` si se pulsa
sin haber elegido un preset real, en vez de añadir silenciosamente el primer preset de
la lista.

## Cruces de referencias cargables desde Importación

Se añade una tercera zona de carga en Importación, debajo de la de rebranding:
"Cruces de referencias entre marcas" — mismo mecanismo que el botón de Comparación
(`EquivalenceReader.readKnownFile` + `EquivalenceIndex.build`, misma clave de
`localStorage`), así que cargar desde cualquiera de los dos sitios deja el mismo estado
— no hay dos bases de conocimiento distintas, solo dos puertas de entrada a la misma.
Se mantiene también el botón de Comparación (no se retira, por si se prefiere cargar
desde ahí mismo al ir a comparar).

Los dos cuadros de la zona central de Importación quedan cada uno con su propia
explicación:
- **Rebranding**: solo el asunto de SIRDI antigua ↔ nueva — se retira la mención a
  cargar tarifas de proveedor (eso ya lo explica la tarjeta de cada marca, más arriba).
- **Cruces de referencias**: qué son (qué ref de una marca es el mismo producto en
  otra), para qué se usan (Comparación), y que hay que recargarlos si se actualizan o
  se abre la app en otro ordenador.

## Consecuencias

- `js/screens/screen-tarifas.js`: `computeAllGamasDiff` se sustituye por
  `loadRowsWithStatus`/`loadAllGamasWithStatus` (ver Bug 1).
- `app/css/styles.css`: `.byformat-grid`/`.format-row` rediseñados;
  `#dropZone`/`#equivDropZone` comparten estilo de zona de carga.
- `app/index.html`: nueva sección `#equivDropZone` + `#equivStatus`; textos de
  `#dropZone .hint` y `#newLevelPreset` actualizados.
- `js/screens/screen-import.js`: `handleEquivFiles`, `renderEquivStatus`,
  `setupEquivDropZone` — misma lógica que `ScreenCompare.handleKbFiles`/`renderKbStatus`.
- `js/screens/screen-rules.js`: guarda en `btnAddLevel` para preset vacío.
- Probado en navegador: cargar los Excel de equivalencias desde Importación deja el
  mismo estado visible después en Comparación; la vista "Todas" de Tarifas ya marca
  "NUEVA" correctamente; los campos de margen por formato ya no se solapan; "Añadir
  nivel" sin preset no añade nada y avisa.

## Referencias

- `js/screens/screen-tarifas.js`, `js/screens/screen-rules.js`,
  `js/screens/screen-import.js`.
- ADR 0020 (pantalla Tarifas), ADR 0022 (margen por formato en Reglas).
