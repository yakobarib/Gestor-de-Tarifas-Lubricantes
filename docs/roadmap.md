# Roadmap por fases

Plan acordado con Yako en la sesión del **2026-05-14** y actualizado según avances.

## Fase 0 — Auditoría y contexto ⏳ Parcialmente hecho

**Objetivo:** entender el terreno antes de codificar.

- ✅ Recopilación de tarifas reales de los 7 proveedores en `TARIFAS ACTUALIZADAS/`.
- ✅ Ejemplos de entrada y salida Skrit para Repsol, AD Parts, Eni Live, Castrol, Racing Oil.
- ✅ Documento `CONSIDERACIONES/Consideraciones.docx` con casuísticas de negocio.
- ⏳ **Pendiente:** completar las secciones vacías de `Consideraciones.docx` para Castrol, Repsol y Eni Live (mecánica exacta de descuentos, hojas relevantes, familias).

## Fase 1 — MVP tarifador ▶️ En curso

**Objetivo:** app que ingiere una tarifa Excel, permite configurar margen por formato y exporta a Skrit.

**Estrategia:** un workflow (perfil) dedicado por proveedor. Detalle en [decisiones/0005-un-workflow-por-proveedor.md](decisiones/0005-un-workflow-por-proveedor.md).

- ✅ **v0.1 · Repsol** — implementado y validado (99,8% acierto parser).
- ⏳ **v0.1.x · Formalizar Supplier Profile como interfaz** — refactor previo a v0.2 para dejar el patrón limpio antes de duplicarlo.
- ⏳ **v0.2 · AD Parts (marca propia, prioridad)**
  - Gama Normal + Gama Standard como dos flujos separados.
  - Producto químico también dentro del "saco" de lubricantes.
  - Formato 5L con PVP manual por Albert — no automatizar, dejar hueco editable.
- ⏳ **v0.3 · Castrol** — descuentos en cascada (Pronto Pago + Dto Logístico + Rappel FA) o consumo directo de la hoja `DATOS` ya consolidada.
- ⏳ **v0.4 · Eni Live** — multi-hoja por familia; coste = `TARIFA 2 UNIDAD DE VENTA`.
- ⏳ **v0.5 · Racing Oil** — cabecera bipartita (row 12 + row 13), litros como string ("1L", "5L") a parsear.
- ⏳ **v0.6 · Krafft + Shell** — auditar tarifas reales y decidir tratamiento.
- ⏳ **v0.7 · Detección automática de proveedor** — por firma de columnas, no solo por nombre de archivo.

## Fase 2 — Comparador y aportaciones

**Objetivo:** comparar tarifa antigua vs. nueva y aplicar tasas.

- Comparador antigua vs. nueva tarifa (diff de referencias, subidas/bajadas, refs eliminadas, refs nuevas).
- Incorporar tasas Ecoembes (RD 1055/2022) y GENCI 2026 como recargos configurables por marca y por litro.
- Alertas de subidas/bajadas fuertes (>10%) para revisión manual.

## Fase 3 — Maestro multiproveedor

**Objetivo:** normalizar todos los proveedores en una tabla única.

- Base de datos local (localStorage o IndexedDB) con maestro de referencias.
- Enriquecimiento con familias, marca, formato, ficha técnica.
- Búsqueda cruzada por producto ("qué opciones tengo para un 5W30 en 5L").
- Exportación combinada.

## Fase 4 — Empaquetado y extras

**Objetivo:** producto listo para uso diario y compartición.

- Empaquetar en Electron como app de escritorio (`.exe` / `.dmg`).
- Histórico de tarifas y análisis de evolución de coste por referencia.
- Generación de catálogos PDF por marca para enviar a clientes.
- Comparador con la competencia (opcional, requiere fuente de datos externa).

## Fuera de alcance (por ahora)

- Ofertas complejas (3x2, packs mixtos, 1+1+regalo) — la spec las contempla pero no son prioritarias hasta cerrar Fase 1.
- Sincronización en la nube.
- Multi-usuario / permisos.
- Integración directa API con Skrit (Skrit es un CRM que consume Excel; mientras eso siga así, no hay razón para complicar).

## Hitos y fechas

| Hito | Fecha objetivo | Estado |
|---|---|---|
| v0.1 Repsol funcional | 2026-07-20 | ✅ Cumplido |
| v0.2 AD Parts | 2026-08-15 | Próximo |
| Fase 1 completa (7 proveedores) | 2026-10-31 | Planificado |
| Fase 2 (comparador + tasas) | 2026-Q4 | Planificado |
| Fase 3 (maestro) | 2027-Q1 | Planificado |
| Fase 4 (Electron + PDF) | 2027-Q2 | Planificado |

*Fechas revisables trimestralmente.*
