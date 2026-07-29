# ADR 0010 — Triple nivel de coste (factura / neto-neto / triple-neto)

**Fecha:** 2026-07-29
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Repsol envía, junto a la tarifa normal, una variante "con aportaciones"
(`Tarifa Repsol Lubricants 1 agosto 2026 (con aportaciones).xlsx`) con columnas
adicionales (M→Z) que descuentan del precio de factura, fila a fila, los rappels y
soportes pactados con la marca. Yako pidió explícitamente que **ambas tarifas convivan**
(la normal y la de aportaciones) y poder elegir, al generar PVPs, sobre qué coste basarse.

Se auditaron y verificaron las fórmulas reales de las columnas (cuadrando los números
exactos en 5 filas distintas):

| Col | Contenido | Fórmula verificada |
|---|---|---|
| P | Precio factura €/L | `PRECIO FACTURA / (litros por envase × UDS X CAJA)` |
| Q | Rappel incondicional €/L | `P × 3%` |
| R | Rappel variable €/L | `P × tasa` (1-3%, esta tarifa también 3%) |
| S | Rappel volumen grupo €/L | `(tasa €/t, 200) × densidad(kg/L del producto) / 1000` — densidad = `(PESO NETO caja / UDS X CAJA) / litros por envase` |
| T | Precio neto €/L | `P − Q − R − S` |
| **U** | **Precio Neto caja/envase** ("neto-neto") | `T × litros por envase` |
| W | Soporte Marketing €/L | misma fórmula que S, tasa propia (esta tarifa también 200, por eso coincide numéricamente con S en todas las filas muestreadas) |
| X | Precio Neto Neto €/L | `T − W` |
| **Y** | **PRECIO NETO NETO CAJA/ENVASE** ("triple neto") | `X × litros por envase` |
| Z | Dto. acumulado | `(coste factura envase − Y) / coste factura envase` |

**Importante**: Repsol ya calcula U e Y **por envase/caja** en su propia hoja — la app no
recalcula rappels ni densidades, solo lee esas dos columnas directamente.

**Regla confirmada con Yako**: si `Q` está vacía para una fila, esa referencia no tiene
aportaciones ese mes (no depende de la familia/clasificación completa, es fila a fila —
verificado: `APOYO` tiene algunas refs con aportaciones y `MARINO` tiene refs sin ellas).

## Decisión

### Modelo de datos: 3 niveles de coste en MasterDB

Se añade `costTripleNeto` (+ `costTripleNetoImportedAt`) a las filas del maestro, junto a
los ya existentes `costFactura` y `costNetoNeto` (ver ADR 0008). `MasterDB.putRows()` deja
de asumir que un `tariffType` determina un único campo a rellenar por fichero: ahora,
si una fila trae explícitamente `costNetoNeto`/`costTripleNeto` (porque el propio perfil
de lectura ya los conoce, como en este caso), esos valores **mandan** sobre el mapeo
genérico por `tariffType`. Esto permite que **un solo fichero** (la tarifa "con
aportaciones") rellene los tres campos de coste a la vez, sin necesitar tres importaciones
separadas.

### Perfil de Repsol: detección por texto de cabecera, no por letra de columna

`profile-repsol.js` busca, en la misma fila de cabecera ya usada para `SIRDI`/`NOMBRE`/
`PRECIO FACTURA`, columnas cuyo texto contenga "CAJA" o "ENVASE" junto con "NETO":
la que contiene "NETO" **una vez** es el neto-neto (U); la que lo contiene **dos veces**
("PRECIO NETO NETO CAJA/ENVASE") es el triple-neto (Y). Evita depender de que la columna
esté siempre en la misma letra (pueden desplazarse si Repsol reordena columnas). Si el
fichero es la tarifa normal (sin aportaciones), estas columnas simplemente no existen y
los campos quedan `null` — **mismo perfil, mismo `detect()`**, ambas variantes conviven
sin que el usuario tenga que elegir nada al arrastrar el fichero.

### `priceLevels.baseCost` gana un tercer valor: `'tripleNeto'`

`baseCost: 'factura' | 'netoNeto' | 'tripleNeto'` → `baseCostField: 'costPerPack' |
'costNetoNeto' | 'costTripleNeto'`. Editable desde la pantalla Reglas (select de "Base de
coste" con las 3 opciones). `forMaster()` en Comparación y Exportación remapea igual que
ya hacía para `netoNeto` (ver ADR 0008).

### Export unificado a 10 columnas

`exportSkritV2` añade la columna `COSTE TRIPLE NETO` entre `COSTE NETO-NETO` y `PVP` — las
tres bases de coste quedan siempre visibles en el Excel de salida, independientemente de
cuál se haya usado para calcular el PVP de esa exportación concreta.

## Verificación

Importando `Tarifa Repsol Lubricants 1 agosto 2026 (con aportaciones).xlsx`: 864 filas,
857 con `costNetoNeto`/`costTripleNeto` rellenos (el resto sin aportaciones ese mes). Fila
de control `RPG300BCAB`: `costFactura=7837,65 €`, `costNetoNeto=7196,63 €`,
`costTripleNeto=7025,87 €` — coincide exacto con el cálculo manual verificado contra el
Excel real. Un nivel "Precio Neto de Venta" con `baseCost: 'tripleNeto'`, margen 15% sobre
venta, redondeo entero → PVP exportado `8.266 €` = `7025,8733.../(1-0,15)` redondeado.
Confirmado también que la tarifa normal (sin aportaciones) importa igual que siempre, sin
rellenar los campos nuevos (regresión cero).

## Consecuencias

### Positivas
- Un único fichero mensual (cuando llega "con aportaciones") alimenta los tres niveles de
  coste sin trabajo manual adicional.
- Generalizable a cualquier proveedor futuro que traiga su propio desglose de rappels con
  el mismo patrón (columna final ya calculada por envase/caja).

### Negativas / trade-offs aceptados
- Si Repsol cambia el texto exacto de las cabeceras "Precio Neto..." de forma más drástica
  (no solo reordena columnas), la detección por conteo de "NETO" podría fallar — aceptable
  por ahora, se ajustará si ocurre.
- El fichero "con aportaciones" no llega siempre — cuando solo llega la tarifa normal,
  `costNetoNeto`/`costTripleNeto` quedan con el valor de la última vez que se importó una
  tarifa con aportaciones (no se borran). Aceptable: son datos que cambian con poca
  frecuencia y no tiene sentido perderlos solo porque ese mes no llegó el desglose.

## Referencias

- `js/profiles/profile-repsol.js`, `js/core/db.js`, `js/screens/screen-rules.js`,
  `js/screens/screen-compare.js`, `js/screens/screen-export.js`, `js/export/excel-writer.js`.
- [ADR 0008](0008-rediseno-4-pantallas.md) — modelo original de `priceLevels` y maestro.
- [ADR 0009](0009-rebrand-map.md) — mismo fichero de origen (agosto 2026), otra casuística.
