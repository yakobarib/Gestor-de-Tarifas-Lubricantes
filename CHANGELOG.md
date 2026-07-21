# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
