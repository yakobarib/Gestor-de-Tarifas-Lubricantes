# Repsol

## Estado
- **Versión de app:** v0.8.5 (2026-07-31)
- **Última tarifa procesada:** `Tarifa Repsol Lubricants 1 agosto 2026.xlsx`
- **Última actualización de este documento:** 2026-07-31

## Formato de la tarifa entrante

**Lo que envía Repsol tal cual** es un archivo `.xlsx` con **una sola hoja `Hoja1`**:
- Fila 0: título de la tarifa (ej. `TARIFA 1 MAYO 2026`).
- Fila 1: cabeceras (`SIRDI`, `NOMBRE`, `PESO NETO`, `UDSX CAJA`, `PRECIO FACTURA`, `CLASIFICACIÓN`, `PREMIUNIZACIÓN`, `EAN / 13`, `EAN / 14`, `COMENTARIO`).
- Filas 2+: intercala **filas de sección** vacías (`AUTOMOCION`, `MOTO`, `PESADO`, `INDUSTRIA`…) con filas de producto reales.

La hoja `DATOS` **NO viene del proveedor**: era una hoja que Yako creaba manualmente antes de existir la app, para tener las filas limpias. La app la reconoce como fallback si aparece, pero la ruta principal es `Hoja1`.

Cambios entre versiones de tarifa:
- **2025 y anteriores**: columna de referencia se llamaba `REF PROVEDOR`.
- **2026 en adelante**: la columna pasó a llamarse `SIRDI` (código interno Repsol). Se añadió también la columna `PREMIUNIZACIÓN`. La app detecta ambos nombres.

## Columnas relevantes (hoja `DATOS` o `Hoja1`)

| Columna Excel | Campo interno app | Notas |
|---|---|---|
| `SIRDI` (2026) / `REF PROVEDOR` (2025 y anteriores) | `ref` | Código proveedor. Se mantiene tal cual en la salida Skrit. Repsol renombró la columna en la tarifa 2026. |
| `NOMBRE` | `description` | De aquí se extrae LITROS con el parser. Ejemplo: `RACING 4T 5W40 1000L`. |
| `PESO NETO` | `netWeight` | Informativo. En kg. |
| `UDS X CAJA` | `unitsPerBox` | **Crítico para el cálculo** (aunque no se muestra en la UI). Divide el precio factura para obtener el coste por envase individual. |
| `PRECIO FACTURA` | `costPerBox` | **Precio de la unidad de compra (la caja)**, no del envase individual. Ejemplo: `12X1L` con `UDS X CAJA=12` y `PRECIO FACTURA=102,17` significa que la caja de 12 botellas cuesta 102,17 €. La botella individual cuesta 8,51 €. Skrit espera este último. |
| — (calculado) | `costPerPack` | **Coste real por envase individual**: `costPerBox / unitsPerBox`. Es lo que va a Skrit. |

## Gamas y subcategorías (una sola hoja, división vertical)

A diferencia de AD Parts o Eni Live (una hoja/gama), Repsol mete **todo el catálogo en
`Hoja1`**, dividido verticalmente por filas de cabecera de sección intercaladas entre las
filas de producto — igual idea que Eni Live, pero en vertical en vez de en pestañas.

El texto de estas filas de cabecera **no es fiable como señal de jerarquía** (a simple
vista "AUTOMOCION" e "INDUSTRIA" no se distinguen de "MOTO" o "ENGRANAJES" salvo por el
propio nombre, y no hay una lista cerrada de nombres válidos). La señal real es el
**color de relleno** de la celda: naranja `FFC000` = gama, rojo `FF0000` = subcategoría
dentro de la gama activa. Verificado en las 3 tarifas reales disponibles (mayo, agosto y
agosto "con aportaciones"): siempre exactamente estos 2 colores, sin variación.

6 gamas detectadas en la tarifa de agosto 2026:

| Gama | Subcategorías (fam) |
|---|---|
| AUTOMOCION | MOTO, NÁUTICO, MASTER, ELITE, LEADER, DRIVER, EV FLUIDS, GIANT, TRANSMISIONES Y CAJAS |
| INDUSTRIA | ENGRANAJES, ENGRASE GENERAL, HIDRÁULICOS, TURBINAS Y COMPRESORES, COGENERACIÓN GAS, DIELECTRICOS, OTROS LUBRICANTES INDUSTRIALES, COJINETES Y LAMINADORAS, MECANIZADO, DESMOLDEANTES |
| PRODUCTOS DE MANTENIMIENTO | (ninguna) |
| MARINOS | (ninguna) |
| GRASAS | (ninguna) |
| ALIMENTARIOS | (ninguna) |

La columna donde cae el texto de cabecera **varía entre variantes de la misma tarifa**:
columna A en la normal, columna E en la "con aportaciones" (las columnas M→Z de aportes
se insertan a la izquierda de los datos habituales en esa variante). El perfil localiza
el texto dinámicamente (primera celda no vacía de la fila), no por índice fijo — ver
[ADR 0012](../decisiones/0012-gamas-repsol-por-color.md).

La subcategoría se guarda como `fam` (texto libre, igual que en Eni Live), no como gama
propia — mantiene la granularidad de gama en 2 niveles como máximo, igual que el resto de
proveedores.

## Casuísticas

- **Precio factura = precio por caja, no por envase.** Repsol vende siempre la caja como unidad mínima de compra (no venden garrafas ni botellas sueltas). El coste que Skrit necesita es el del envase individual = `PRECIO FACTURA / UDS X CAJA`. Con formatos como `12X1L` esto divide entre 12; con `5X4L` entre 5. Con `1X208L` o `1X1000L` la unidad de compra ya es un solo envase y no cambia nada. En la tarifa Repsol mayo 2026, unas 295 de 830 refs (36%) tienen UDS X CAJA > 1 y requieren esta división. Regla aplicada en v0.2.2 tras corregir un bug que trataba el precio factura como si fuera por envase.
- **Sin descuentos en cascada**: Repsol ya da el precio neto final. Una sola columna de precio. Ver comparación con Castrol en su ficha.
- **Muchos productos "no aceite"**: Repsol vende lubricantes automoción/moto, pero también químicos (WIZARD, GUARD, SMARTER, QUALIFIER…) con envases pequeños (100ml, 300ml, 500ml). Todos van en la misma tarifa.
- **Grasas en kilos**: la línea `PROTECTOR ... KG` usa formatos 18KG, 45KG, 180KG, 45KG. **No es densidad ≈ 1** — son envases estándar con equivalencia real en litros confirmada por Yako (18KG=20L, 45KG=50L, 180KG=208L, 400GR=400ML, 2KG=2L), aplicada **solo al renombrado de la descripción para Skrit**, nunca al cálculo de litros/margen (que sigue usando el peso real de origen) — ver [ADR 0013](../decisiones/0013-limpieza-descripcion-repsol.md). Dos pesos vistos en la tarifa real no tienen equivalencia confirmada todavía: **5kg** (8 refs, Grasas) y **16kg** (1 ref) — se dejan sin convertir (`5KG`/`16KG`) hasta que Yako los confirme.
- **Casos con inconsistencia detectada**: en la salida Skrit histórica de Yako, 2 refs de grasa 180KG aparecen como `LITROS = 208` en lugar de `180`. Parece error humano previo, no del parser actual.
- **"-" (guion suelto) en SIRDI NUEVO/NOMBRE NUEVO no es rebranding real** — 13 filas de la subcategoría MOTO lo traían así en vez de estar vacío, y al ser un string no vacío se trataban como si tuvieran una referencia nueva válida, colisionando entre sí en el maestro (864 filas leídas → 851 antes de corregirlo). Confirmado por Yako: hay que quedarse con las columnas antiguas (SIRDI/NOMBRE, A/B) cuando la columna nueva es solo un guion. Corregido en v0.8.4 — ver ADR 0013.
- **Descripción limpia para cualquier tarifa de salida** (v0.8.4/v0.8.5): se quita la unidad de compra (`12x1L`→`1L`, `1xBiB-20L`→`BIB 20L`, `12xT-150`→`150ML`…), el guion de la viscosidad (`5W-40`→`5W40`) y los espacios dobles. Se guarda en un campo aparte, `descriptionExport` — la `description` que se ve en Importación/Comparación y el maestro es siempre el nombre original, intacto; `descriptionExport` solo la usan las funciones de export (Skrit, Neto Factura, Neto-Neto…). El cálculo de litros/margen también usa el nombre original, nunca el renombrado. Detalle completo en [ADR 0013](../decisiones/0013-limpieza-descripcion-repsol.md) y [ADR 0014](../decisiones/0014-exports-neto-y-descripcion-separada.md).

## Notas de negocio

- Márgenes típicos aplicados por formato (a completar por Yako en próximas sesiones):
  - 1L: ~35%
  - 5L: ~30%
  - 20L / 60L: ~25%
  - 208L / 1000L: ~20%
  - Químicos (ML): ~50%
  - (Valores tentativos — el usuario los ajusta en la UI.)
- Tasas Ecoembes y GENCI: aún no incorporadas. Fase 2.

## Estado en la app

**Implementado en v0.1:**
- Detección automática de la hoja `DATOS` (fallback a `Hoja1` con detección de cabecera).
- Parser de litros del `NOMBRE` con 99,8% de acierto (827/829 refs).
- Grupos de formato detectados: 0,125 L, 0,15 L, 0,25 L, 0,4 L, 0,5 L, 1 L, 4 L, 5 L, 12 L, 18 L, 18 KG, 20 L, 45 KG, 50 L, 60 L, 180 KG, 200 L, 205 L, 208 L, 1000 L (según tarifa).
- Configuración de margen sobre venta por formato.
- Export a Skrit con las 5 columnas + fecha.

**Implementado en v0.8.3:**
- Gamas y subcategorías detectadas automáticamente por color de sección (ver arriba) —
  6 pestañas de gama en Importación, igual que AD Parts o Eni Live.

**Implementado en v0.8.4:**
- Fix: "-" en SIRDI NUEVO ya no se trata como rebranding real (ver Casuísticas).
- Descripción limpia para Skrit: quita unidad de compra, guion de viscosidad y espacios
  dobles; kg/gr a litros/ml solo en el texto, nunca en el cálculo.

**No implementado (pendiente si aparece necesidad):**
- Detección de refs descatalogadas.
- Enlace con la política PVP oficial de Repsol para comparar.

## Referencias

- Ejemplo entrada: `EJEMPLOS TARIFAS/REPSOL/Ejemplo Tarifa de ENTRADA Repsol.xlsx`
- Ejemplo salida esperada: `EJEMPLOS TARIFAS/REPSOL/Ejemplo Tarifa de SALIDA Repsol para SKRIT.xlsx`
- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Repsol/Tarifa Repsol Lubricants - 06 mayo 2026.xlsx`
