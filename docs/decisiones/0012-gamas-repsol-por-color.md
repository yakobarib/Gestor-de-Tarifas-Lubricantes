# ADR 0012 — Gamas de Repsol detectadas por color de celda, no por texto

**Fecha:** 2026-07-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako pidió reflejar en la tarjeta de Repsol (pantalla Importación) las mismas gamas que ya
se ven para AD Parts y Eni Live. A diferencia de esos dos proveedores (una hoja por gama),
Repsol mete todo el catálogo en `Hoja1`, dividido **verticalmente** por filas de cabecera
de sección intercaladas entre las filas de producto — dio como pista tres filas concretas:
fila 3 `AUTOMOCION`, fila 538 `INDUSTRIA`, fila 539 subcategoría `ENGRANAJES` (dentro de
INDUSTRIA), fila 579 subcategoría `ENGRASE GENERAL` (dentro de INDUSTRIA), fila 746 otra
gama (`PRODUCTOS DE MANTENIMIENTO`).

## Problema: el texto no basta

Inspeccionando la tarifa real no hay forma de distinguir por **valor** una fila de gama
(`AUTOMOCION`, `INDUSTRIA`) de una fila de subcategoría (`MOTO`, `ENGRANAJES`, `ENGRASE
GENERAL`, `DESMOLDEANTES`) — ambas son simplemente texto en la primera celda no vacía de
la fila, con el resto de columnas vacías. No hay una lista cerrada de nombres válidos ni un
patrón de texto (mayúsculas, longitud, prefijo) que las separe.

## Decisión: clasificar por color de relleno de celda

Inspeccionando el estilo de esas celdas (vía `openpyxl` primero, para confirmar, y luego
`XLSX.read(..., { cellStyles: true })` de SheetJS para reproducirlo en el navegador) se
encontró la señal real: **naranja `FFC000` = gama, rojo `FF0000` = subcategoría**. Patrón
verificado en las 3 tarifas reales disponibles (mayo 2026, agosto 2026 normal, agosto 2026
"con aportaciones") — siempre exactamente estos 2 colores, sin una tercera variante, y sin
excepciones fila a fila.

6 gamas resultantes: AUTOMOCION, INDUSTRIA, PRODUCTOS DE MANTENIMIENTO, MARINOS, GRASAS,
ALIMENTARIOS. Detalle completo de subcategorías por gama en
[docs/proveedores/repsol.md](../proveedores/repsol.md).

### La columna del texto varía entre variantes de la tarifa

En la tarifa normal el texto de cabecera cae en la columna A (misma columna que SIRDI). En
la variante "con aportaciones" cae en la columna E, porque las columnas de aportes (M→Z,
ver ADR 0010) desplazan el layout. El perfil no asume una columna fija: localiza el texto
como la **primera celda no nula de la fila** y comprueba el color de relleno justo en esa
celda, no en la columna A a secas.

### Detección de "fila de cabecera" reutiliza el filtro que ya existía

No hace falta un criterio nuevo para saber qué filas mirar: el código ya descartaba como
"cabecera de sección" cualquier fila sin ref válida o sin `PRECIO FACTURA` numérico (para
no colarlas como producto). Ese mismo filtro es el punto de enganche — antes se limitaba a
hacer `continue`, ahora primero intenta clasificar el color antes de saltarla. Confirmado
que este filtro no descarta productos reales por error: las únicas 6 filas que caen en él
sin ser cabecera son productos marcados `"* Novedad"` aún sin precio fijado por Repsol
(excluidos igual que antes, comportamiento sin cambios).

### `cellStyles: true` global en `ExcelReader.read()`

Se añade a la llamada `XLSX.read()` compartida por todos los perfiles (no solo Repsol) —
sin coste apreciable para los demás, que simplemente no leen `cell.s`.

## Consecuencias

- `js/profiles/profile-repsol.js`: nueva lógica de clasificación gama/fam por color,
  `gama`/`fam` dejan de ser `'default'`/ausente fijos.
- `BRANDS.repsol.gamas` pasa de `['default']` a las 6 gamas reales.
- Hallazgo aparte durante la verificación (no relacionado con esta decisión, documentado
  en la ficha de proveedor): 13 filas de la subcategoría MOTO traen `SIRDI = "-"` (literal)
  en vez de una referencia real, y colisionan entre sí en el maestro (864 filas leídas →
  851 persistidas). No es un bug de parsing — el dato de origen no permite distinguirlas.

## Referencias

- `js/profiles/profile-repsol.js`, `js/profiles/excel-reader.js`, `js/core/brands.js`.
- [docs/proveedores/repsol.md](../proveedores/repsol.md)
