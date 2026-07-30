# ADR 0011 — Perfil Eni Live: Tarifa 2 con fallback fila a fila, y conversión kg→L por rango

**Fecha:** 2026-07-30
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Eni Live es el segundo proveedor implementado tras Repsol. A diferencia de Repsol (una
sola hoja, un precio), Eni reparte el catálogo en 9 hojas de gama distintas (i-Sint,
i-Sigma, Rotra, Industria, i-Ride, Food-Line, Grasas, Forestal, Anticongelantes) con la
misma estructura de fondo pero variaciones fila a fila que solo aparecieron al cruzar los
datos reales de la tarifa de abril 2026, no al leer las cabeceras.

## Decisión 1 — Precio: Tarifa 2 con fallback a Tarifa 1, por fila, no por hoja

Yako confirmó que la columna `TARIFA 2` (nunca su variante "UNIDAD DE VENTA", que es el
precio por envase × unidades por envase, no el precio por unidad) es el coste final por
envase a usar. Cuando una gama no tiene Tarifa 2 (Rotra, i-Ride, Grasas) se usa Tarifa 1.

Al probar contra el fichero real se descubrió que ese fallback también hace falta **fila
a fila** dentro de una misma hoja: en `Industria`, la mayoría de referencias sí tienen
Tarifa 2, pero 83 de 158 no la tienen (formatos "Import." o de baja rotación) y solo
tienen Tarifa 1. Una primera versión que elegía la columna de precio una vez por hoja
(según si la hoja *en general* tenía Tarifa 2) descartaba esas 83 filas enteras al
encontrar la celda vacía. Se corrigió para leer ambas columnas por fila y decidir el
fallback ahí.

## Decisión 2 — Litros: columna directa, con conversión kg→L por rango de peso

A diferencia de Repsol (litros solo derivables de la descripción), Eni da los litros del
envase en una columna propia — pero en 5 de las 9 gamas (Food-Line, Grasas, Forestal,
Industria, Anticongelantes) esa columna está en **kg**, no en litros.

Se auditó cada valor de kg presente en el fichero real y se pidió a Yako el equivalente en
litros de cada uno. El resultado no es una tabla de densidad genérica (1 kg ≈ 1 L): son
los pesos reales de los 6 envases estándar de Eni, y el mismo envase nominal pesa distinto
según el producto — confirmado con Food-Line, donde el envase "grande" aparece como 165,
170, 175, 180, 185 o 200 kg según el aceite, y en los 6 casos son 205 L. Por eso la
conversión se implementó como **rango de peso → envase nominal** (`KG_BUCKETS` en
`profile-eni.js`), no como igualdad exacta:

| Peso (kg) | Envase (L) |
|---|---|
| ≤ 2 | 0.4 |
| ≤ 10 | 5 |
| ≤ 35 | 20 |
| ≤ 100 | 50 |
| ≤ 500 | 205 |
| ≤ 1200 | 1000 |

Los límites de cada rango se sitúan a medio camino entre los pesos reales observados,
con margen amplio a cada lado — no hay ambigüedad posible entre rangos porque los envases
estándar de Eni están muy separados en peso (ningún producto real cae cerca de un límite).

También se encontraron dos inconsistencias de formato de origen que el parser cubre sin
necesidad de decisión de negocio: un peso pelado sin la unidad `"kg."` (`Industria`,
ref `731111`, celda con el valor `180` a secas) y una variante en plural `"kgs."` en vez
de `"kg."` (`Industria`, ref `451012`).

## Decisión 3 — Descripción sintética con litros añadidos

Eni es el único proveedor auditado hasta ahora cuya descripción de producto **no**
incluye el formato (`"eni i-Sint XEF 0W16"` en vez de `"...5L"`). Yako pidió reconstruirla
al estilo del resto de proveedores (`"I-Sint XEF 0W16 5L"`): se quita el prefijo `"eni "`
y se añade el sufijo de litros ya resuelto (`5L`, `20L`, `400ML`…) a partir de la columna
de litros, no de un parseo de texto — más fiable que `Parser.extractLiters()` porque aquí
el dato ya viene estructurado.

## Consecuencias

- `js/profiles/profile-eni.js`: nuevo perfil, 9 gamas.
- `BRANDS.eni` pasa de `pending: true` a `false` con las 9 gamas reales
  (`js/core/brands.js`).
- Verificado con harness de Node contra la tarifa real: 593 filas, 0 sin litros
  detectados, 0 duplicados — y en navegador de punta a punta (import → MasterDB →
  Reglas → Exportación).
- Detalle completo de columnas por hoja en
  [docs/proveedores/eni-live.md](../proveedores/eni-live.md).
