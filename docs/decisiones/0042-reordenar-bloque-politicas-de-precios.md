# ADR 0042 — Corregir el hueco Marca/Gama y reordenar el bloque de políticas de precios

**Fecha:** 2026-08-14
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras el ADR 0041, Gama quedaba muy por debajo de Marca (un hueco enorme, no "un poco de
espacio") y el bloque de la derecha tenía el selector arriba y el botón azul debajo —
Yako pide subir Gama justo bajo Marca, y en la derecha invertir el orden: el botón azul
"Exportar Políticas de Precios" a la altura de Marca, y el desplegable (renombrado
"Política a exportar") a la altura de Gama — ganando espacio en la página con ambos
cambios.

## Causa real del hueco

`.filter-row .field` fija `flex: 1 1 190px`, pensado para una fila HORIZONTAL de campos
que se reparten el ancho. Al envolver Marca y Gama en `.rules-marca-gama` (una columna
VERTICAL, `flex-direction: column`), ese mismo `flex-grow: 1` heredado por el selector de
descendientes hacía que cada `.field` se repartiera el ALTO disponible de la columna en
vez del ancho — Marca crecía para ocupar la mayoría del espacio vertical libre,
empujando Gama hacia abajo. No era un problema de `gap` ni de márgenes: el `gap` de
0.9rem ya estaba bien puesto, el hueco venía de ese flex-grow mal heredado.

## Decisión

- `.rules-marca-gama .field, .rules-policy-export .field { flex: 0 0 auto; }` — anula el
  flex-grow heredado, cada campo ocupa solo su alto natural; el hueco entre Marca y Gama
  pasa a ser justo el `gap` de la columna (0.9rem).
- `.rules-policy-export` se convierte en una columna igual que `.rules-marca-gama` (antes
  era un único `.field`), con dos filas:
  1. Botón "Exportar Políticas de Precios", con un `<label>&nbsp;</label>` vacío encima
     para igualar el alto de la etiqueta "MARCA" de la fila de la izquierda (mismo
     patrón ya usado en el botón "Exportar" de la pantalla Exportación) — queda a la
     misma altura que el selector de Marca.
  2. El desplegable, renombrado de "Marca a exportar" a **"Política a exportar"**, en la
     misma fila que Gama.

## Verificación

Posiciones reales en el DOM: la fila de Marca/botón y la fila de Gama/selector quedan
exactamente alineadas (`top` idéntico en ambos pares, 455.86px y 517.36px
respectivamente); el hueco entre Marca y Gama pasa de ser un salto de cientos de píxeles
a los ~18px esperados del `gap`. Etiqueta confirmada como "POLÍTICA A EXPORTAR" (mayúsculas
por `text-transform`, igual que el resto de etiquetas de campo). El botón sigue
generando el PDF sin errores tras el cambio (probado con "Todas las marcas"). Consola
limpia en toda la prueba.

## Referencias

- `app/index.html`, `app/css/styles.css`.
- [ADR 0041](0041-exportar-politicas-de-precios.md) (bloque original, con el bug de
  layout que corrige este ADR).
