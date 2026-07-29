# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [v0.4.1] — 2026-07-29

### Añadido
- **Soporte de rebranding Repsol**: la tarifa de agosto 2026 introdujo columnas `SIRDI
  NUEVO`/`NOMBRE NUEVO` — productos con nueva imagen, mismo producto por dentro. El perfil
  de Repsol ahora usa la ref/nombre nuevos cuando existen (fila a fila, 101 de 895
  productos ya rebrandeados en esa tarifa), descartando la referencia antigua tal como
  se pidió.
- **`RebrandMap`** (`js/core/rebrand-map.js`): mapa persistente ref antigua↔nueva por
  proveedor, cargado desde un Excel dedicado (botón "Cargar mapa de rebranding…" en
  Importación). Se generó `BASE DE CONOCIMIENTO/Equivalencias Rebranding Repsol.xlsx`
  con los 101 pares extraídos automáticamente de la tarifa de agosto.
- `History.diff()` acepta un tercer parámetro opcional `rebrandPairs`: una ref nueva sin
  match directo en el histórico, pero cuya ref antigua sí estaba, se trata como "estable"
  (chip "REBRAND" con tooltip del código anterior) en vez de nueva+desaparecida.

### Arreglado
- Sin el mapa de rebranding, comparar la tarifa Repsol de mayo vs. agosto mostraba 113
  falsas "nuevas" y 92 falsas "desaparecidas" por los productos rebrandeados. Con el mapa
  cargado: 35 nuevas / 14 desaparecidas / 816 estables (verificado con las tarifas reales).

### Documentado
- ADR 0009 sobre el mapa de rebranding.

## [v0.4.0] — 2026-07-29

### Añadido
- **Rediseño a 4 pantallas**: Importación / Reglas / Comparación / Exportación, navegación
  por hash (`#import`/`#rules`/`#compare`/`#export`), reflejando el workflow real de crear
  precios. Importación es el flujo de v0.1-v0.3.0 (drop zone, tabla, pestañas de gama)
  movido tal cual, más una cuadrícula de tarjetas con el estado de la última tarifa
  importada por marca.
- **Maestro persistente multi-marca** (`MasterDB`, IndexedDB): cada importación guarda
  sus filas fusionadas por ref, con dos niveles de coste posibles — `costFactura`
  (siempre) y `costNetoNeto` (nullable, se rellenará proveedor a proveedor conforme se
  audite su lógica de descuentos/rappels en próximas sesiones).
- **Niveles de precio configurables por marca/gama** (`priceLevels`, pantalla Reglas):
  PVP (siempre existe, migrado sin cambios desde la config previa), Precio Neto de Venta,
  y Precios para Bonus (uso interno de Yako para ventas especiales — nunca se exporta a
  Skrit, flag `goesToSkrit`).
- **Pantalla Comparación**: carga los 5 Excel de equivalencias de `BASE DE CONOCIMIENTO/`
  (dos formatos reales distintos, con carry-forward de especificaciones compartidas) y
  compara en vivo el precio de una referencia entre las marcas equivalentes que ya tengan
  tarifa en el maestro.
- **Pantalla Exportación**: layout unificado de 9 columnas (MARCA, REFERENCIA,
  MARCA+REFERENCIA, coste factura, coste neto-neto, precio del nivel elegido, familia,
  litros, descripción) leído directamente del maestro, para cualquier marca/gama/nivel.
- Catálogo `BRANDS` data-driven (abreviatura, gamas, prefijo de referencia) — añadir un
  proveedor nuevo a la cuadrícula de Importación es una entrada de array.

### Cambiado
- **Extracción de `app/index.html`** (~1557 líneas) a ficheros separados bajo `app/js/` y
  `app/css/` — scripts clásicos (no ES modules: fallan por CORS bajo `file://`), sin
  bundler. Regresión cero verificada contra los 4 ficheros reales ya usados en v0.3.0.
- `Pricing.compute()` generaliza su segundo argumento de "config plana" a "nivel de
  precio", con `baseCostField` configurable; sigue aceptando la config legacy tal cual.

### Arreglado
- Los niveles de precio calculados sobre el maestro (Comparación, Exportación) devolvían
  PVP vacío porque heredaban `baseCostField: 'costPerPack'` de la config legacy en vez de
  `costFactura`/`costNetoNeto` (los nombres de campo reales de las filas del maestro).
  Corregido remapeando `baseCostField` a partir de `baseCost` antes de calcular.

### Documentado
- ADR 0008 sobre el rediseño de 4 pantallas, el maestro multi-marca y `priceLevels`.
- `docs/arquitectura.md` actualizado con la nueva estructura de ficheros.

## [v0.3.0] — 2026-07-28

### Añadido
- **Soporte AD Parts Aceite** (marca propia, prioridad alta — hito que el roadmap marcaba
  como v0.2 y que había quedado pendiente). Dos gamas, **Normal** y **Standard**, mostradas
  en pestañas independientes (cada una con su propia configuración de margen, historial y
  export). Soporta los **dos formatos de entrada** que llegan según el mes:
  - "ENTRADA" crudo del proveedor: hojas `AD NORMAL` / `AD STANDARD` + `Tarifa` (join por
    `REF PROVEEDOR` sin el punto).
  - "de trabajo": hojas `Coste` / `ADStandard` / `CosteSC` (esta última añade una 3ª línea,
    **Sport Car**, que se muestra como pestaña adicional cuando está presente).
  - Prefijo `ADP` y columna `FAM` (`06` = Aceite Motor) en la salida Skrit.
- **Regla de litros por sufijo de referencia**: los últimos 3 dígitos de la referencia
  (sin puntos) son los litros del envase, con el caso especial `000` → 1000 L. Descubierta
  cruzando los Excel reales — es la única fuente fiable en la gama Standard, cuya
  descripción no varía entre formatos ("AD STANDARD SC 5W30" para 5L, 20L, 50L, 208L…).
  Ver ADR 0007.
- **Soporte AD Parts Producto Químico**: hoja `Coste` (+ `Coste-SC`) organizada en
  secciones por familia (AD Estándar, AD Plus, Líquido limpiaparabrisas…), litros
  extraídos de la descripción. Los precios escalonados por cantidad de la hoja `PVP`
  quedan fuera de alcance (solo interesa el coste base para el cálculo de margen).
- **PVP manual editable por fila**: cualquier referencia admite un PVP fijado a mano que
  sustituye al cálculo por margen (persistido junto a la config del proveedor/gama). Caso
  real: Albert fija a mano el PVP del formato 5L en AD Parts, y a veces también en
  formatos grandes.
- Parser: reconoce el apóstrofe como separador decimal (`"0'5L"`), visto en las
  referencias de Líquido de Frenos de AD Parts Químico.

### Cambiado
- **Refactor a "Supplier Profiles"** (cierre del ADR 0005, pendiente desde v0.1): `ExcelReader`
  pasa de llamar siempre a `readRepsol` a iterar un registro de perfiles (`RepsolProfile`,
  `ADPartsAceiteProfile`, `ADPartsQuimicoProfile`), cada uno con su propio `detect()`/`read()`.
  Sin cambios de comportamiento para Repsol.
- Config e historial pasan de una clave fija (`config_repsol`) a una clave por
  proveedor+gama. Repsol conserva su clave histórica (`config_repsol`, `history_repsol`)
  para no perder los márgenes ya guardados en v0.2.x.

### Nota sobre la numeración de versión
El roadmap marcaba AD Parts como el hito v0.2 (prioridad alta), pero el trabajo real de
v0.2/v0.2.1/v0.2.2 se dedicó a la comparativa histórica (ADR 0006) y a un fix de coste en
Repsol — AD Parts quedó pendiente hasta esta versión. Ver `docs/roadmap.md`.

## [v0.2.2] — 2026-07-21

### Arreglado (bug crítico)
- **Coste por envase en Repsol**: `PRECIO FACTURA` en Repsol es el precio de la
  unidad de compra (la caja completa), no del envase individual. La app tratábalo
  como coste por envase, inflando el PVP de todas las refs con más de una unidad
  por caja. Ahora divide `PRECIO FACTURA / UDS X CAJA` para obtener el coste real.
  Impacto: **295 refs de 830 (36%)** con UDS X CAJA > 1. Ejemplos:
  - `12X1L`, PRECIO FACTURA=102,17 € → coste real = **8,51 €** por botella (no 102,17).
  - `5X4L`, PRECIO FACTURA=154,77 € → coste real = **30,95 €** por garrafa (no 154,77).
  - `1X208L` y `1X1000L`: sin cambio (UDS=1).

### Cambiado
- **Event delegation** para los inputs de margen por formato: los cambios ahora
  disparan recálculo instantáneo aunque el panel se re-renderice. Se escuchan
  `input` (tecla a tecla) y `change` (blur/enter) para máxima robustez.

### Añadido
- Trazabilidad: cada fila conserva `costPerBox` (precio factura original de Repsol)
  y `costPerPack` (calculado). Actualmente solo se usa el segundo para todo, pero
  el primero queda disponible por si en el futuro se muestra en tabla o export.

## [v0.2.1] — 2026-07-21

### Arreglado
- Botones de modo (Sobre venta / Sobre compra) ahora en gris visible por defecto
  (antes solo se veían al pasar el ratón por encima). El activo se sigue mostrando
  en azul primario.
- Layout centrado y aprovechamiento del ancho de pantalla: `max-width` ampliado a
  1800px, `min-width: 0` en el `<main>` para evitar overflow, `overflow-x: hidden`
  en `body` como red de seguridad.
- Barra de filtros más compacta (padding 0,3rem, fuente 0,82rem).

### Cambiado
- Los KPIs se renombran a "Referencias Totales / Estables / Nuevas / Desaparecidas"
  para claridad.
- Se elimina la columna "Uds/caja" de la tabla — no es información útil para el
  usuario (Skrit solo quiere precio por envase). La app la usa internamente para
  calcular el coste correcto (ver v0.2.2).
- Input de litros en la tabla reducido a 68px, fuente 0,8rem — libera espacio.
- Subtítulo actualizado a v0.2.1.

## [v0.2] — 2026-07-21

### Añadido
- **Comparativa histórica entre tarifas del mismo proveedor.** Al cargar una nueva tarifa,
  la app la compara contra la última "vigente" guardada y muestra referencias:
  - **Totales** — nº de refs en la tarifa cargada.
  - **Estables** — refs que ya estaban en la vigente anterior. Se muestra tooltip con
    el coste anterior al pasar el ratón por la celda de coste.
  - **Nuevas** — refs que no aparecían en la anterior (badge azul "NUEVA" en la tabla,
    borde izquierdo de la fila).
  - **Desaparecidas** — refs que estaban en la anterior y ya no. Link "ver lista →"
    abre modal con las refs perdidas.
- **Módulo `History`** en `app/index.html`: guarda por proveedor en localStorage
  (`history_<supplier>`) las refs {ref, cost, liters, description} de la tarifa vigente.
- **Auto-guardado** de la tarifa vigente al pulsar "Exportar a Skrit".
- **Botón "Establecer como vigente"** para guardar sin exportar (útil para verificar
  antes de comprometer).
- **Filtro por estado** en la barra de filtros: "Todos / Solo nuevas / Solo estables".
- **Toggle Margen sobre Venta / sobre Compra.**
  - Sobre venta: `PVP = Coste / (1 − %/100)`. Por defecto.
  - Sobre compra: `PVP = Coste × (1 + %/100)`.
  - La fórmula visible en el panel se adapta al modo elegido.
- **Banner de contexto histórico** que indica "Comparando con la tarifa vigente
  del YYYY-MM-DD" o avisa si no hay tarifa previa.

### Cambiado
- **Dashboard reescrito**: los KPIs agregados de coste/PVP/margen medio se
  reemplazan por los 4 KPIs comparativos (Total, Estables, Nuevas, Desaparecidas).
- **Tabla preview**: nueva columna "Estado" con chip visual para refs nuevas.
- **Anchos de inputs**:
  - Buscador y filtro de formato con ancho suficiente para el placeholder.
  - Fecha de tarifa en fila ancha propia.
  - Input de litros en la tabla ampliado a 88px para "1000".
- **Botones secundarios** (`Guardar perfil`, `Cargar perfil`, `Establecer como vigente`,
  `Cargar otra tarifa`) ahora en gris claro visible por defecto, gris más oscuro al hover.
- **Panel de configuración** ampliado de 320px a 340px de ancho.

### Documentado
- ADR 0005 sobre "un workflow por proveedor" (supplier profiles).
- Actualización en `docs/arquitectura.md` con módulo History y notas sobre KPIs.

## [v0.1.1] — 2026-07-21

### Arreglado
- La tarifa Repsol de mayo 2026 (`Tarifa Repsol Lubricants - 06 mayo 2026.xlsx`) usa
  el nombre de columna **`SIRDI`** en lugar de `REF PROVEDOR`. La detección ahora
  reconoce ambos alias además de `REFERENCIA`, `REF` y `CODIGO`.
- La detección de la columna de nombre también acepta `PRODUCTO` y `DESCRIP*` como
  alias de `NOMBRE`.
- Mensaje de error de cabecera ausente ahora incluye la cabecera detectada para
  facilitar diagnóstico.

## [v0.1] — 2026-07-20

### Añadido
- MVP tarifador con importación de tarifa Repsol vía drag & drop.
- Parser de litros con reconocimiento de L, ML, GR, KG y patrón NxM (99,8% acierto vs. Skrit real).
- Configuración de margen sobre venta por formato con preview en vivo.
- Redondeo psicológico configurable (2 dec / ,99 / ,95 / múltiplo 0,05 / entero).
- Exportación a formato Skrit (5 columnas + fecha).
- Persistencia en localStorage + perfiles guardables por nombre.
- Filtros por texto libre y por formato en la tabla preview.
- Edición manual inline de litros en filas con detección fallida.
- KPIs agregados: nº refs, coste total, PVP total, margen medio real.

### Arquitectura
- Single-file HTML + SheetJS + Pico.css vía CDN.
- Módulos internos: Storage, Parser, ExcelReader, Pricing, ExcelWriter, UI.

### Documentado
- Reglas de negocio (heterogeneidad tarifas, litros/envase, casuística AD Parts, tasas).
- Roadmap por fases (Fase 0 → 4).
- ADR: single-file HTML.
- ADR: margen sobre venta vs. markup sobre coste.
- ADR: parser de litros con 5 patrones.

## [v0.0] — 2026-05-14

### Añadido
- Spec técnica en `BASE DE CONOCIMIENTO/tarifador-aceites-spec.md`.
- Ejemplos reales de entrada/salida Skrit para Repsol, AD Parts, Eni Live, Castrol, Racing Oil.
- Documento `CONSIDERACIONES/Consideraciones.docx` con casuísticas de negocio.
- Plan por fases acordado.
