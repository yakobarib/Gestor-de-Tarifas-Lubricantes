# ADR 0077 — "FAMILIA {marca}" en vez de "FAMILIA", y litros reales añadidos a Familias Skrit.xlsx

**Fecha:** 2026-09-09
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Dos peticiones sobre "PVP (Skrit)" (ADR 0076):

1. La columna "FAMILIA" (la del proveedor) debía renombrarse con la marca incluida —
   "Familia AD"/"Familia CAT"/"Familia REP"/"Familia SHE"/"Familia ENI"/"Familia RAC" —
   con "Familia Proveedor" como alternativa si no era viable por marca.
2. `Familias Skrit.xlsx` (fuente de "Familia Skrit", ver ADR 0076) solo tenía los
   litrajes que Yako recordaba a mano — pidió que se le recordaran (o se añadieran
   directamente al Excel) todos los formatos de litros reales que existen por marca, sin
   repetir, para poder ir rellenando el código que falta en cada uno.

## Decisión

**1. Columna con la marca en el nombre**: `excel-writer.js` gana
`FAMILIA_PROVEEDOR_LABEL` (mapa `brandAbbr` → etiqueta) y `familiaProveedorLabel
(brandAbbr)` — con **fallback a `'Familia Proveedor'`** si la marca no está en el mapa
(pedido explícito de Yako como red de seguridad, aunque hoy cubre las 6 marcas). Dos
detalles del mapeo, ambos porque así los pidió Yako y no coinciden con el `brandAbbr`
interno de la app: AD Parts es **"AD"** (no "ADP") y Shell es **"SHE"** (no "SHL",
coincide con la abreviatura que Yako usa en su propio Excel de familias). Usada en la
cabecera del Excel (`exportSkritLean`, en mayúsculas como el resto de columnas) y en la
previsualización en pantalla (`screen-export.js`, tal cual — la pantalla usa
mayúscula/minúscula normal en sus cabeceras).

**2. Litros reales añadidos al Excel**: consultado directamente en Neon
(`imported_tariff_rows`, litros distintos por marca) el conjunto real de litrajes que
existen hoy en el maestro — 37 valores distintos en total entre las 6 marcas. Comparado
con las 17 filas que ya tenía `Familias Skrit.xlsx` (incluido el 209 que Yako acababa de
añadir): faltaban 22 (0.125, 0.15, 0.2, 0.23, 0.25, 0.3, 0.38, 0.4, 0.52, 0.65, 10, 16,
18, 25, 32, 46, 55, 68, 170, 180, 204, 500). Añadidas como filas nuevas, sin código
(pendientes de que Yako las rellene), sin tocar ninguna fila/valor ya existente. El "850"
que ya estaba en el Excel se ha dejado tal cual (no se ha visto en ningún import real
hasta hoy) — señalado a Yako para que confirme si es un formato real pendiente de
importar o un dato a revisar, sin borrarlo por iniciativa propia.

`FAMILIA_SKRIT` (la tabla embebida en `excel-writer.js`, ver ADR 0076) se completó con
la entrada de 209L que ya estaba rellena en el Excel de Yako pero se había quedado fuera
de la primera transcripción — descubierto al revisar el fichero para esta tarea.

## Verificación

- `node --check` sobre `excel-writer.js` y `screen-export.js`.
- Probado `familiaProveedorLabel` para las 6 marcas y una desconocida (cae al genérico).
- Releído `Familias Skrit.xlsx` tras la ampliación: 39 filas, litros ascendentes, sin
  duplicados, valores previos intactos.

## Referencias

- ADR 0076 (diseño de "Familia Skrit" como columna aparte).
- `Base de Conocimiento/Familias/Familias Skrit.xlsx`.
- `js/export/excel-writer.js`, `js/screens/screen-export.js`.
