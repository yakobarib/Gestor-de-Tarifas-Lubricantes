# ADR 0014 — Descripción de exportación separada de la original + listados Neto Factura/Neto-Neto

**Fecha:** 2026-07-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras el ADR 0013 (limpieza de descripción de Repsol para Skrit), Yako pidió dos ajustes:

1. La limpieza de descripción debe aplicarse **siempre que se genera una tarifa de
   salida** (Skrit o cualquier otro tipo de export), no solo en el export a Skrit — pero
   **la descripción original debe quedar intacta** en pantalla y en el maestro.
2. Además de PVP, la pantalla de Exportación debe poder generar: Neto Factura,
   Neto-Neto, Bidones y Cubas Neto, Netos Bonus, Netos Especiales.

## Decisión 1 — `descriptionExport` como campo aparte

`profile-repsol.js` calculaba `description` ya limpia y sobrescribía el nombre original.
Se separa en dos campos:

- `description`: el nombre original, solo con espacios normalizados — el que se ve en
  Importación, Comparación y el maestro. Igual que en el resto de proveedores.
- `descriptionExport`: la versión renombrada (unidad de compra fuera, viscosidad sin
  guion, kg/gr a L/ml) — **solo** la usan las funciones de export.

`MasterDB.putRows` persiste `descriptionExport` si el perfil la trae (hoy solo Repsol),
y todas las funciones de `ExcelWriter` (`exportSkrit`, `exportSkritV2`, la nueva
`exportPriceList`) usan un helper `exportDescription(r)` que prioriza
`descriptionExport` y cae a `description` para el resto de proveedores — cambio aditivo,
cero regresión para Eni Live o AD Parts, que no traen `descriptionExport`.

## Decisión 2 — Tipos de exportación más allá de PVP

Yako describió el propósito real de cada uno:

| Tipo | Formato | Lógica |
|---|---|---|
| PVP | Skrit (9 columnas) | La que ya existía — margen configurado en Reglas sobre `priceLevels`. |
| Neto Factura | Listado simple | El propio `costFactura`, sin margen — "para imprimir un listado por si es necesario". |
| Neto-Neto | Listado simple | El propio `costNetoNeto`, sin margen — mismo uso. |
| Bidones y Cubas Neto | Skrit | **Pendiente de aclarar** — la explicación se cortó a mitad ("se saca del neto compra factura + en bidones..."). No implementado todavía. |
| Netos Bonus | Sin definir formato | Se saca de triple-neto + "precio del premio" (no está en el modelo de datos hoy, habría que introducirlo a mano) + margen deseado. **Pendiente de aclarar** cómo se introduce el precio del premio. No implementado. |
| Netos Especiales | Sin definir | Yako no llegó a explicar la lógica. No implementado. |

Se implementan los dos tipos claros y sin ambigüedad (Neto Factura, Neto-Neto) como
**listados simples**, deliberadamente NO con el formato Skrit de 9 columnas — Yako los
describió como "para imprimir", no como fichero para Skrit:

`ExcelWriter.exportPriceList(rows, brandAbbr, costField, label, tariffDate)` — columnas
MARCA / REFERENCIA / MARCA+REFERENCIA / LITROS / DESCRIPCION / `<label>`, usando el coste
tal cual (sin `Pricing.compute`, sin margen). Filas sin ese coste auditado todavía para
la marca/gama se excluyen (igual criterio que `exportSkritV2` con `costNetoNeto`).

Pantalla Exportación: nuevo selector "Tipo de exportación" (PVP / Neto Factura /
Neto-Neto). El selector de "Nivel de precio" se oculta para los dos tipos de listado, ya
que no hay margen que elegir.

## Consecuencias

- `js/profiles/profile-repsol.js`: `description` vuelve a ser el original; nuevo campo
  `descriptionExport`.
- `js/core/db.js`: `MasterDB.putRows` persiste `descriptionExport`.
- `js/export/excel-writer.js`: helper `exportDescription()`, nueva función
  `exportPriceList()`.
- `js/screens/screen-export.js`, `app/index.html`: selector de tipo de exportación.
- Probado end-to-end: pantalla de Importación sigue mostrando el nombre original de
  Repsol; export a Skrit usa el renombrado; Neto Factura (526 filas) y Neto-Neto (523
  filas) exportados como listado simple contra la tarifa real "con aportaciones".
- Bidones y Cubas Neto, Netos Bonus y Netos Especiales quedan **sin implementar**,
  pendientes de que Yako termine de explicar la lógica de cada uno.

## Referencias

- `js/profiles/profile-repsol.js`, `js/core/db.js`, `js/export/excel-writer.js`,
  `js/screens/screen-export.js`.
- [ADR 0013](0013-limpieza-descripcion-repsol.md) — limpieza de descripción Repsol.
