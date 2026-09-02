# ADR 0071 — `formatKey` no se pisa con "?" en una reimportación fallida

**Fecha:** 2026-08-31
**Estado:** Aceptada
**Decidido por:** Yako (bug detectado revisando las referencias sin formato de Repsol)

## Contexto

De las 10 referencias de Repsol reportadas con formato "?" (ver conversación anterior),
Yako no entendía por qué 5 de ellas (`LM448F15`, `RPP9061ZNB`, `RPP9063ZNA`, `RPP9071ZPC`,
`RPP9074ZPC`) tenían **litros correctos** (18L, 0,15L, 0,25L, 0,3L, 0,3L) pero **formato
"?"** — si los litros están bien, el formato debería derivarse de ellos sin problema.

Investigado en `db.js` (`putRows`, fusión fila a fila): el campo `liters` tiene una
guardia correcta contra reimportaciones que fallan al extraer el dato —
`r.liters != null ? r.liters : existing.liters` — así que si una tarifa más reciente de
Repsol no logra extraer los litros de la descripción de esa fila (ej. cambia ligeramente
la redacción del producto entre meses), se queda con el valor ya conocido de antes en vez
de borrarlo.

El campo `formatKey` NO tenía esa misma guardia: `r.formatKey || existing.formatKey`. El
problema es que `'?'` es un string no vacío — **truthy en JavaScript** — así que
`r.formatKey || existing.formatKey` nunca llega a mirar `existing.formatKey`: un
`'?'` de una reimportación fallida siempre gana, aunque ya hubiera un formato bueno
guardado de antes. Resultado exacto del bug: `liters` se conserva bien (18, 0.15…) porque
su guardia es honesta, pero `formatKey` se pisa con `'?'` porque la suya no lo es —
exactamente la discrepancia que vio Yako.

## Decisión

`db.js`: cambiar la guardia de `formatKey` para tratar `'?'` como "sin dato", igual que
`liters` trata `null` como "sin dato":

```js
formatKey: verified ? Parser.formatKey(verified.liters)
  : ((r.formatKey && r.formatKey !== '?') ? r.formatKey : (existing ? existing.formatKey : '?')),
```

Comportamiento sin cambios cuando la reimportación SÍ logra extraer un formato real —
solo cambia el caso "esta reimportación no pudo, pero ya había uno bueno guardado".

## Reparación de los datos ya afectados

Las 5 filas ya corrompidas en Neon (`imported_tariff_rows`, marca `repsol`) se corrigieron
directamente vía conexión Postgres, recalculando `format_key` a partir del `liters` ya
correcto de cada una (mismo criterio que `Parser.formatKey`: redondeo a 3 decimales,
convertido a texto) — el fix de código de arriba solo evita que el bug vuelva a pasar en
futuras reimportaciones, no repara solo lo que ya estaba mal.

## Las otras 5 (sin cambios, no eran un bug)

Las otras 5 referencias del lote original (`RPP8001EJG`, `RPP8003EJG`, `RPP8031GJG`,
`RPP8080EJG`, `RPP8130EJG`) sí se quedan en "?" — son grasas en cartucho medidas en
**gramos**, la app no convierte peso a litros (ver `Parser.extractLiters`), así que nunca
tuvieron un formato real que pisar. Yako señaló además que el peso real de estos cartuchos
es 400g, no 40g como aparece en la descripción — dato tal cual viene en la tarifa de
Repsol (`description_raw` sin transformar), no algo que la app calcule o pueda corregir;
queda como nota para revisar con el proveedor si procede, sin acción de código.

## Verificación

- `node --check` sobre `db.js`.
- Consulta directa a Neon antes/después: referencias de Repsol con `liters`/`format_key`
  sin resolver bajó de 10 a 5 (las 5 restantes son, correctamente, las de peso en gramos).

## Referencias

- `js/core/db.js` (`putRows`).
- `js/core/parser.js` (`formatKey`, `extractLiters`).
- `js/profiles/profile-repsol.js` (origen de `liters`/`formatKey` en cada import).
