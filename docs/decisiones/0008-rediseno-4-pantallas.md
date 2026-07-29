# ADR 0008 — Rediseño a 4 pantallas y maestro multi-marca

**Fecha:** 2026-07-29
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras implementar AD Parts (v0.3.0), Yako planteó que el workflow real de crear precios
tiene 4 pasos separados y quiere que la app lo refleje en 4 pantallas en vez de un flujo
único (una tarifa en memoria a la vez):

> "el workflow de crear precios es, tarifa de entrada-seleccionar y aplicar reglas-comparar
> como quedan tarifas entre proveedores-exportar tarifa para skrit, creo que la app
> debería tener esas cuatro pantallas separadas en ese workflow"

Esto vino acompañado de dos conceptos de negocio nuevos:

1. **Dos niveles de coste por referencia.** Además del coste de factura (el que ya usa la
   app), muchas tarifas traen un coste real tras descuentos/rappels pactados con el
   proveedor — "neto-neto" o "triple neto" según la marca. La lógica exacta de extracción
   es distinta por proveedor y Yako la explicará tarifa a tarifa en próximas sesiones; el
   modelo de datos tenía que dejar el hueco sin bloquear el resto del trabajo.
2. **Varios precios de salida por referencia.** Además del PVP normal, existe un "Precio
   Neto de Venta" (confirmado con un ejemplo real de AD Parts,
   `Ejemplo Tarifa de SALIDA para SKRIT y COMERCIALES Precios Netos de venta para Bidones
   y Cubas.xlsx` — un Excel plano REFERENCIA/PRODUCTO/LITROS/VENTA NETO, solo formatos
   grandes) y "Precios para Bonus", que Yako usa para ventas especiales y que **no** debe
   ir a Skrit.

Además, la comparación de PVP entre marcas para el mismo producto conceptual (pantalla
Comparación) exige que la app recuerde la última tarifa vigente de **todas** las marcas a
la vez, no solo la que esté abierta en el momento — un maestro persistente, adelantando lo
que el roadmap preveía como Fase 2 (comparador) y Fase 3 (maestro multiproveedor).

## Decisión 1 — Extracción a módulos JS separados

`app/index.html` estaba en ~1557 líneas — el ADR 0001 preveía extraer a ficheros
separados a partir de ~1500 líneas, "mecánico sin cambiar la lógica" porque el código ya
estaba modularizado en objetos. Se extrae a `<script src>` clásicos, **no**
`type="module"`: los módulos ES nativos fallan por CORS al abrir el HTML directamente por
`file://`, un modo de uso real de Yako. Todos los `<script>` clásicos de una página
comparten el mismo entorno léxico, así que un `const Modulo = (() => {...})();` en un
fichero es visible desde el siguiente sin necesitar un namespace explícito — el orden de
`<script src>` en `index.html` es la única "resolución de dependencias", documentada ahí
mismo. Ver estructura completa en [../arquitectura.md](../arquitectura.md).

## Decisión 2 — Maestro persistente en IndexedDB, config/historial siguen en localStorage

`localStorage` sigue exactamente igual para lo que ya usa (`config_*`, `history_*`,
`profiles`) — cero cambios, cero migración de esas claves. Se añade `MasterDB`
(IndexedDB, store `rows`, keyPath `brandId::gama::ref`) para el catálogo completo
multi-marca: el volumen (7 proveedores × varias líneas/gamas × filas con ambos niveles de
coste) puede rondar varios MB, cerca del límite práctico de `localStorage` por origen, y
la pantalla Comparación necesita lecturas cruzadas en tiempo real.

`MasterDB.putRows(brandId, gama, rows, tariffType)` fusiona por ref: si la fila ya existe,
actualiza solo el campo de coste correspondiente (`factura` → `costFactura`,
`netoNeto`/`triple_neto` → `costNetoNeto`) y conserva el resto — así importar en el futuro
una tarifa "neto-neto" completa las filas ya existentes en vez de crear un catálogo
paralelo. **Hoy solo se importa el tipo "factura"** (`ScreenImport.persistToMaster()`
llama siempre con `tariffType: 'factura'`) — no hay todavía perfil de lectura que sepa
extraer el coste neto-neto de ningún proveedor; `costNetoNeto` queda `null` hasta que se
audite cada tarifa, tal como se pidió.

Se verificó con un spike aislado que IndexedDB persiste igual de bien que `localStorage`
abriendo por `file://` (recarga real de página, mismo resultado) antes de construir nada
sobre él.

## Decisión 3 — Router hash-based

`#import` / `#rules` / `#compare` / `#export`, no path routing: GitHub Pages (ADR 0004)
es hosting estático y las rutas no-fichero devuelven 404 al refrescar. Cada pantalla es
una `<section id="screen-*">`; el contenido de Importación es el mismo de v0.1-v0.3.0
movido tal cual dentro de `#screen-import` (mismos ids internos, regresión cero
verificada: Repsol 830 filas, AD Parts Aceite 275 filas en ambos formatos de entrada, AD
Parts Químico 83 filas — idénticos a antes de la extracción).

## Decisión 4 — `priceLevels`: niveles de coste y de precio de salida

La config de margen por marca+gama se extiende de forma **aditiva** con `priceLevels`
(array), sin tocar los campos legacy (`defaultMargin`, `byFormat`, `rounding`,
`marginMode`, `manualPvp`):

```js
priceLevels: [
  { id: 'pvp', label: 'PVP', baseCost: 'factura', baseCostField: 'costPerPack',
    mode: 'sale', defaultMargin: 30, byFormat: {}, rounding: '2dec', manualOverride: {}, goesToSkrit: true },
  { id: 'precio_neto_venta', label: 'Precio Neto de Venta', baseCost: 'netoNeto',
    mode: 'sale', defaultMargin: 15, byFormat: {}, rounding: 'int', manualOverride: {}, goesToSkrit: true },
  { id: 'precio_bonus', label: 'Precios para Bonus', baseCost: 'factura',
    mode: 'cost', defaultMargin: 10, byFormat: {}, rounding: 'none', manualOverride: {}, goesToSkrit: false }
]
```

`Migration.run()` (una sola vez, flag `migrated_v1`) sintetiza `priceLevels: [pvp]` desde
los campos legacy existentes cuando una config no lo tiene — el PVP resultante es
byte-idéntico al de antes de la migración (verificado). `Pricing.compute(row, level)` es
la única función de cálculo de precio de toda la app; si el nivel usa
`baseCost: 'netoNeto'` y la fila no tiene `costNetoNeto` todavía, devuelve `noCost: true`
sin bloquear el resto — el hueco se rellena proveedor a proveedor conforme se audite.

**Bug encontrado y corregido durante las pruebas:** los niveles migrados desde la config
legacy usan `baseCostField: 'costPerPack'` (el nombre de campo de las filas en memoria de
Importación), pero las filas del maestro usan `costFactura`/`costNetoNeto`. Comparación y
Exportación remapean `baseCostField` a partir de `baseCost` justo antes de llamar a
`Pricing.compute` (función `forMaster()` en ambas pantallas) — sin este remapeo, todo
nivel calculado desde el maestro devolvía PVP vacío.

## Decisión 5 — "Precios para Bonus" y niveles fuera de Skrit

Yako mencionó un nivel de precio de uso interno para "ventas especiales" que nunca debe
exportarse a Skrit. Se modela con el flag `goesToSkrit` en cada nivel — la pantalla
Exportación solo lista niveles con `goesToSkrit: true`. Genérico por diseño: cualquier
nivel futuro con esa necesidad solo tiene que poner el flag a `false`.

## Decisión 6 — Motor de comparación con los ficheros de equivalencias reales

Dos formatos reales en `BASE DE CONOCIMIENTO/Equivalencias *.xlsx`:
- **"spec"** (`Equivalencias Aceites por Marcas.xlsx`, 1002 filas): 1 fila = 1 grupo
  directo, con 1 columna de referencia por marca. Valores especiales `SIN EQUIVALENCIA` /
  `SIN ACTUALIZAR` / `EN OTROS FORMATOS` se ignoran.
- **"block"** (Grasas, Hidraulicos, Motor Vehículo Industrial, Transmisión Manual y Ejes):
  bloques de 3 columnas por marca (REFERENCIA/DESCRIPCCIÓN/LITROS|KG), con carry-forward
  real en las columnas de especificación compartida (confirmado en los datos: SAE/DIN se
  mantienen a través de varias filas de tamaños distintos del mismo producto).

`EquivalenceIndex` combina las 5 categorías en un mapa inverso `brandKey → ref → grupo`, y
se persiste en **localStorage** (no IndexedDB): el dataset es semi-estático y modesto
(~1300 filas en total), muy por debajo del límite práctico, y evita abrir un segundo
almacén IndexedDB solo para esto.

Las refs de los ficheros de equivalencias nunca llevan el prefijo que los perfiles de
lectura hornean (`ADP` para AD Parts) — `BRANDS[].refPrefix` reconcilia esto al buscar en
el maestro. `EQUIV_BRAND_ALIASES` traduce las cabeceras de marca del Excel (`'AD PARTS'`,
`'REPSOL'`…) al `brandId:gama` interno; se amplía conforme se den de alta más proveedores
o se audite el resto de ficheros de equivalencias.

## Consecuencias

### Positivas
- El patrón de perfiles y ahora el de pantallas quedan listos para Castrol/Eni/Racing
  Oil/Krafft/Shell sin tocar el core.
- El modelo `priceLevels` es genérico: nuevos precios de salida (o nuevos proveedores con
  su propio "neto-neto") no requieren cambios de esquema, solo nuevas entradas.

### Negativas / trade-offs aceptados
- El maestro de IndexedDB empieza vacío — no se puede reconstruir fielmente desde
  `history_*` (que solo guarda `{ref, cost, liters, description}`). Yako tiene que volver
  a soltar una vez cada fichero que ya usa para poblar el maestro nuevo; no se pierde
  ningún margen ni configuración.
- Ningún proveedor tiene todavía lectura de coste neto-neto — el hueco está listo pero
  vacío hasta las próximas sesiones de auditoría tarifa a tarifa.
- El export legacy (`ExcelWriter.exportSkrit`, 5-6 columnas) convive con el nuevo
  (`exportSkritV2`, 9 columnas) durante la transición; se retira cuando Exportación quede
  validada en uso real.

## Referencias

- Módulos: `js/core/db.js`, `js/core/migration.js`, `js/core/pricing.js`,
  `js/comparison/equivalence-reader.js`, `js/comparison/equivalence-index.js`,
  `js/screens/*.js`.
- [Roadmap](../roadmap.md) — Fase 2 (comparador) y Fase 3 (maestro multiproveedor), ahora
  parcialmente adelantadas por este ADR.
- ADR previos: [0001](0001-single-file-html.md), [0005](0005-un-workflow-por-proveedor.md),
  [0007](0007-ad-parts-supplier-profiles.md).
