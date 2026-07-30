# Eni Live

## Estado
- **Versión de app:** v0.8.0 (2026-07-30) — implementado
- **Última tarifa procesada:** `Tarifa Eni Live - Lubricantes 13 Abril 2026.xlsx`
- **Última actualización de este documento:** 2026-07-30

## Formato de la tarifa entrante

Archivo Excel con **una hoja por gama de producto** (9 hojas de datos + 2 informativas
sin productos: `Capacidad palet`, `Plazo de entrega pedidos`, que se ignoran). Todas
comparten la misma estructura de fondo, con variaciones de detalle por hoja:

| Hoja (gama) | Columna litros/kg | Tiene TARIFA 2 |
|---|---|---|
| `i-Sint` | `LITROS UNIDAD` | Sí |
| `i-Sigma` | `LITROS UNIDAD` | Sí |
| `Rotra` | `LITROS UNIDAD` | **No** (usa Tarifa 1) |
| `Industria` | `LITROS / KG UNIDAD` | Mixto fila a fila |
| `i-Ride` | `LITROS UNIDAD` | **No** (usa Tarifa 1) |
| `Food-Line` | `KG. UNIDAD` (solo kg) | Sí |
| `Grasas` | `KG. UNIDAD` (solo kg) | **No** (usa Tarifa 1) |
| `Forestal` | `LITROS / KG UNIDAD` | Sí |
| `Anticongelantes` | `LITROS UNIDAD` (kg en algunos formatos grandes) | Sí (col. "NETO PALET (REFERENCIA) TARIFA 2") |

Cabecera real en la **fila 7** (índice 6) de cada hoja — se detecta buscando la fila
cuya primera columna sea exactamente `CODIGO`, no por número de fila fijo (varía 1 fila
entre hojas por comentarios sueltos en cabecera).

Filas de subtítulo de sección (`LUBRICANTES DE MOTOR`, `CAJAS DE CAMBIO MANUALES O
ROBOTIZADAS`…) solo rellenan la columna A y no tienen `PRODUCTO` — se detectan y se usan
como valor de `FAMILIA` para las filas de producto siguientes, hasta la próxima.

## Columnas relevantes

| Columna Excel | Campo interno | Notas |
|---|---|---|
| `CODIGO` | `ref` | Alfanumérico (`G03093`, `2530G3`…), no siempre numérico puro. |
| `PRODUCTO` | `description` (base) | Eni no incluye los litros en el nombre — se le añade el sufijo (`5L`, `400ML`…) al reconstruir `description`. Se quita el prefijo `"eni "` / `"Eni "`. |
| `LITROS UNIDAD` / `KG. UNIDAD` / `LITROS / KG UNIDAD` | `liters` | Ver conversión kg→L abajo. |
| `TARIFA 2` (no la variante "UNIDAD DE VENTA") | `costPerPack` | Precio final por envase individual — **el que se usa**. Si la fila no tiene Tarifa 2, se cae a `TARIFA 1` (fila a fila, no por hoja: en `Industria` hay referencias sueltas sin Tarifa 2 aunque la mayoría de la hoja sí la tenga). |
| — (subtítulo de sección) | `fam` | Familia contextual, no un código — texto libre tal cual aparece en la tarifa. |

Columnas descartadas explícitamente (peso, EAN/DUN, P.V.P.R., UDS. POR ENVASE/CAJA,
DESCUENTO %, STATUS, PAIS, y las variantes "UNIDAD DE VENTA" de cualquier tarifa): no
afectan al precio final, ver [reglas de negocio](../reglas-negocio.md).

**"UNIDAD DE VENTA" no es "por unidad".** Es al revés de lo que sugiere el nombre: la
columna simple (`TARIFA 2`) ya es el precio por envase individual; `TARIFA 2 UNIDAD DE
VENTA` es ese mismo precio multiplicado por `UDS. POR ENVASE` (el precio de la caja
cuando varios envases pequeños se venden agrupados). Confirmado cruzando los datos reales
de `i-Sint`: fila con `UDS. POR ENVASE=4`, `TARIFA 2=18,87` y `TARIFA 2 UNIDAD DE
VENTA=75,47` (= 18,87 × 4).

## Conversión kg → L (Food-Line, Grasas, Forestal, Industria, Anticongelantes)

Varias gamas dan el formato del envase en **kg** en vez de litros. No es una conversión
de densidad genérica: son pesos reales de envases estándar, y el mismo envase nominal
pesa distinto según el producto (aceites de food-grade especialmente). Se resuelve por
**rango de peso**, no por igualdad exacta — confirmado por Yako con Food-Line, donde el
envase "grande" pesa 165, 170, 175, 180, 185 o 200 kg según el aceite y siempre son 205 L:

| Peso (kg) | Envase (L) |
|---|---|
| ≤ 2 | 0.4 (400 ml) |
| ≤ 10 | 5 |
| ≤ 35 | 20 |
| ≤ 100 | 50 |
| ≤ 500 | 205 |
| ≤ 1200 | 1000 |

Implementado en `KG_BUCKETS` dentro de `js/profiles/profile-eni.js`. Hay además un caso
de formato de origen inconsistente: alguna fila trae el peso como número pelado sin
`"kg."` (ej. `731111` en `Industria`, valor `180` a secas) o con la unidad en plural
(`"170 kgs."` en vez de `"170 kg."`) — el parser cubre ambos casos.

## Estado en la app

**Implementado (v0.8.0).** `js/profiles/profile-eni.js`, perfil `eni`, 9 gamas activas
en `BRANDS` (`js/core/brands.js`). Probado contra la tarifa real de abril 2026: 593
filas, 0 sin litros detectados, 0 duplicados, import → MasterDB → Reglas → Exportación
verificado en navegador.

## Referencias

- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Eni/Tarifa Eni Live - Lubricantes 13 Abril 2026.xlsx`
- Decisión de diseño: [ADR 0011](../decisiones/0011-perfil-eni-live.md)
