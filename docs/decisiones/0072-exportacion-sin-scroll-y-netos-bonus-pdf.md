# ADR 0072 — Exportación cabe en un viewport; Netos Bonus se consolida en PDF

**Fecha:** 2026-08-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Dos peticiones sobre Exportación:

1. La pantalla entera necesitaba scroll de página para verse completa (toolbar +
   filtros + tabla + estado no cabían en un viewport típico) — Yako pidió que la
   pantalla en sí quepa sin scroll, dejando el scroll solo dentro del listado (que por
   naturaleza puede ser largo, cientos de filas).
2. El desplegable tenía dos entradas casi redundantes para Netos Bonus: "Netos Bonus (uso
   interno)" (`level:netos_bonus`, tabla Excel rica con Marca/Ref/Producto/Litros/
   Familia/Bidones y Cubas/3 costes/PVP/PVP manual) y "PVP (Bonus)" (`print:netos_bonus`,
   PDF simple sin coste — Referencia/Descripción/Litros/PVP Bonus, ver ADR 0039). Yako
   pidió aplicar el formato de "PVP (Bonus)" a "Netos Bonus" y eliminar la entrada
   separada.

## Decisión

**Sin scroll de página** (`styles.css`): `#screen-export` pasa a `display: flex;
flex-direction: column` con `max-height: calc(100vh - 100px)` (100px = alto real medido
de `.app-header`, mismo valor que ya usa la barra sticky de Tarifas). Dentro, `<article>`
y `#exportPreviewWrap` también son columnas flex con `flex: 1; min-height: 0`, y
`.table-wrap` (que ya tenía `overflow: auto`) hereda ese `flex: 1` en vez de su
`max-height: 66vh` de siempre — así el listado absorbe todo el espacio sobrante y hace
scroll dentro de sí mismo, sin que la sección se salga del viewport. `overflow-y: auto`
en la propia sección queda como red de seguridad para viewports muy estrechos donde ni el
toolbar cabría, sin afectar al caso normal. Cambio con ámbito solo a `#screen-export` —
Tarifas sigue usando el `.table-wrap` global de 66vh, no se tocó.

**Netos Bonus consolidado en PDF**: en `renderExportOptions()`, el nivel `netos_bonus`
pasa a ofrecer una única entrada — `{ value: 'print:netos_bonus', label: 'Netos Bonus
(uso interno)' }` — en vez de las dos anteriores. Toda la lógica de filtrado/render/
export de `print:netos_bonus` (título "Tarifa Netos Bonus", columnas Referencia/
Descripción/Litros/PVP Bonus, solo formatos "Salida impresa") ya existía tal cual desde
ADR 0039 y no se tocó — solo cambia qué aparece en el desplegable. `EXPORT_FILE_TYPE_LABELS['level:netos_bonus']`
se elimina (ya inalcanzable). **Netos Gasolineras no se toca** — sigue siendo la tabla
Excel rica de siempre (`level:netos_gasolineras`), Yako no pidió lo mismo para ella.

## Verificación

- `node --check` sobre `screen-export.js`.
- Revisada la ayuda integrada (`screen-help.js`) para reflejar que Netos Bonus ahora
  exporta PDF (antes decía "listado"/Excel, igual que Netos Gasolineras).

## Referencias

- ADR 0039 (origen del PDF "PVP (Bonus)").
- ADR 0070 (Netos Gasolineras, selector de nivel).
- `app/css/styles.css`, `js/screens/screen-export.js`, `js/screens/screen-help.js`.
