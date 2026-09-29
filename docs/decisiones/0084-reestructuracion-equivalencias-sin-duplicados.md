# ADR 0084 — Reestructuración de los ficheros de equivalencias (sin duplicados)

**Fecha:** 2026-09-29
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Al revisar el Ranking completo (ADR 0083), Yako sospechaba que "Equivalencias Aceites por
Marcas.xlsx" pudiera solapar con los otros 4 ficheros de equivalencias. Se confirmó con
datos reales de Neon:

- 218 grupos / 730 refs en "Aceites" vs 161 grupos / 516 refs en los otros 4 juntos.
- 165 referencias (22,6% de Aceites) colisionaban EXACTAMENTE con Motor Vehículo
  Industrial, Hidráulicos y Transmisión y Ejes — misma marca, misma ref, en DOS ficheros
  a la vez.
- No eran copias idénticas: un caso real (ENI 106423, "i-Sigma Top MS 15w40") existía como
  grupo separado en Aceites y en Motor VI, con datos distintos entre ambos (Castrol
  presente en uno y ausente en el otro, referencia de Shell distinta) — desincronizados,
  no solo redundantes.
- El 77,4% restante de Aceites SÍ era contenido único, y sus especificaciones técnicas
  (ACEA C5/C6/A1/B1, ILSAC GF-5/GF-6A, 0W20) confirmaban que era genuinamente vehículo
  ligero (turismo) — frente al ACEA E7/E9 de las referencias duplicadas (diésel pesado).

**Decisión de Yako**: no hacía falta un fichero de "vehículo ligero" nuevo — "Aceites por
Marcas" ya lo era, solo que arrastraba contenido pesado duplicado. Se reestructuró todo el
conjunto de ficheros:

1. **"Aceites por Marcas" → "Motor Vehículo Ligero"**: mismo contenido, sin las
   referencias que ya viven en Motor Industrial/Hidráulicos/Transmisión. Yako hizo el
   recorte a mano sobre una copia.
2. Al recortar, Yako detectó una CUARTA categoría mezclada dentro de "Aceites": líquidos
   de transmisión automática (ATF/Dexron/Mercon) — los separó en un fichero aparte, pero
   pidió fusionarlos con "Transmisión Manual y Ejes" en un solo fichero de Transmisión
   (no cinco categorías separadas, sino Manual+Ejes+Automática juntos bajo la categoría
   `transmision_ejes` ya existente).
3. **Formato**: "Aceites"/"Vehículo Ligero" y "Transmisión Automática" vivían en el
   formato "spec" (solo referencias, sin descripción por marca — lo que además hacía
   "difícil de revisar y ajustar", en palabras de Yako). Se convirtieron al formato
   "block" que ya usan Grasas/Hidráulicos/Motor Industrial/Transmisión (descripción por
   producto y marca), con las descripciones rellenadas automáticamente desde
   `verified_descriptions` + `imported_tariff_rows` (Neon) por marca+ref — sin que Yako
   tuviera que teclearlas a mano. Cobertura: 87,1% en Vehículo Ligero, 92,7% en
   Transmisión; el resto queda con la celda de descripción en blanco (no bloquea nada, el
   Ranking ya sabe mostrar algo razonable — ficha técnica o ref — cuando falta).

Durante la conversión salieron dos bugs más del lector (`equivalence-reader.js`):

- **"SOLO EN 1 LITRO"** (Repsol) era una variante de "EN OTROS FORMATOS" con texto libre
  — se colaba como si fuera una ref real, igual que "FUERA DE TARIFA" antes (ADR 0083). Se
  sustituyó el `Set` de marcadores fijos por una regex
  (`/^(EN OTROS FORMATOS|SOLO EN .*LITROS?)$/i`) para no tener que perseguir cada variante
  nueva a mano en el futuro.
- El fichero "Vehículo Ligero" que hizo Yako conservaba, sin querer, las 23 filas de
  transmisión automática que también había copiado al fichero nuevo — se excluyeron del
  fichero final por colisión de ref con el fichero de Transmisión, el mismo criterio que
  destapó el problema original.

## Resultado final

| Categoría (interna) | Fichero | Grupos |
|---|---|---|
| `aceites` (etiqueta UI: "Motor Ligero") | Equivalencias Motor Vehiculo Ligero.xlsx | 90 |
| `grasas` | Equivalencias Grasas.xlsx | 36 |
| `hidraulicos` | Equivalencias Hidraulicos.xlsx | 38 |
| `motor_industrial` | Equivalencias Motor Vehiculo Industrial.xlsx | 44 |
| `transmision_ejes` | Equivalencias Transmisión Manual y Automática.xlsx | 68 |

**Colisiones de referencia entre categorías: 0** (antes: 165 solo entre Aceites y las
otras 3). Verificado ejecutando el código REAL de `EquivalenceReader`/`EQUIV_BRAND_ALIASES`
contra los 5 ficheros finales, no una simulación aparte.

La carpeta `Base de Conocimiento/Equivalencias/` se dejó con solo los 6 ficheros vigentes
(los 5 de equivalencias + Rebranding Repsol) — se descartaron el "Aceites General por
Marcas.xlsx" (copia del original, guardada aparte por Yako), "Motor Vehiculo Ligero.xlsx"
(versión spec sin descripciones), "Transmisión Automática.xlsx" y "Transmisión Manual y
Ejes.xlsx" (fusionados en el nuevo fichero único), y el "Rebranding Repsol Moto
(antigua-nueva).xlsx" duplicado (ver conversación — sin columnas CASTROL/ENI rellenas y
sin columna MARCA, se habría guardado bajo el proveedor "desconocida").

## Cambios de código

- `app/js/comparison/equivalence-reader.js`: nuevo `readKnownFile` reconoce
  "vehiculo ligero"/"vehículo ligero" → categoría `aceites`, formato block (antes solo
  reconocía "aceites por marcas" → formato spec, que se mantiene por si alguna vez
  reaparece ese fichero). Marcador "sin equivalencia por variante de tamaño" ahora es una
  regex, no una lista cerrada.
- No hizo falta tocar `EQUIV_BRAND_ALIASES` de nuevo (ya incluía ADP/ADS desde ADR 0083) ni
  `RANK_CATEGORY_LABELS` (la categoría sigue siendo `aceites` internamente, ya etiquetada
  "Motor Ligero" en el Ranking).

## Pendiente (no bloqueante)

- ~48 refs de Vehículo Ligero y ~12 de Transmisión se quedaron sin descripción (no
  encontradas en `verified_descriptions` ni `imported_tariff_rows`) — Yako puede
  completarlas a mano en el Excel cuando quiera, no impide usar los ficheros.
- Yako debe reimportar los 5 Excel de equivalencias desde Importación para que Neon
  recalcule el índice con esta estructura.

## Referencias

- ADR 0083 (Ranking completo — donde se detectó el problema).
- ADR 0008 (equivalencias entre marcas, formatos spec/block).
- `app/js/comparison/equivalence-reader.js`, `app/js/comparison/equivalence-index.js`.
