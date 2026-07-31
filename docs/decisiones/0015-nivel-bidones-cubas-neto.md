# ADR 0015 — Nivel "Bidones y Cubas Neto" restringido por formato

**Fecha:** 2026-07-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

De los 6 tipos de exportación pedidos (PVP, Neto Factura, Neto-Neto, Bidones y Cubas
Neto, Netos Bonus, Netos Especiales — ver ADR 0014), Yako terminó de explicar la lógica
de "Bidones y Cubas Neto":

> Se saca del neto compra factura + en bidones de 200L (200 le llamo a los de 185, 200,
> 205, 208 y 209 litros) se le carga un 20% sobre el precio de venta, y en cubas de 1000
> litros (también los de 850 kilos y alrededores) se le carga un 15% sobre el precio de
> venta.

Es decir: coste factura, margen sobre venta del 20% para envases de ~200L (185, 200,
205, 208 o 209 — varía por proveedor) y del 15% para cubas de 1000L. Fuera de esos dos
formatos, este nivel no tiene precio — "en bidones y cubas utilizamos precios netos en
vez de PVP" (los formatos pequeños siguen usando el PVP normal, no este nivel).

## Problema: los niveles existentes no pueden "no tener precio" por formato

El sistema de `priceLevels` ya soporta margen distinto por formato (`byFormat`), pero
siempre calcula ALGÚN precio para cualquier fila — si un formato no está en `byFormat`,
cae al `defaultMargin`. Para "Bidones y Cubas Neto" eso es incorrecto: un envase de 5L no
debe tener NINGÚN precio en este nivel (ni siquiera a 0% de margen), porque conceptualmente
no existe un "neto bidón" para un envase de 5L.

## Decisión: `onlyFormats` en `Pricing.compute`

Se añade un campo opcional `onlyFormats` (array de `formatKey`) al nivel de precio. Si
está presente y la fila no es de uno de esos formatos, `Pricing.compute` devuelve
`{ pvp: null, noCost: true, ... }` inmediatamente — igual que cuando falta el coste base
— en vez de calcular un PVP con el margen por defecto. Cambio aditivo: los niveles que no
declaran `onlyFormats` (todos los existentes) no se ven afectados.

Nuevo preset en Reglas, `cubas_neto`:
```js
{
  id: 'cubas_neto', label: 'Bidones y Cubas Neto',
  baseCost: 'factura', mode: 'sale',
  onlyFormats: ['185', '200', '205', '208', '209', '1000'],
  byFormat: { '185': 20, '200': 20, '205': 20, '208': 20, '209': 20, '1000': 15 },
  rounding: '2dec', goesToSkrit: true
}
```

`exportSkritV2` ya descarta filas con `pvp == null`, así que el export a Skrit con este
nivel solo saca las referencias de esos dos formatos — sin cambios en el export en sí.

## Verificación

Probado con la tarifa real de Repsol (gama Automoción): de las filas de esa gama, solo
salen las de 208L (20%) y 1000L (15%) — 180 de las ~525 filas totales. Verificado el
cálculo exacto en 2 filas: coste 7.837,65€ (1000L) → PVP 9.220,77€ (÷0,85, 15%); coste
1.499,58€ (208L) → PVP 1.874,48€ (÷0,80, 20%).

## Resuelto después

- **Netos Bonus**: implementado en [ADR 0016](0016-nivel-netos-bonus.md) — coste en
  cascada (triple-neto → neto-neto → factura) + precio del premio (50€/100€) + mismo
  20%/15% que este nivel.
- **Netos Especiales**: Yako confirmó que no hace falta — se cubre con un nivel
  personalizado en Reglas + export PVP existente, sin código nuevo.

## Referencias

- `js/core/pricing.js`, `js/screens/screen-rules.js`.
- [ADR 0014](0014-exports-neto-y-descripcion-separada.md) — contexto de los 6 tipos de
  exportación.
