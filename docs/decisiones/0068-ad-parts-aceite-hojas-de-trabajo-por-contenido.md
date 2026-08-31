# ADR 0068 — AD Parts Aceite: reconocer las hojas "de trabajo" por contenido del nombre

**Fecha:** 2026-08-28
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Mismo patrón que [ADR 0067](0067-triple-neto-ad-parts-una-sola-columna-de-mes.md), en el
fichero distinto: preparando la demo para su jefe, Yako "limpió de basura" su tarifa AD
Parts más reciente (`AD Aceite 22 maig 2026 (PVP Y PC).xlsx`, formato "de trabajo") antes de
reimportarla, y la app respondió "No se reconoce el formato de esta tarifa".

El perfil `ad_parts_aceite` (formato "de trabajo") esperaba las hojas con nombre exacto
`Coste` (gama normal), `ADStandard` (gama standard) y `CosteSC` (gama Sport Car). Yako
había renombrado las tres a `Coste AD`, `Coste Standard` y `Coste Sport Car`
respectivamente — cambio puramente cosmético, mismo contenido, pero `detect()`/`read()`
comparaban el nombre de hoja letra por letra y no encontraban ninguna coincidencia.

El propio fichero de origen no sigue una convención de nombres estable de un mes a otro (ya
lo demuestra el propio Yako reorganizándolo), así que atarse a un nombre literal es frágil
por diseño — el resto del perfil ya usa `findRefHeader` (busca la cabecera por contenido:
"ref."), así que conviene aplicar el mismo criterio a la resolución de hojas.

## Decisión

`profile-ad-parts-aceite.js`: nueva `resolveWorkingSheetNames(names)` que localiza las 3
hojas por contenido del nombre (en minúsculas), más específico primero para no confundir
una hoja con otra, cada hoja usada como mucho una vez:

1. **Sport Car**: nombre exacto histórico `costesc`, o cualquier nombre que contenga
   `sport`.
2. **Standard**: nombre exacto histórico `adstandard`, o cualquier nombre que contenga
   `standard`.
3. **Normal**: nombre exacto histórico `coste`, o cualquier nombre que contenga `coste`
   (evaluado el último, así no "roba" la hoja de Sport Car/Standard que también contienen
   la palabra "coste" en el nombre que les puso Yako).

`detect()` y `readADPartsAceiteWorking()` usan esta misma resolución en vez de comparar con
`'Coste'`/`'ADStandard'`/`'CosteSC'` literales. Los nombres históricos exactos se mantienen
como parte de la condición, así que ficheros antiguos sin renombrar siguen funcionando
igual. De paso, se añade `'ad aceite'` a los patrones de nombre de fichero reconocidos en
`detect()` (Yako nombra sus tarifas de trabajo "AD Aceite {fecha}...", patrón visto en
varios meses seguidos) como capa extra de detección si algún día también cambia los
nombres de hoja de forma irreconocible.

## Verificación

- `node --check` sobre `profile-ad-parts-aceite.js`.
- Replicado `detect()`/`read()` con Node (mismo `xlsx@0.18.5` que usa la app) contra el
  fichero real de Yako, ya renombrado (`Coste AD` / `Coste Standard` / `Coste Sport Car`):
  `detect()` devuelve `true`, y `read()` reconoce las 3 gamas — 244 filas normal, 40
  standard, 19 sportcar — con costes y litros coherentes (ej. ref 61001 "HSD 0W20" 1L
  3,27€; ref 246208 "SCC 5W30" 208L 695,39€ Sport Car).
- De paso, este fichero SÍ trae coste de factura actualizado para Sport Car (a través de la
  hoja "CosteSC"/"Coste Sport Car") — solo el Triple-Neto de Sport Car sigue sin fuente de
  datos dedicada (ver ADR 0067, fuera de alcance de este fix).

## Referencias

- ADR 0067 (mismo patrón, fichero de Triple-Neto).
- `js/profiles/profile-ad-parts-aceite.js`, `js/profiles/excel-reader.js` (`findRefHeader`,
  mismo criterio "por contenido" ya usado ahí).
