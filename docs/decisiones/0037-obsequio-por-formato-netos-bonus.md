# ADR 0037 — Coste de obsequio editable por formato en Netos Bonus

**Fecha:** 2026-08-13
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

En Reglas/Netos Bonus, el PVP se calcula desde la base de coste elegida, el modo de
margen, el redondeo o un PVP manual — pero ese precio de venta además lleva sumado el
coste de un obsequio, que **depende del producto y del formato**. Yako pide, como primer
paso ("el del formato es fácil implementarlo"), una fila **OBSEQUIO** debajo de la fila
de margen, por formato, donde introducir el importe en € y que se sume para calcular el
PVP de Netos Bonus. La parte "depende del producto" (más fina que por formato) queda
fuera de esta iteración.

`pricing.js::compute()` ya sumaba un `cfg.premiumByFormat[formatKey]` al coste antes de
aplicar el margen (ver ADR 0016) — pero ese importe solo existía como semilla fija
(`BONUS_PREMIUM_BY_FORMAT`: 50€ para envases ~200L, 100€ para ~1000L, cualquier otro
formato a 0€) sin ningún control en la UI para cambiarlo. La pieza que faltaba era
exclusivamente de pantalla.

## Decisión

`formatTableHtml()` (`screen-rules.js`) añade, solo para el nivel `netos_bonus`, una fila
**"Obsequio (€)"** justo debajo de "Margen (%)" — un `<input type="number">` por formato,
ligado a `lvl.premiumByFormat[formatKey]` (vacío = sin obsequio, igual que el margen
vacío cae al valor por defecto, aunque aquí no hay "obsequio por defecto": un formato sin
valor puesto no suma nada). Nueva `updatePremiumByFormat()`, simétrica a
`updateByFormat()` ya existente para el margen.

## Bug encontrado y corregido de paso

Al cablear el nuevo campo, ninguna edición se guardaba — el listener de "change" de
`levelsContainer` lee `e.target.dataset.index`, pero ni el `<input data-field="byFormat">`
del margen ni (recién escrito) el de "Obsequio" llevaban `data-index` en sí mismos, solo
la `<table>` contenedora lo tenía. Confirmado que esto afecta también al margen por
formato ya existente: **nunca se guardó**, desde que existe esa fila, cualquier valor
puesto en "Margen (%)" por formato — silenciosamente se perdía al cambiar de pantalla
(sin error visible, porque el `if (index == null) return;` sale en silencio). Corregido
añadiendo `data-index="${lvl._index}"` a ambos inputs.

## Verificación

Con filas de prueba en el maestro (IndexedDB) y `config_ad_parts_aceite_normal`: editar
"Margen (%)" del formato 208L a 25 y "Obsequio (€)" del mismo formato a 75 — ambos quedan
en `Storage.get('config_ad_parts_aceite_normal').priceLevels` tras el `change` (antes del
fix, ninguno de los dos se guardaba). `Pricing.compute(row208, bonusLevel)` con el nuevo
obsequio (75€) sobre coste triple-neto 480€ y margen 20% sobre venta: PVP =
(480+75)/0,8 = **693,75 €** (antes del cambio, con obsequio 50€: (480+50)/0,8 = 662,50 €)
— confirma que el importe editado sí se suma al coste antes del margen. Consola sin
errores.

## Consecuencias

- `js/screens/screen-rules.js`: fila "Obsequio (€)" en el nivel Netos Bonus,
  `updatePremiumByFormat()`, y el fix de `data-index` en ambos inputs por formato
  (margen y obsequio) — el margen por formato empieza a guardarse de verdad a partir de
  esta versión.
- `js/core/pricing.js`: sin cambios — ya sumaba `premiumByFormat` correctamente, solo
  faltaba la UI para editarlo.
- Pendiente, fuera de esta iteración (lo señala el propio Yako): variación del coste del
  obsequio por producto además de por formato.

## Referencias

- `js/screens/screen-rules.js`, `js/core/pricing.js`.
- ADR 0016 (premium fijo de Netos Bonus, semilla original de este importe).
