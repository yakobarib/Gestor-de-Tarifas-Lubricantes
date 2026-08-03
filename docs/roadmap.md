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
- ✅ **v0.1.x · Formalizar Supplier Profile como interfaz** — hecho en v0.3.0 (más tarde de lo previsto, ver nota de numeración más abajo).
- ✅ **AD Parts (marca propia, prioridad)** — implementado en **v0.3.0**: Gama Normal + Gama Standard (+ Sport Car cuando el fichero la trae) como pestañas independientes, Producto Químico como perfil separado, PVP manual editable por fila (no limitado a 5L).
- ✅ **Eni Live** — implementado en **v0.5.0**, 9 gamas.
- ✅ **Racing Oil** — implementado en **v0.8.8**, 12 gamas.
- ✅ **Shell** — implementado en **v0.9.0**, 23 gamas (precio por litro, no por envase).
- ✅ **Castrol** — implementado en **v0.9.2**, 9 gamas (precio por litro, cascada de descuentos con neto-neto ya calculado por Yako). Ver [ADR 0019](decisiones/0019-perfil-castrol.md).
- ✅ **Krafft** — descartado del catálogo (decisión de Yako, ya no se comercializa).
- ✅ **Detección automática de proveedor** — por firma de columnas (`ExcelReader.registerProfile` + `detect()`), no solo por nombre de archivo. Todos los perfiles registrados verifican cabecera real, no solo nombre de hoja (ver ADR 0019 para dos bugs de colisión encontrados y corregidos).

Con Castrol, los 6 proveedores del roadmap inicial están implementados — Fase 1 cerrada
en la práctica salvo pulido menor (25kg sin mapear en Castrol, tabla de descripciones
pendiente en Shell).

> **Nota sobre la numeración (2026-07-28):** este roadmap marcaba AD Parts como el hito
> **v0.2**, pero el trabajo real publicado como v0.2/v0.2.1/v0.2.2 se dedicó a la
> comparativa histórica entre tarifas (Fase 2, ADR 0006) y a un fix de coste en Repsol —
> no a AD Parts. AD Parts quedó pendiente hasta retomarse explícitamente y publicarse
> como v0.3.0. A partir de aquí este roadmap deja de fijar de antemano qué número de
> versión corresponde a cada proveedor — solo el orden de prioridad — para evitar que
> vuelva a desalinearse con el CHANGELOG real.

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
| v0.3.0 AD Parts (Aceite + Químico) | 2026-07-28 | ✅ Cumplido |
| v0.9.2 Castrol (último proveedor del roadmap inicial) | 2026-08-03 | ✅ Cumplido |
| Fase 1 completa (6 proveedores) | 2026-08-03 | ✅ Cumplido |
| Fase 2 (comparador + tasas) | 2026-Q4 | Planificado |
| Fase 3 (maestro) | 2027-Q1 | Planificado |
| Fase 4 (Electron + PDF) | 2027-Q2 | Planificado |

*Fechas revisables trimestralmente.*
