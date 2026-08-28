# ADR 0065 — Fórmula de PVP en dos pasos: margen + hueco de descuento a cliente

**Fecha:** 2026-08-27
**Estado:** Aceptada
**Decidido por:** Yako (jefe de departamento)

## Contexto

Al revisar el nuevo PDF de políticas (ADR 0064), Yako se dio cuenta de que "1+2"/"PVP Neto"
no funcionaban como él esperaba: hoy **sustituyen** el margen configurado por una fórmula
fija (83,3% para "1+2", 20%/15% para "PVP Neto" — ver antiguo ADR 0026 v2), así que el
margen que Yako pone a mano en "Margen por formato" queda ignorado en cuanto se activa
cualquiera de los dos interruptores.

Lo que Yako quiere en realidad es un cálculo en **dos pasos independientes**:
1. Aplicar el margen que él ha puesto (o el margen por defecto) — el mínimo que la empresa
   necesita ganar.
2. Sobre ese resultado, dejar un **hueco para poder descontar al cliente** sin bajar nunca
   de ese margen mínimo — la empresa vende con descuentos por tipo de cliente (habituales
   hasta -50%, ocasionales -20/-30%) y necesita que el PVP de partida ya lo contemple.

Verificado con su Excel real de trabajo (`Plantilla Tarifas Aceites 2026 V7.xlsx`, hoja
`COEF`/`PANEL CONTROL CA`) y con varias rondas de ejemplos numéricos cruzados (coste=100€,
1L/20L/200L, sobre compra y sobre venta) hasta que sus propios cálculos dejaron de
contradecirse entre sí — el proceso completo, con las contradicciones encontradas y
resueltas, está en la conversación de esta sesión (2026-08-27).

## Decisión

`Pricing.compute()` (`js/core/pricing.js`) cambia de "elegir una fórmula fija según el
modo especial" a un cálculo en dos pasos, **solo para el nivel PVP** (`cfg.id === 'pvp'`
— ver más abajo por qué Netos Bonus queda fuera):

1. **Paso 1 (siempre)**: el margen de la casilla (`byFormat[formatKey]`, o si está vacía
   `defaultMargin`) — SIN sustituir por nada, tenga o no activado "1+2"/"PVP Neto en
   Bidones y Cubas". Fórmula de siempre: sobre venta = coste/(1-margen/100); sobre compra
   = coste×(1+margen/100).
2. **Paso 2 (según el interruptor de ese formato)**:
   - Ninguno activado (caso normal, la mayoría de formatos): dividir el resultado del
     paso 1 entre **0,5** (equivale a ×2) — dos veces el mismo margen configurado da
     margen de sobra para hasta un 50% de descuento a cliente sin perder el mínimo.
   - **"1+2"**: dividir entre **1/3 exacto** (equivale a ×3) — hueco de hasta ~66% de
     descuento, porque el cliente "paga 1 caja y se lleva 3".
   - **"PVP Neto en Bidones y Cubas"**: **sin paso 2** — el resultado final es el del
     paso 1 tal cual. Son formatos grandes, sin margen de descuento a cliente por diseño
     (bidones/cubas no se venden con ese tipo de descuento comercial).

Verificado con 6 casos cruzados (coste=100€, sobre venta y sobre compra, en 1L/20L/200L)
hasta que coincidieron exactamente con los cálculos manuales de Yako:

| Formato | Modo | Venta | Compra |
|---|---|---|---|
| 1L, margen 60%, "1+2" | paso1→paso2 | 250€ → **750,00€** | 160€ → **480,00€** |
| 20L, margen 45%, ninguno | paso1→paso2 | 181,82€ → **363,64€** | 145€ → **290,00€** |
| 200L, margen 30%, "Bidones y Cubas" | solo paso1 | **142,86€** | **130,00€** |

**Consecuencia importante, confirmada explícitamente por Yako**: esto cambia el PVP de
**todos** los formatos de **todas** las marcas (no solo los que tienen "1+2"/"PVP Neto"
activo) — antes de este ADR, un formato sin ningún interruptor activo no llevaba paso 2 en
absoluto (PVP = solo el margen). Ahora todo formato sin interruptor pasa a duplicarse
también. Se avisó explícitamente del alcance ("esto duplicaría el PVP de todos los
formatos... un producto que hoy sale a 10€ pasaría a costar 20€") antes de implementarlo.

**Netos Bonus queda FUERA de este cambio, decisión de Claude no confirmada explícitamente
por Yako** — Netos Bonus son hojas internas para comerciales, nunca van a Skrit, y en
ningún momento de esta conversación Yako mencionó descuentos a cliente sobre Netos Bonus
(el "hueco de descuento" no tiene sentido de negocio ahí). Se ha dejado con el
comportamiento de siempre (paso 1 únicamente, sin doblar) por precaución, mediante el
filtro `cfg.id === 'pvp'`. **Pendiente de que Yako lo confirme** — si también quiere el
mismo doblado en Netos Bonus, es un cambio de una línea (quitar la condición `cfg.id ===
'pvp'`).

**Efecto colateral positivo**: la columna "Margen" del PDF de políticas (ADR 0064) ahora
muestra siempre el valor real de la casilla de Reglas — antes, para formatos con "1+2"/
"PVP Neto" activo, mostraba el 83,3%/20%/15% fijo en vez del margen configurado, que era
justo la confusión que arrancó esta conversación.

## Ficheros

**Modificar:** `js/core/pricing.js` (`compute()` reescrito, constantes `PROMO_1X2_MARGIN_PCT`/
`PVP_NETO_BIDON_MARGIN_PCT`/`PVP_NETO_CUBA_MARGIN_PCT`/`PVP_NETO_CUBA_THRESHOLD_LITERS`
sustituidas por `PROMO_1X2_STEP2_DIVISOR`/`NORMAL_STEP2_DIVISOR`).
**Sin cambios:** `pvpFromMargin`/`realMargin`/`round`/`resolveCost` (el paso 1 sigue
siendo exactamente la misma fórmula); `screen-rules.js` (los umbrales que deciden cuándo
se MUESTRA el interruptor "1+2"/"PVP Neto" en pantalla no cambian, solo cambió qué hace el
cálculo una vez activado).

## Verificación

- `node --check` sobre `pricing.js`.
- Simulación en Node de los 6 casos cruzados de la tabla de arriba — los 6 coinciden
  exactos con los cálculos de Yako.
- Simulación adicional confirmando que Netos Bonus (`cfg.id !== 'pvp'`) sigue en un solo
  paso, sin doblar — comportamiento sin cambios respecto a antes de este ADR.
- Pendiente de probar en la app real: revisar el PVP de un producto normal (sin "1+2" ni
  "PVP Neto") antes/después del despliegue para confirmar que se ha duplicado como se
  esperaba, y confirmar con Yako si Netos Bonus debe quedar fuera (como se ha hecho) o
  también duplicarse.

## Referencias

- ADR 0026 / ADR 0026 v2 (diseño original de "1+2"/"PVP Neto" como interruptor por
  formato — sustituido por este ADR).
- ADR 0064 (PDF de políticas — motivó descubrir esta confusión).
