# ADR 0023 — Listado calculado en pantalla, en Exportación

**Fecha:** 2026-08-04
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Continuación del ADR 0022: al retirar de Tarifas las columnas calculadas (margen, PVP,
ganancia…), quedó pendiente dónde debía verse ese listado final. Yako lo situó en
Exportación: "luego se hacen cálculos en Reglas y en Exportación ya sí se deberían ver
el listado final con las columnas importantes, según el Tipo de Exportación elegida" —
Referencia, Estado, Producto, Litros, Coste de envase, % Margen, PVP envase, PVP manual,
Ganancia €, Margen real (los dos últimos recalculados si se fija un PVP manual).

Hasta ahora Exportación no pintaba ninguna fila en pantalla — solo un formulario
(marca/gama/tipo/fecha) que generaba el Excel directamente sin previsualización.

## Decisión: tabla de previsualización en Exportación, WYSIWYG con el export

Se añade una tabla bajo el selector de "Tipo de exportación" que se recalcula al vuelo
según la marca/gama/tipo elegidos:

- **Tipo "de Venta"** (un nivel de `priceLevels`: PVP, Bidones y Cubas Neto, Netos
  Bonus…): columnas completas con `Pricing.compute` — Ref, Estado, Producto, Litros,
  Coste, % Margen, PVP, PVP manual (editable inline, igual que antes en Tarifas), Ganancia,
  Margen real. El override manual escribe en el mismo objeto de nivel que edita Reglas
  (`manualOverride`), así que fijar un PVP a mano aquí también se refleja si se vuelve a
  mirar ese nivel desde Reglas o desde otra pantalla.
- **Tipo "de Compra"** (Neto Factura / Neto-Neto / Triple Neto — listados fijos sin
  margen): columnas más simples, Ref, Estado, Producto, Litros, y el coste tal cual.
  Se añade **Triple Neto** como tercer listado (antes solo existían Neto Factura y
  Neto-Neto) — Castrol, por ejemplo, solo audita triple neto, no neto-neto, y no tenía
  ningún listado simple que lo exportara sin pasar por un nivel con margen.
- Filtro de búsqueda/formato/estado, igual que tenía Tarifas.
- **WYSIWYG real**: las filas mostradas en pantalla (`rows`, con `_status` ya anotado por
  `History.diff`) son EXACTAMENTE las que recibe `doExport()` — no se vuelve a consultar
  el maestro al pulsar "Exportar", así que lo que se ve es lo que se descarga, sin
  posibilidad de discrepancia entre previsualización y fichero.
- "Todas" gama: se resuelve el nivel por la gama real de cada fila (igual que ya hacía
  el export en sí, ver ADR anterior) — ahora también en la tabla de pantalla, no solo en
  el Excel final.
- El "Estado" (nueva/estable/rebrand) se calcula igual que en Tarifas
  (`History.diff` contra la tarifa vigente anterior de esa marca/gama, agregado por gama
  real cuando la vista es "Todas").

## Consecuencias

- `js/screens/screen-export.js`: reescrito — nuevas funciones `loadRawLevel` (lectura/
  escritura del nivel sin remapear, para el override manual), `loadRowsWithStatus`,
  `renderPreview`/`renderPreviewTable`, `saveManualOverride`. `doExport()` ya no vuelve a
  consultar `MasterDB`, usa las filas ya cargadas para la previsualización.
- `app/index.html`: nueva sección de filtro + tabla en la pantalla Exportación.
- Probado en navegador con Castrol: la tabla se recalcula correctamente al cambiar de
  tipo (PVP / Neto Factura / Neto-Neto / Triple Neto); fijar un PVP manual en pantalla
  se refleja en el Excel exportado exactamente con ese valor.

## Referencias

- `js/screens/screen-export.js`.
- ADR 0022 (Tarifas en crudo, margen por formato en Reglas).
