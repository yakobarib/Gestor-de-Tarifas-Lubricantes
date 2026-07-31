# ADR 0013 — Limpieza de descripción Repsol para Skrit (solo texto, no cálculo)

**Fecha:** 2026-07-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Dos ajustes pedidos por Yako sobre el perfil de Repsol, tras revisar el resultado de la
importación real:

1. Filas con `SIRDI NUEVO` / `NOMBRE NUEVO` = `"-"` (un guion suelto) se estaban tratando
   como si tuvieran rebranding real, colisionando entre sí en el maestro (13 filas de la
   subcategoría MOTO, todas con `ref: "-"`, se pisaban unas a otras).
2. La descripción que llega a Skrit debe quitar la referencia a la unidad de compra
   (dejar solo el envase) y el guion de la viscosidad, y colapsar espacios múltiples.

## Decisión 1 — "-" no cuenta como rebranding real

`readRepsol` usaba `refNuevo || r[idxRef]` para decidir si una fila tenía rebranding. Un
guion suelto (`"-"`) es un string no vacío → **truthy en JS** → la condición lo trataba
como una referencia nueva válida, ignorando la referencia real de las columnas A/B (SIRDI
y NOMBRE originales). Yako confirmó: esas filas no tienen producto nuevo, hay que
quedarse con las antiguas.

Se añade `isRealValue(v)` (no nulo, no vacío tras trim, y no exactamente `"-"`) y se usa
para decidir `hasRebrand` en vez de un truthy check simple. Verificado en las 3 tarifas
reales: las 13 colisiones desaparecen (864 filas leídas → 864 en el maestro, antes 851).

## Decisión 2 — Descripción limpia para Skrit, desacoplada del cálculo

Reglas dadas por Yako con ejemplos concretos:
- Quitar la unidad de compra de la descripción, dejando solo el envase:
  `EXTREME 4T 5W-40 12x1L` → `EXTREME 4T 5W40 1L`.
- Formatos especiales de envase, también sin la unidad de compra:
  `MASTER ECO F 0W-30 1xBiB-20L` → `MASTER ECO F 0W30 BIB 20L`,
  `12xT-150` → `150ML`, `6xPT-500` → `500ML` (códigos de envase propios de la línea WIZARD).
- Guion de viscosidad: `5W-40` → `5W40`.
- Espacios dobles/triples → uno solo.
- Kg/gr a litros/ml **solo para el texto**, nunca para el cálculo (el envase real pesa lo
  que pesa, pero el nombre comercial debe leerse en el formato estándar): `18KG=20L`,
  `45KG=50L`, `180KG=208L`, `400GR=400ML`, `2KG=2L`.

Implementado en `cleanRepsolDescription()` (`profile-repsol.js`), aplicado sobre la
descripción ya limpiada de espacios (`Parser.cleanDescription`), operando solo sobre el
**último token** de la descripción (el envase siempre es el último elemento en el nombre
Repsol, confirmado recorriendo las ~860 filas reales) — evita falsos positivos si alguna
palabra intermedia contuviera dígitos.

**Crítico: el campo `liters` (usado para el cálculo de PVP y el bucket de margen por
formato) se deriva ANTES de este renombrado, sobre el nombre original.** Si se derivara
del texto ya renombrado, un envase de 18kg pasaría a calcularse como si fueran 20L,
cambiando el PVP — exactamente lo que Yako pidió evitar ("solo para descripción, no para
cálculos"). `Parser.extractLiters` sigue viendo `"...18kg"` tal cual y sigue devolviendo
`18`, igual que antes de este cambio.

### Valores de peso sin equivalencia confirmada

Auditando las ~860 descripciones reales aparecen dos pesos no incluidos en la tabla que
dio Yako: **5 kg** (8 referencias, gama Grasas) y **16 kg** (1 referencia). No se inventa
un equivalente — se dejan como `5KG` / `16KG` (unidad de compra quitada, unidad
normalizada a mayúsculas, pero sin convertir a litros) hasta que Yako confirme el envase
real.

## Consecuencias

- `js/profiles/profile-repsol.js`: `isRealValue()`, `cleanRepsolDescription()`,
  `KG_TO_L_DESC` / `GR_TO_ML_DESC`.
- Verificado contra las 3 tarifas reales (mayo, agosto normal, agosto con aportaciones):
  0 colisiones de ref, descripciones limpias verificadas contra los 5 ejemplos exactos
  que dio Yako, `liters`/PVP sin cambios respecto a antes del renombrado.
- Pendiente: equivalencia L de 5kg y 16kg (preguntado a Yako).

## Referencias

- `js/profiles/profile-repsol.js`, `js/core/parser.js` (sin cambios — se sigue usando
  `Parser.extractLiters`/`cleanDescription` para el cálculo).
- [docs/proveedores/repsol.md](../proveedores/repsol.md)
