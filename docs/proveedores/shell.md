# Shell

## Estado
- **Versión de app:** v0.9.0 (2026-07-31) — implementado
- **Última tarifa procesada:** `Tarifa Shell Recanvis Ibiza Abril 2026.xlsx`
- **Última actualización de este documento:** 2026-07-31

## Formato de la tarifa entrante

La más simple de las auditadas hasta ahora: **una sola hoja**, cabecera en la fila 1, sin
secciones ni familias intercaladas, 492 filas de producto.

| Columna Excel | Campo interno | Notas |
|---|---|---|
| `Material` | `ref` | Código SAP numérico. |
| `Descripción de Material` | `description` (base) | Código interno de Shell, no un nombre comercial limpio — ver más abajo. |
| `Litros envase` | `liters` | Ya viene como número real y exacto (no bucketizado a formatos nominales redondos como otros proveedores) — 209L, 170L, 180L, 0.25/0.38/0.4L, etc. |
| `Gama` | `gama` | Familia/línea de producto de Shell (Advance, Helix, Rimula, Spirax, Omala, Gadus, Tellus…) — se usa tal cual, 23 gamas reales. |
| `Precio €/lt` | `costPerPack` (calculado) | **Precio por litro, no por envase** — ver más abajo. |

### La columna de precio es €/litro, no por envase (crítico)

A pesar de que Yako la describió como "nuestro precio de factura, sin más descuentos ni
aportaciones", la cabecera real de la columna dice **"Precio €/lt"**, y los números solo
cuadran como precio por litro: un bidón de 209L a un supuesto "precio de factura" plano
de 5,16€ sería absurdo, pero 5,16€/L × 209L ≈ 1.078€ es un precio de bidón industrial
realista. `costPerPack = Precio €/lt × Litros envase`. Verificado también que el precio
por litro es coherente entre formatos de un mismo producto (1L vs 4L de `Adv4TUlt10W40
SPMA2` dan precios/litro parecidos, como cabe esperar).

### Descripción: código SAP interno, no nombre comercial (pendiente)

`Descripción de Material` es un código abreviado tipo SAP, no siempre legible: por
ejemplo `"Adv4TUlt10W40SPMA2_12*1L_EURO"` (donde "Adv4TUlt" es "Advance 4T Ultra"
mal abreviado) o, en otros casos, ya razonablemente legible: `"Corena S2 P 100_1*209L_A246"`.
Yako avisó que "está algo de locos" y va a pasar una tabla con las descripciones antiguas
+ referencias para reconstruirlas bien.

**Solución provisional actual**: se usa la parte del texto antes del primer `_`
(descartando el resto, que es unidades×envase + código de especificación — información
que ya tenemos de columnas separadas) y se le añade el sufijo de litros propio, igual
que el resto de proveedores (`"Corena S2 P 100_1*209L_A246"` → `"Corena S2 P 100 209L"`).
Para los códigos mashed-together como "Adv4TUlt10W40SPMA2" el resultado sigue siendo
críptico — pendiente de la tabla de Yako para arreglarlo correctamente.

### Fila duplicada

Se encontró 1 fila exactamente duplicada (mismo Material, descripción, litros y precio)
— se deduplica silenciosamente al importar, sin pérdida de información (a diferencia del
caso de Racing Oil, aquí ambas copias son idénticas, no productos distintos).

## Notas de negocio — fórmula de PVP por formato

Yako usa esta fórmula histórica para Shell: `PVP = PRECIO FACTURA / X / 0,50`, con `X`
según el formato:

| Formato | X | Margen equivalente sobre venta |
|---|---|---|
| 1L / 5L | 0,60 | 70% |
| 20L | 0,70 | 65% |
| 50L / 200L | 0,74 | 63% |
| 1000L | 0,80 | 60% |

Esto es exactamente el modelo "margen sobre venta" que ya usa la app
(`PVP = Coste / (1 - margen/100)`) — se traduce a un margen por formato configurable en
Reglas (`byFormat`), no hace falta código nuevo. **Importante**: los litros reales de
Shell no siempre caen en los formatos nominales redondos (209L en vez de 200L, 170/180L
en vez de 200L) — al configurar `byFormat` en Reglas hay que usar la clave del litraje
real (`"209"`, no `"200"`), no una versión redondeada.

## Estado en la app

**Implementado en v0.9.0.** `js/profiles/profile-shell.js`, perfil `shell`, 23 gamas
activas en `BRANDS`. Probado contra la tarifa real de abril 2026: 491 filas (492 menos 1
duplicado exacto), 0 sin litros detectados, import → MasterDB → Exportación verificado
en navegador.

**Pendiente**: reconstruir las descripciones ilegibles con la tabla de referencias que
Yako va a aportar (no bloquea el uso normal — el código de producto real y los litros ya
son correctos, solo el nombre mostrado es menos legible de lo ideal en algunos casos).

## Referencias

- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Shell/Tarifa Shell Recanvis Ibiza Abril 2026.xlsx`
- Decisión de diseño: [ADR 0018](../decisiones/0018-perfil-shell.md)
