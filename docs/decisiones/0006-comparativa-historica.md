# ADR 0006 — Comparativa histórica entre tarifas del mismo proveedor

**Fecha:** 2026-07-21
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Cuando un proveedor envía una tarifa nueva, la pregunta operativa no es solo "¿cómo transformo esta tarifa a Skrit?", sino:

- ¿Qué referencias son nuevas y no existían antes?
- ¿Qué referencias han desaparecido (descatalogadas)?
- ¿Qué referencias se han quedado y cuál es su variación de precio?

Este cruce era el trabajo manual más pesado y propenso a error. Yako lo pidió como requisito directo:

> "En general se tienen que guardar datos para que la app vea, gestione, aplique y explique en dashboard los cambios de nuevas tarifas frente a las anteriores."

## Decisión

**La app persiste, por proveedor, la última tarifa marcada como "vigente"** y la usa como referencia para comparar cada nueva tarifa que se cargue.

## Modelo de datos

Clave localStorage: `history_<supplier_id>` (por ejemplo `history_repsol`).

Contenido:

```javascript
{
  savedAt: '2026-07-21',       // fecha en que se guardó
  tariffDate: '2026-05-06',    // fecha declarada de la tarifa
  refs: [
    { ref: 'RPP2000JAB', cost: 7000, liters: 1000, description: '…' },
    …
  ]
}
```

Solo se guardan los campos necesarios para la comparación. No se persiste la
configuración de margen ni los cálculos de PVP — esos son transformaciones
derivadas.

## Diff producido

Al cargar una tarifa, `History.diff(current, previous)` devuelve:

```javascript
{
  hasPrevious: boolean,
  previousDate: 'YYYY-MM-DD',
  total: number,                  // refs en la tarifa actual
  stable: number,                 // refs que estaban en la anterior
  new: number,                    // refs que no estaban en la anterior
  obsolete: number,               // refs que estaban y ya no
  obsoleteRefs: [{ref, description, cost}, …],
  priceDeltas: [{ref, prev, curr, deltaPct}, …]
}
```

Además, mutando los `row` en sitio, marca `row._status = 'new' | 'stable'` para
render en la tabla, y `row._prevCost` para mostrar tooltip.

## Cuándo se guarda la vigente

Dos vías, ambas explícitas:

1. **Al pulsar "Exportar a Skrit"** — se auto-guarda porque exportar significa
   que la tarifa se ha aceptado para producción.
2. **Al pulsar "Establecer como vigente"** — botón manual para guardar sin
   exportar (útil para verificar antes de comprometer, o cuando la tarifa
   se recibe pero aún no se exporta ese día).

No se auto-guarda al importar. Motivo: cargar una tarifa no implica aceptarla —
puede ser una prueba, un archivo equivocado, o estar en revisión.

## UX

- **Banner de contexto** encima de los KPIs:
  - Si hay histórico: "Comparando con la tarifa vigente de Repsol del 2026-05-06."
  - Si no hay: "Sin tarifa anterior guardada. Todas las refs se marcan como nuevas."
- **4 KPIs** en dashboard: Total / Estables / Nuevas / Desaparecidas.
- **Chip visual "NUEVA"** en la fila de la tabla + borde izquierdo azul.
- **Tooltip en la celda de coste**: muestra el coste anterior si la ref es estable.
- **Filtro por estado**: "Todos / Solo nuevas / Solo estables".
- **Modal "ver lista →"** en el KPI de Desaparecidas: lista completa con ref, descripción y coste anterior.

## Consecuencias

### Positivas
- Detección automática de refs descatalogadas — antes se detectaban solo cuando
  aparecía un pedido fallido.
- Contexto inmediato al cargar tarifa: "¿qué ha cambiado desde la última?"
- Base para Fase 2 (comparador) — el mismo diff genera datos para exportar un
  informe de cambios.

### Negativas / trade-offs
- localStorage es local al navegador. Si Yako trabaja desde otro ordenador,
  no ve el histórico. Mitigación futura: opción de exportar/importar el histórico
  como JSON (Fase 3).
- No hay más de un histórico por proveedor. La comparativa siempre es "actual
  vs. última guardada". Si se necesita histórico completo (evolución en el
  tiempo), se pospone a Fase 4.

## Extensiones futuras

- Fase 2: comparador dedicado con visualización de deltas y filtrado por
  magnitud de cambio (%+10 y superiores).
- Fase 3: histórico multi-versión por proveedor.
- Fase 4: exportar informe PDF de cambios entre tarifas.

## Referencias

- Módulo `History` en `app/index.html`.
- Ficha de proveedor Repsol: [../proveedores/repsol.md](../proveedores/repsol.md).
