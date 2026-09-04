# ADR 0075 — Fix: la previsualización de PVP (Skrit) no aplicaba la familia especial

**Fecha:** 2026-09-04
**Estado:** Aceptada
**Decidido por:** Yako (reportado tras probar v1.0.26)

## Contexto

Tras ADR 0074, Yako reportó que AD Parts seguía mostrando familia "06" en vez de "07"
para 208L/600L/1000L, incluso con la versión ya actualizada y el navegador refrescado.

Comprobado directamente en Neon (`pricing_rules`, `ad_parts_aceite`): el interruptor
"PVP Neto en Bidones y Cubas" SÍ está activado para los formatos 208/600/1000 en todas
las gamas — no era un problema de configuración. La causa real: ADR 0074 solo tocó
`excel-writer.js` (el fichero .xlsx que se descarga), pero la **previsualización en
pantalla** de "PVP (Skrit)" tiene su propio código de renderizado en `screen-export.js`
(`renderPreviewTable`, rama `kind === 'skrit'`) que nunca se tocó — seguía pintando
`Parser.upperOut(r.fam)` sin pasar por el nuevo `exportFamilia`. Bug de alcance
incompleto en el cambio anterior, no un fallo del propio mecanismo.

## Decisión

`excel-writer.js` expone `exportFamilia` en su interfaz pública. `screen-export.js`
(previsualización de "PVP (Skrit)") la usa en vez de `Parser.upperOut(r.fam)` a secas —
mismo `isBigContainer` que ya se calculaba ahí para la columna "Bidones y Cubas", sin
duplicar la tabla de códigos por marca en dos sitios.

La previsualización de "PVP (Datos)" no muestra columna Familia (no la tenía antes de
este cambio tampoco) — nada que arreglar ahí.

## Verificación

- `node --check` sobre `excel-writer.js` y `screen-export.js`.
- Confirmado en Neon que 208/600/1000 de AD Parts tienen `pvp_neto` activo en las 5
  gamas — descarta un problema de datos, aísla el bug al código de previsualización.

## Referencias

- ADR 0074 (cambio original, incompleto).
- `js/export/excel-writer.js`, `js/screens/screen-export.js`.
