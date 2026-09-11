# ADR 0078 — "Valor Regalo 1+1 (Venta)": coste de la caja completa, no de una unidad

**Fecha:** 2026-09-11
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako retomó "Valor Regalo 1+1" (dejado pendiente en ADR 0072/0073). Explicó el negocio
real: con formatos que tienen "1+2" activado en Reglas (hoy solo aceite de AD Parts, en
cajas de 5 unidades), la alternativa "1+1 + obsequio" da 1 caja gratis en vez de 2, y el
"obsequio" en € es el dinero que sale de NO dar esa segunda caja — es decir, el **coste
de una caja completa** (coste por unidad × unidades por caja), no el coste de una sola
unidad.

`regaloValueFor()` ya usaba correctamente el coste configurado en PVP (factura/neto-
neto/triple-neto, lo que corresponda) pero le faltaba la multiplicación por unidades por
caja — devolvía el coste de una unidad suelta.

Investigado (agente de exploración + confirmación de Yako) cómo conseguir esas unidades
por caja marca a marca:

| Marca | Fuente | Detalle |
|---|---|---|
| Repsol | Tarifa (`UDS X CAJA`) | Ya se calculaba en el perfil pero se perdía al guardar la fila — nunca llegaba a Neon ni al maestro local. |
| Eni | Tarifa (`UDS. POR ENVASE`) | No se leía; verificado matemáticamente contra `TARIFA 2 UNIDAD DE VENTA` antes de confiar en ella. |
| Racing Oil | Tarifa (`UDS. POR CAJA`) | No se leía; Yako confirmó el dato real (4 uds. en 5L, no 5 como recordaba) al revisar la tarifa. |
| Castrol | Descripción (patrón "NxM": `12X1L`, `4X4L`, `4X5L`, `6X.3L`, `12X.4K`) | No hay columna dedicada en la tarifa; el patrón ya se parseaba parcialmente (solo se usaba M, litros), ahora también N (unidades). |
| Shell | Sin dato en tarifa | Confirmado por Yako a mano: 1L→12, 4L→3, 5L→3. |
| AD Parts | Sin dato en tarifa (ni siquiera en el formato "ENTRADA", que sí trae `UD CAJA` pero casi nunca es el que llega) | Confirmado por Yako a mano, **por gama, no solo por litros** — Aceite (normal/standard/sportcar) 5L→5, Químicos 5L→4, Químicos 0,5L→30. Pendiente de confirmar 1L (20 uds., ¿aceite, químicos o ambos?) — no incluido todavía. |

## Decisión

**Esquema**: nueva columna `units_per_box` (numeric) en `imported_tariff_rows` (Neon, vía
conexión directa — ver memoria `neon_direct_db_access`) + refresco de caché del Data API.
`neon-tariffs.js` (`FIELD_MAP`) y `db.js` (`putRows`/`hydrateFromNeon`) la tratan igual
que `liters` — null-aware, una reimportación que no la traiga no borra la ya guardada.

**Perfiles**: `profile-eni.js` y `profile-racing-oil.js` ganan la lectura de su columna
respectiva y adjuntan `row.unitsPerBox`. `profile-castrol.js`: `parseLitersFromDescription`
se generaliza a `parseEnvaseFromDescription(raw)` → `{liters, units}` (antes descartaba
la `N` de "NxM", ahora también se guarda); un envase sin "NxM" (ej. "208L B7") cuenta
como una unidad suelta (`units: 1`). Repsol no necesitó cambios en el perfil — el dato ya
se calculaba, solo faltaba que sobreviviera en `db.js` (ver arriba).

**Tabla de reserva** (`excel-writer.js`, `UNITS_PER_BOX_FALLBACK` +
`unitsPerBoxFallback(brandId, gama, liters)`) para Shell y AD Parts, con los valores que
Yako confirmó. AD Parts se indexa por gama (no solo litros) porque el mismo litraje (5L)
lleva distinta caja en Aceite que en Químicos — algo que "Familias Skrit.xlsx" no
necesitaba resolver. Sin entrada, `null` — nunca se inventa un número.

**`regaloValueFor(row, pvpLevel, brandId)`** (`screen-export.js`): usa `row.unitsPerBox`
si la fila lo trae (Repsol/Eni/Racing Oil/Castrol), si no cae a
`ExcelWriter.unitsPerBoxFallback` (Shell/AD Parts). El resultado final es
`costePorUnidad × unidadesPorCaja`. Sigue devolviendo `null` (fila en blanco, nunca un
número adivinado) si el formato no tiene "1+2" activado, si no hay coste auditado, o si
no hay unidades por caja de ninguna de las dos fuentes.

**Renombrado**: "Valor Regalo 1+1 (Compra)" → **"Valor Regalo 1+1 (Venta)"** — se trata
como un dato de venta (lo que se le regala al cliente), no de compra.

## Pendiente

- AD Parts 1L (20 uds. según Yako) — falta confirmar si aplica a Aceite, Químicos o
  ambos antes de añadirlo a la tabla.
- Yako mencionó que podría convenir guardar en el maestro las unidades detectadas de la
  descripción de Castrol como columna visible, no solo usarlas internamente — no
  implementado en este cambio (`unitsPerBox` no se muestra en ninguna tabla, solo
  alimenta este cálculo), a valorar si hace falta más adelante.
- La comprobación de que "Valor Regalo 1+1" solo liste artículos con "1+2" activado (la
  duda original de Yako sobre si el filtro estaba bien) queda cubierta por el `if
  (pvpLevel.formatModes[row.formatKey] !== '1x2') return null` ya existente — no
  cambiado en este ADR, solo confirmado que sigue vigente.

## Verificación

- `node --check` sobre los 6 ficheros tocados.
- Probado `parseEnvaseFromDescription` contra los 7 ejemplos reales de Castrol que dio
  Yako (`12X1L`, `4X4L`, `4X5L`, `6X.3L`, `12X.4K`, `208L`, `18K`) — unidades y litros
  correctos en los 7.
- Probado `regaloValueFor`/`unitsPerBoxFallback` en aislado: AD Parts Aceite 5L vs.
  Químicos 5L dan resultados distintos (300€ vs. 240€ con el mismo coste de ejemplo),
  Shell 1L sin "1+2" da `null`, un formato sin entrada en la tabla da `null`.

## Referencias

- ADR 0072/0073 (donde se dejó pendiente esta tarea).
- ADR 0076/0077 (mismo patrón de tabla de reserva, "Familias Skrit.xlsx").
- `js/core/db.js`, `js/core/neon-tariffs.js`, `js/profiles/profile-{eni,racing-oil,
  castrol}.js`, `js/export/excel-writer.js`, `js/screens/screen-export.js`.
