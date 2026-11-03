# ADR 0097 — Reescalar los costes cuando el maestro corrige los litros

**Fecha:** 2026-11-03
**Estado:** Aceptada
**Decidido por:** Yako

## Problema

Castrol y Shell calculan el coste del envase como precio por litro × litros. Cuando el maestro
corrigió los litros de una referencia ya importada (Castrol 15F615: 20 → 5 L), la fila guardada
cambió de litros pero conservó el coste calculado con los litros antiguos: coste factura 185,43
en vez de 46,36 y PVP 618,10. Importar de nuevo la tarifa lo arreglaba, pero nada avisaba de que
había que hacerlo.

## Decisión

`MasterDB.putRows` reescala `costFactura`, `costNetoNeto` y `costTripleNeto` por
`litros nuevos / litros antiguos` cuando la fila existente tiene unos litros distintos de los
verificados en el maestro, solo para marcas de coste por litro (`castrol`, `shell`). El resultado
se empuja también a Neon. Se ejecuta en cada arranque (`applyMasterDescriptions`) y al guardar
litros desde Tarifas, así que se autocorrige en todos los ordenadores. Es idempotente: tras
reescalar, los litros coinciden y no vuelve a actuar.

El resto de marcas (Repsol, ENI, Racing Oil, AD Parts) parten del precio del envase: sus litros
no afectan al coste y no se tocan.

## Datos corregidos a mano

En Neon: `verified_descriptions` y `imported_tariff_rows` de Castrol 15F615 (5 L, coste ×0,25) y
15B1B5 (60 L, coste ×3).

## Consecuencia a vigilar

Cuatro grasas de Castrol (15A3DA, 1503AA, 15047E, 15EED5) tienen en la tarifa 20/208 y en el
maestro 25/18/18/185 (kg). Al próximo arranque se reescalarán igual que haría una reimportación.
