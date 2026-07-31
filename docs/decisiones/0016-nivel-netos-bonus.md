# ADR 0016 — Nivel "Netos Bonus": coste en cascada + precio del premio

**Fecha:** 2026-07-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Último de los 6 tipos de exportación pendientes del ADR 0014. Yako dio la fórmula en dos
pasadas, la segunda corrigiendo una contradicción de la primera:

> Neto bonus = triple neto (si dispone de triple neto y si no doble y si no precio de
> factura, siempre el precio más bajo disponible) + precio del premio + margen.
> El precio del premio es 50€ para bidones y 100€ para cubas, que hay que incrementarle
> al coste; en bidones se carga un 20% sobre el precio de venta y en cubas de 1000L un
> 15% sobre el precio de venta.

Mismo desglose de formato (bidones ~200L / cubas 1000L) y mismos porcentajes (20%/15%)
que "Bidones y Cubas Neto" (ADR 0015) — la diferencia es la base de coste (cascada en vez
de solo factura) y el "precio del premio" sumado antes del margen.

## Decisión 1 — Coste en cascada (`costCascade`)

Hasta ahora todo nivel tenía una única fuente de coste (`baseCostField`). Se añade un
campo opcional `costCascade` (array de campos, en orden de preferencia): `Pricing.
resolveCost()` recorre la lista y usa el primer campo que la fila tenga relleno,
cayendo al siguiente si no. Para Netos Bonus: `['costTripleNeto', 'costNetoNeto',
'costFactura']` — exactamente "el precio más bajo disponible" que describió Yako (más
descuentos/rappels aplicados = más bajo). Sin `costCascade`, el comportamiento de
cualquier otro nivel no cambia (usa `baseCostField` como siempre).

## Decisión 2 — "Precio del premio" (`premiumByFormat`)

Importe fijo en euros que se suma al coste (ya resuelto por la cascada) **antes** de
aplicar el margen — no es un coste real de la fila, es el coste de los puntos/premio que
se le da al cliente. Se modela igual que `byFormat` (mapa `formatKey → importe`):
`{ '185': 50, '200': 50, '205': 50, '208': 50, '209': 50, '1000': 100 }`. `Pricing.
compute` lo suma al coste resuelto antes de `pvpFromMargin`, y el "gain"/margen real
informativo se calcula también sobre coste+premio (es el coste total real a cubrir).

## Nuevo preset `netos_bonus`

Reutiliza `onlyFormats`/`byFormat` de Cubas Neto (mismo desglose 20%/15% por formato) y
añade `costCascade` + `premiumByFormat`. `baseCost: 'tripleNeto'` solo se usa para el
valor por defecto mostrado en el selector "Base de coste" de Reglas — el cálculo real
siempre usa la cascada, no ese campo único (limitación de UI aceptada: cambiar
manualmente ese selector no rompe nada porque `costCascade` manda, pero tampoco refleja
fielmente que hay 3 costes en juego).

## Verificación

Probado con la tarifa real "con aportaciones" (única con los 3 niveles de coste
presentes). 2 filas verificadas a mano:
- 1000L, `costTripleNeto=7.025,87€` → `(7.025,87 + 100) / 0,85 = 8.383,38€` ✓
- 208L, `costTripleNeto=1.338,41€` → `(1.338,41 + 50) / 0,80 = 1.735,51€` ✓

## Netos Especiales — descartado

Yako confirmó que no hace falta implementarlo: se resuelve creando un nivel personalizado
en Reglas ("Añadir nivel" con margen a medida) en el momento que se necesite, y
exportándolo como PVP — ya cubierto por el sistema de `priceLevels` existente, sin
código nuevo.

## Consecuencias

- `js/core/pricing.js`: `resolveCost()`, soporte de `costCascade` y `premiumByFormat`
  en `compute()`.
- `js/screens/screen-rules.js`: preset `netos_bonus`; se retira el preset provisional
  `precio_bonus` ("Precios para Bonus", 10% sobre compra, nunca a Skrit) — era una
  suposición previa a conocer la fórmula real, sustituida por esta.
- `app/index.html`: opción "Netos Bonus" en el selector de preset; se quita "Precios
  para Bonus".

## Referencias

- `js/core/pricing.js`, `js/screens/screen-rules.js`.
- [ADR 0014](0014-exports-neto-y-descripcion-separada.md), [ADR 0015](0015-nivel-bidones-cubas-neto.md).
