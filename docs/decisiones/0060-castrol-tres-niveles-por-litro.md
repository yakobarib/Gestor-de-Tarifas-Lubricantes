# ADR 0060 — Castrol: tres niveles de coste calculados por litro, litros priorizando el maestro

**Fecha:** 2026-08-25
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Llega una nueva tarifa Castrol ("Formato Castrol", septiembre 2026) con las columnas
reordenadas y algunos nombres cambiados (ej. "Precio Unitario" → "PRECIO UNITARIO NUEVO
SEPT"). El importador ya buscaba columnas por contenido, no por posición, así que la
detecta sin problema — pero el fichero además **ya no trae** la columna "Precio Neto Neto
envase con todas aportaciones" que Yako añadía a mano en tarifas anteriores para poder
calcular el coste triple-neto.

Yako aclaró la cascada real de precios de Castrol, los tres son "por litro" y están en el
fichero oficial:

- Tarifa referencia → (Pronto Pago + Dto Logístico) → **"Precio Unitario..."** (coste
  factura).
- → (Rapel fin de año) → **"Precio neto litro"** (coste neto-neto).
- → (aportaciones Turfview/AD 360/Objetivo CV/Marketing) → **"Precio neto litro con
  aportaciones"** (coste triple-neto).

También aclaró que la tarifa no trae litros de envase reales: la columna "volumen unidad
de venta" es por unidad de compra, y solo coincide con el envase en bidones/cubas — en
cajas no coincide (ej. "12X1L" → el envase real de venta es la botella de 1L, no la caja
de 12L; la columna de unidad de venta mostraría 12). Instrucción de Yako: adivinar los
litros desde el maestro ya cargado (verificado por él, marca a marca) en vez de fiarse de
esa columna.

## Decisión

`profile-castrol.js` (`readCastrol`):

1. **Litros**: se prioriza `MasterCache.get('castrol', ref).liters` (maestro compartido en
   Neon, ya verificado por Yako) cuando existe. Solo para referencias nuevas sin verificar
   todavía se cae al parseo de la descripción ya existente (`parseLitersFromDescription`,
   patrón "NxM<unidad>") — comportamiento sin cambios para ese caso.
2. **Los tres costes se calculan igual**: precio-por-litro de la columna correspondiente ×
   litros del envase (el mismo criterio que ya usaba `costFactura`). Se detectan por
   contenido: `idxPrecioNetoLitro` = header que contiene "PRECIO NETO LITRO" y NO
   "APORTACION"; `idxPrecioNetoAportaciones` = header que contiene ambas. Ninguna de las
   dos es obligatoria — si el fichero no las trae, esa fila simplemente se queda sin ese
   nivel de coste (igual que ya pasaba con el resto de columnas opcionales).
3. Se retira la lectura de la columna "envase ya multiplicado" (`idxNetoNetoEnvase`) — ya
   no hace falta que Yako la añada a mano.
4. `costNetoNeto` se guarda como fila explícita (`row.costNetoNeto`), mismo patrón que ya
   usa Repsol para traer sus tres niveles en una sola fila (ver `db.js`) — queda disponible
   como base de coste en Reglas/Exportación/Comparación para Castrol, donde antes no
   existía.

## Verificación

Simulado contra el fichero real completo (`Tarifa septiembre 2026 - Formato Castrol -
ENVIADA.xlsx`, 378 filas válidas) y el maestro ya cargado (`Maestro Castrol.xlsx`, 451
filas):
- Detección de columnas correcta (`MATERIAL`, `DESCRIPCIÓN DE MATERIAL`, `PRECIO UNITARIO
  NUEVO SEPT`, `PRECIO NETO LITRO`, `PRECIO NETO LITRO CON APORTACIONES`, `SUSTITUYE A`),
  sin confundirse con las columnas de aportaciones individuales (Turfview, AD 360, etc.).
- 365/378 filas usan litros ya verificados del maestro; 12 son referencias nuevas (aún sin
  verificar) que caen al parseo de descripción con valores plausibles (1L, 4L, 5L, 0.3L,
  60L, 208L).
- 1 fila (`1628C2`, "Vecton LD 10W-40 E8/E11, 208 9M01") no tiene unidad en la descripción
  ("208" sin "L") ni está en el maestro — se queda sin litros y por tanto sin coste, se
  descarta silenciosamente igual que cualquier fila sin litros detectables. Reportado a
  Yako para que revise el dato de origen; no se ha adivinado el valor.
- `node --check` sobre `profile-castrol.js`.

## Referencias

- ADR 0054 (maestro compartido en Neon — `MasterCache`).
- ADR 0056 (sin prefijo en ref interno).
- `js/profiles/profile-castrol.js`, `js/core/master-cache.js`, `js/core/db.js`.
