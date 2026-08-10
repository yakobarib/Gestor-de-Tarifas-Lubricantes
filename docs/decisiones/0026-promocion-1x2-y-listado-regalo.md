# ADR 0026 — Promoción "1+2" y listado "Valor Regalo 1+1"

**Fecha:** 2026-08-10
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako plantea dos conceptos de venta especial, decididos caso a caso por marca, no algo
permanente en la tarifa:

> 1+2: el cliente compra una caja sin descuento y se lleva dos cajas sin cargo — lo mismo
> que comprar las tres con un 66,6666% de descuento. Yo hacía coste / 0,5 (ganancia mínima,
> el 100% del coste) y luego / 0,33 para conseguir un PVP al que se le pudiera aplicar ese
> descuento.
>
> 1+1+regalo: el cliente compra una caja sin descuento, se lleva solo una caja adicional,
> y valoramos esa caja en dinero para dárselo en regalos por ese importe. Podría salir un
> listado aparte de cuánto dinero genera cada 1+1, por producto.

Aclaraciones tras preguntas de seguimiento: el margen es **sobre venta** (coincide con el
`mode: 'sale'` ya existente en `priceLevels`, no requiere una fórmula nueva); el PVP
resultante va a Skrit igual que cualquier otro nivel; solo aplica a formatos de **hasta 5
litros**; el valor del regalo es el **coste bruto** (no el PVP) de la caja adicional, en la
tarifa de coste que use ese nivel; el listado de regalo solo tiene sentido — y solo debe
aparecer — si el nivel "1+2" está configurado para esa marca/gama.

## Decisión 1 — "1+2" no necesita motor de cálculo nuevo

`coste / 0,5 / 0,33` es aritméticamente `coste × 6`, exactamente lo que ya produce
`Pricing.pvpFromMargin(coste, m, 'sale')` con `m ≈ 83,333...%` (`PVP = coste / (1 - m/100)`,
y `1 - 0,8333... = 0,1666... = 1/6`). Se implementa como un preset más de `priceLevels`
(`id: 'promo_1x2'`, `defaultMargin: 83.33`, redondeado a 2 decimales igual que el resto de
márgenes de la app) — cero código nuevo en `pricing.js` para el cálculo del PVP en sí.

## Decisión 2 — Restricción por litraje real (`maxLiters`)

Los niveles restringidos existentes (`onlyFormats`, ADR 0015) usan una lista fija de
`formatKey` conocidos por marca. "1+2" en cambio aplica a "hasta 5 litros" en abstracto,
válido para cualquier marca sin tener que enumerar sus formatKeys de 0,3L/0,4L/1L/4L/5L uno
a uno. Se añade `maxLiters` (número) a la config de nivel: en `Pricing.compute()`, si
`row.liters == null` (no se pudo detectar litraje) o `row.liters > cfg.maxLiters`, el nivel
no aplica (`noCost: true`), igual que hace `onlyFormats` — salvo que exista un PVP manual
para esa ref, que siempre manda. En `screen-rules.js`, el editor de margen por formato
filtra igual: solo se pueden fijar márgenes específicos para formatos con litraje ≤
`maxLiters`.

## Decisión 3 — Listado "Valor Regalo 1+1" condicionado a que exista el nivel "1+2"

No es un toggle independiente ("1+2 Habilitado"): es, literalmente, si la marca/gama activa
tiene un `priceLevel` con `id: 'promo_1x2'` añadido en Reglas (con "Añadir nivel"/
"Eliminar", el mecanismo que ya existe). Si no existe, el listado no aparece como opción en
Exportación — no tiene sentido calcular un regalo para una promo que no está configurada.

El valor de cada fila es el **coste resuelto** (`Pricing.resolveCost`, no el PVP) según la
`baseCostField`/`costCascade` del nivel "1+2" de esa marca/gama, aplicando las mismas
restricciones de formato/litraje que el nivel — así el listado y el PVP de "1+2" siempre
están en el mismo universo de filas (si una fila no puede tener "1+2", tampoco tiene
regalo). Se exporta con las columnas Ref/Estado/Producto/Litros/Descripción/Valor Regalo
1+1 (mismo patrón WYSIWYG que el resto de listados de Exportación, ADR 0023): lo que se ve
en la previsualización es exactamente lo que sale en el Excel.

## Verificación

Probado en navegador (Castrol, nivel "1+2" añadido en Todas las gamas):
- Editor de formato de "1+2" solo ofrece los formatKeys ≤5L (`0.3/0.4/1/4/5`), excluyendo
  20/25/208/1000.
- Previsualización de `level:promo_1x2`: filas ≤5L con margen 83,3% y PVP = coste×6 exacto
  (ej. `CAT15CD1C`: coste 7,74€ → PVP 46,44€); filas >5L con "—" en margen/PVP/ganancia.
- `list:regalo_1x1` solo aparece en el selector de Exportación mientras existe el nivel
  "1+2"; desaparece en cuanto se elimina desde Reglas.
- Export a Excel de ambos tipos coincide fila a fila con la previsualización en pantalla
  (186 filas ≤5L en ambos casos, mismos valores).

## Consecuencias

- `js/core/pricing.js`: nueva restricción `maxLiters` en `compute()`; `resolveCost()` ahora
  exportado públicamente (lo reutiliza `screen-export.js` para el listado de regalo).
- `js/screens/screen-rules.js`: preset `promo_1x2`; filtrado del editor de formato por
  `maxLiters` además de por `onlyFormats`.
- `js/screens/screen-export.js`: `promo1x2LevelFor()`/`regaloValueFor()`; opción
  `list:regalo_1x1` condicionada a la existencia del nivel; caso especial en la tabla de
  previsualización y en la exportación real.
- `app/index.html`: opción "1+2" en el selector de preset de Reglas.

## Referencias

- `js/core/pricing.js`, `js/screens/screen-rules.js`, `js/screens/screen-export.js`.
- [ADR 0015](0015-nivel-bidones-cubas-neto.md) (precedente de nivel restringido por
  formato), [ADR 0023](0023-listado-calculado-en-exportacion.md) (WYSIWYG previsualización
  → export).
