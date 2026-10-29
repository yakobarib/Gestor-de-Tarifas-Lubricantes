# ADR 0088 — Ignorar filas de gamas que ya no existen (Repsol `default`)

**Fecha:** 2026-10-29
**Estado:** Aceptada
**Decidido por:** Yako (detectado por él al comparar Repsol con AD Parts)

## Contexto

En Comparación, la referencia RPP6008HAB de Repsol (coste factura 2.346,57 €) salía con un
PVP de **6.704,50 €**, mientras que la regla de Repsol para 1000 L (margen 15 % + "PVP Neto")
da **2.760,68 €**, casi idéntico al equivalente de AD Parts (2.806,38 € con el mismo 15 %).

Causa, comprobada con consultas de solo lectura a Neon y el `Pricing.compute` real:

- `imported_tariff_rows` guarda **941 filas de Repsol en una gama `default`** (última
  actualización 02/09/2026), de cuando Repsol era una única tarifa, antes de partirla en 6
  gamas (automoción, industria, marinos…). `default` ya no es una gama de Repsol
  (`BRANDS[].gamas`), así que no se puede elegir en ningún selector.
- 864 de esas refs existen también en su gama real → cada una está **dos veces** (1.728 filas
  implicadas). Es la única marca afectada.
- La config de reglas de `repsol/default` es la antigua (margen 30 % por defecto, sin
  márgenes por formato ni "PVP Neto"), porque "Todas las gamas" solo difunde a las gamas
  vigentes. Con esa regla: 2.346,57 / (1 − 0,30) ÷ 0,5 = **6.704,50 €**.
- Comparación buscaba el miembro del grupo de equivalencia primero en la gama declarada
  (`automocion`) y, si no, en TODAS las gamas quedándose con la primera fila encontrada — que
  era la de `default`. El Ranking indexaba por ref con "la última gana" (arbitrario).
- Efecto colateral en Reglas: con "Todas las gamas", `availableFormats` /
  `availableCostFields` leían todas las gamas y contaban cada ref dos veces (la captura de
  Yako sumaba ≈1.788 refs frente a las 864 reales).

## Decisión

Nueva `MasterDB.getByBrandCurrentGamas(brandId)`: igual que `getByBrand(brandId, null)` pero
solo con las filas de las gamas vigentes de la marca (`BRANDS[].gamas`). Se usa donde se
mezclan gamas: `resolveRefAcrossBrands`, `findMemberRow` y `buildRankingRows` (Comparación) y
las dos ramas `__all__` de `screen-rules.js`. `getByBrand` no cambia (lo sigue usando el
flujo de importación del Triple-Neto de AD Parts, que no tiene relación con esto).

Las filas `default` de Repsol **no se borran** — no hace falta (el código las ignora) y borrar
941 filas compartidas en Neon es una operación que el entorno ya bloqueó en otra ocasión
(ADR 0085). Si se quisiera limpiar, sería un `DELETE` explícito por parte de Yako/DBA, además
de vaciar la copia local (IndexedDB) de cada ordenador, porque `hydrateFromNeon` solo añade.

## Verificación

Con datos reales de Neon y el código real de `pricing.js`/`brands.js`:

- RPP6008HAB: antes 6.704,50 € (gama `default`, margen 30 %) → ahora **2.760,68 €** (gama
  `industria`, margen 15 %, PVP Neto) = 2.346,57 / 0,85.
- "Todas las gamas" de Repsol en Reglas: 1.805 refs → **864** (coincide con la tarjeta de
  Importación). Refs duplicadas entre gamas vigentes tras el filtro: 0.

No probado en la app real (requiere login).

## Consecuencia a tener en cuenta

Las 77 refs de Repsol que solo existen en `default` (ya no están en la tarifa actual) dejan de
aparecer en Comparación/Ranking ("sin tarifa importada") en vez de mostrarse con un PVP
calculado con reglas obsoletas.
