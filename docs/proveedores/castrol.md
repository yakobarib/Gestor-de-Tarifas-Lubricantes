# Castrol

## Estado
- **Versión de app:** v0.9.2 (2026-08-03) — implementado
- **Última tarifa procesada:** `Tarifa Julio 2026 - Formato Castrol y neto neto.xlsx`
- **Última actualización de este documento:** 2026-08-03

## Formato de la tarifa entrante

Viene en dos formatos posibles ("formato AD" y "formato Castrol"); la app implementa el
**formato Castrol**, que es el que usa Yako. Un único Excel con dos hojas: `TARIFA JUNIO`
(la tarifa completa, 26 columnas) y `DATOS` (hoja de trabajo creada a mano por Yako, no
la usa la app — ver más abajo por qué es relevante).

| Columna Excel | Campo interno | Notas |
|---|---|---|
| `Material` | `ref` (con prefijo `CAT`) | Ej. `15F2D0` → `CAT15F2D0` para Skrit. |
| `Descripción de Material` | `description` (limpiada) | Mucho ruido de packaging — ver más abajo. |
| `volumen unidad de venta` / `volumen envase` | — | Confirmación de unidad de venta; los litros reales se derivan de la propia descripción (ver más abajo), no de estas columnas. |
| `Gama` / `Segmento` (subgama) | `gama` | 9 gamas activas. |
| `Familia` | `fam` | Ej. "Lubricantes Auto", "Car Ancillaries". |
| `Tarifa referencia` | — | Precio base, antes de descuentos (no se usa directamente). |
| `Unidad` | — | L o Kg — determina si hay que convertir con la tabla kg→L. |
| `Pronto Pago`, `Dto Logistico`, `Dto total` | — | Descuentos en cascada hasta llegar a "Precio Unitario". |
| `Precio Unitario` | `costFactura` (tras ×litros) | **€/litro**, no por envase — ver más abajo. |
| `Rapel fin de año`, `Precio neto litro`, 5 columnas de aportaciones (Turfview, AD 360, Objetivo CV, Acciones Marketing) | — | Descuentos adicionales en céntimos/litro, no se recalculan — Castrol ya da el resultado final en la columna Z. |
| `Precio Neto Neto envase con todas aportaciones YAKO` (columna Z, creada por Yako) | `costTripleNeto` | Coste final por envase, ya calculado. |
| `Sustituye a` | — | Ref antigua sustituida — ver duplicación más abajo. |

### Precio por litro, no por envase (igual que Shell)

La columna "Precio Unitario" es €/litro. `costFactura = precioUnitarioLitro × liters`.
Verificado fila a fila contra la cascada completa del Excel real
(`O = J×(1-N)`, `Q = O×(1-P)`, `W = Q − ΣR..V`, `Z = W×F`).

### Descripción: limpieza de ruido de packaging

Ejemplos reales de Yako:
- `"Brake Fluid DOT 4 (C), 12X1L H Q3"` → `"Brake Fluid DOT 4 1L"`
- `"EDGE 0W-20 LL IV, 4X5L H 4A"` → `"EDGE 0W20 LL IV 5L"`

Se toma el texto antes de la primera coma, se elimina cualquier paréntesis final, se
normaliza la viscosidad (`0W-20` → `0W20`) y se añade el sufijo de litros propio de la
app.

### Litros: tabla kg→L (bidones de 208L en esta marca)

```
0.4 kg → 400ML (formato mostrado como gramos/ml, no como "0.4L")
18 kg  → 20L
180 kg → 208L
```

**Sin resolver**: la tarifa real trae `CAT15EEF3 — "CLS Grease, 25K B5"` (25kg), sin
equivalencia en la tabla. Al no detectar litros, **esa fila se descarta silenciosamente
del import** (no aparece ni con error ni en el maestro). Pendiente preguntar a Yako el
volumen real de ese envase de grasa de 25kg.

### "Sustituye a": se duplica, salvo el placeholder "NUEVO"

Cuando la columna `Sustituye a` trae una referencia real, la fila se duplica también bajo
esa ref antigua (Yako lo pidió para no romper stock/Turfview a fin de mes). El valor
literal `"NUEVO"` en esa columna (26 de 104 casos no vacíos en la tarifa real) es un
placeholder de "producto nuevo, no sustituye nada" — se excluye de la duplicación.

## Estado en la app

**Implementado en v0.9.2.** `js/profiles/profile-castrol.js`, perfil `castrol`, 9 gamas
activas en `BRANDS` (`other`, `crb`, `edge`, `gtx`, `gtx-5w`, `magnatec`, `castrol-on`,
`transmax`, `vecton`), `refPrefix: 'CAT'`. Probado contra la tarifa real de julio 2026:
447 filas, 0 duplicados, import → MasterDB → Exportación (Skrit V2 y listado Neto-Neto)
verificado en navegador.

Al probarlo en navegador se detectaron y corrigieron dos colisiones de detección
automática de proveedor con Repsol y Shell (ambos compartían convenciones de nombre de
hoja/columna con Castrol) — ver [ADR 0019](../decisiones/0019-perfil-castrol.md) para el
detalle.

**Pendiente**: volumen real del envase de grasa de 25kg (`CAT15EEF3`), única ref que se
pierde en el import.

## Referencias

- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Castrol/Tarifa Julio 2026 - Formato Castrol y neto neto.xlsx`
- Decisión de diseño: [ADR 0019](../decisiones/0019-perfil-castrol.md)
