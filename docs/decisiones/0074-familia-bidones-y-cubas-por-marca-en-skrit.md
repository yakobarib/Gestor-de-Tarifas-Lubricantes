# ADR 0074 — Familia especial de "Bidones y Cubas" por marca en la exportación a Skrit

**Fecha:** 2026-09-04
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Skrit tiene su propio sistema de familias, distinto del que trae cada tarifa de
proveedor. Para los formatos grandes (~180kg/200L en adelante — "Bidones y Cubas"),
Skrit espera un código de familia fijo y distinto por marca, no la familia real de la
tarifa:

- AD Parts = 07
- Repsol = 09
- Castrol = 03
- Eni = 12
- Shell = 30

Racing Oil no se dio (no tiene, o Yako no lo especificó) — se queda sin sobrescribir.

Qué formato cuenta como "Bidones y Cubas" **no es un umbral de litros nuevo**: ya existe
`bigContainerFormatsFor`/`bigContainerResolver` (ver ADR 0064, adenda), que lee el
interruptor "PVP Neto en Bidones y Cubas" de Reglas por formato — el mismo mecanismo que
ya rellena la columna "BIDONES Y CUBAS" (SÍ/vacío) del Excel de Skrit. Se reutiliza tal
cual en vez de comparar litros a mano, precisamente porque un umbral fijo fallaría con el
bidón de 180kg de Repsol (se queda con `formatKey="180"`, nunca se convierte a un litraje
"redondo" como 208L — ver el histórico de esa decisión).

## Decisión

`excel-writer.js`: nuevo `BIDONES_CUBAS_FAM_BY_ABBR` (clave = `brandAbbr`, ya disponible
en `exportSkritV2`/`exportSkritLean` sin necesidad de pasar también el `brandId`) y
`exportFamilia(r, brandAbbr, isBigContainer)` — devuelve el código especial si
`isBigContainer` y la marca está en la lista, si no la familia real de siempre
(`Parser.upperOut(r.fam || '')`). Se llama en las dos funciones que escriben la columna
FAMILIA, reutilizando el mismo `bigContainerMap[r.formatKey]` que ya calculaban para la
columna "BIDONES Y CUBAS" (ninguna llamada nueva a `bigContainerResolver`).

Afecta a **ambas** exportaciones Excel que llevan familia (`exportSkritLean`, la que usa
"PVP (Skrit)", y `exportSkritV2`, la que usa "PVP (Datos)") — no solo a la que Yako
mencionó explícitamente, para que las dos vistas sean coherentes entre sí (misma fila,
mismo dato de familia en las dos).

## Verificación

- `node --check` sobre `excel-writer.js`.
- Probado `exportFamilia` en aislado con un caso por marca (con y sin
  `isBigContainer`) y con Racing Oil (sin entrada en la tabla, familia real intacta).

## Referencias

- ADR 0064 (adenda) — unificación de "Bidones y Cubas" con el interruptor "PVP Neto".
- `js/export/excel-writer.js`, `js/screens/screen-export.js` (`bigContainerFormatsFor`).
