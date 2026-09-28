# ADR 0083 — Ranking completo de equivalencias en Comparación

**Fecha:** 2026-09-28
**Estado:** Aceptada
**Decidido por:** Yako (petición de su jefe)

## Contexto

Hasta ahora Comparación solo resolvía UNA referencia a la vez contra sus equivalentes
(`renderGroupFor`, ver ADR 0024) — exhaustivo (todos los costes y PVPs de cada marca
miembro) pero uno por uno. El jefe de Yako pidió, además, un listado completo: todas las
equivalencias conocidas entre 5 marcas (AD Parts, Repsol, Castrol, Eni Live, Shell — sin
Racing Oil) en una tabla, con datos que quepan en pantalla y den pautas de comparación de
un vistazo, no el detalle exhaustivo de la vista individual.

Tres decisiones negociadas con Yako antes de implementar:

1. **Ubicación**: pestaña nueva ("Ranking completo") dentro de la propia pantalla
   Comparación, no una pantalla nueva en el sidebar — reutiliza el mismo toggle
   `.mode-toggle`/`.mode-btn` que ya existe en Reglas para el modo de margen.
2. **Qué dato por marca**: PVP + coste de factura (dos cifras apiladas por marca, no la
   lista completa de niveles/costes de la vista individual) — con 5 marcas por fila, más
   datos no habría cabido sin scroll horizontal excesivo.
3. **Qué pauta resaltar**: el PVP más barato y más caro de cada fila, en verde/rojo — no
   una columna extra con el % de diferencia.

## Decisión

Nueva función `EquivalenceIndex`-consumidora en `screen-compare.js`: recorre
`EquivalenceIndex.load().groups` completo (antes nadie lo hacía; solo existía el lookup
de una ref, `findEquivalents`) y por cada grupo calcula una fila con 5 columnas (una por
marca del ranking), cada una en uno de estos estados:

- `ok` — hay tarifa importada y un nivel PVP configurado: se muestra PVP (negrita) +
  coste de factura (gris, más pequeño).
- `sin_tarifa` — el grupo tiene una ref para esa marca, pero no hay tarifa importada.
- `sin_nivel` — hay tarifa pero Reglas no tiene un nivel `pvp` configurado para esa
  marca/gama.
- `otros_formatos` — la marca tiene el producto pero en otro tamaño (mismo caso que ya
  distinguía la vista individual, `note: 'otros_formatos'`).
- `sin_equivalencia` — esa marca no aparece en el grupo.

Un grupo se descarta por completo del ranking si NINGUNA de las 5 marcas aparece en él
(ej. un grupo que solo incluye Racing Oil) — evitaría filas enteras de guiones sin
ninguna utilidad.

**Rendimiento**: en vez de reutilizar `findMemberRow` (pensado para una comparación,
escanea `MasterDB.getByBrand` completo por cada miembro que no encuentra por ref+gama
exacta), se precarga UNA vez por marca un `Map<ref, fila>` (`MasterDB.getByBrand(id,
null)`) y se reutiliza para los cientos de grupos — evita repetir un escaneo O(n) por
cada celda de la tabla. Los niveles PVP (`RulesStore.load` + `Migration.
synthesizePvpLevel`) también se cachean por `marca:gama` dentro de una misma
construcción del ranking, ya que se repiten mucho (casi ninguna marca distingue gama en
los ficheros de equivalencias salvo AD Parts).

**Filtros**: buscador de texto (contra la descripción o cualquier ref de la fila) y un
desplegable de categoría (los 5 fijos que ya lee `EquivalenceReader`: aceites, grasas,
hidráulicos, motor industrial, transmisión y ejes) — ambos filtran en cliente sobre el
array ya calculado, sin recalcular nada.

**Recalculado completo, no incremental**: al volver a entrar en Comparación, el ranking
se descarta (`rankingRows = null`) y se recalcula desde cero la próxima vez que se abre
esa pestaña — mismo criterio que el reinicio completo de la vista individual (ADR 0079
Comparación): mejor pedir el cálculo de nuevo que arriesgarse a mostrar datos de un
maestro o unas reglas que hayan cambiado mientras tanto. Sí se conserva mientras se
permanece en la pantalla (cambiar el texto de búsqueda o la categoría no recalcula, solo
filtra), y se recalcula por completo en un `rules:changed` (editar un margen en Reglas)
para que el PVP mostrado nunca quede desfasado.

## Verificación

- `node --check` sobre `screen-compare.js`.
- Lógica central (`buildRankingRows`, sin las llamadas a Neon/IndexedDB) probada en
  aislado con datos de ejemplo: identifica correctamente el más barato/caro de la fila,
  no resalta nada en caso de empate, descarta un grupo que solo tiene Racing Oil, y
  distingue "sin tarifa" de "en otro formato".
- No se ha podido probar visualmente (la app exige login real) — pendiente de que Yako
  lo confirme en el navegador.

## Referencias

- ADR 0008 (equivalencias entre marcas, formatos spec/block).
- ADR 0024 (pantalla Comparación, vista individual).
- ADR 0079 (reinicio completo de Comparación al volver a la pantalla).
- `app/js/screens/screen-compare.js`, `app/js/comparison/equivalence-index.js`,
  `app/index.html`, `app/css/styles.css`.
