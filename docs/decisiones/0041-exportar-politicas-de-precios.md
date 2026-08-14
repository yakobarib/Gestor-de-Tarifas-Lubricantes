# ADR 0041 — Exportar Políticas de Precios (PDF) + reordenar Marca/Gama en Reglas

**Fecha:** 2026-08-14
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako quiere un documento de referencia — no una tarifa de venta, sino la EXPLICACIÓN de
qué reglas está aplicando la app hoy para llegar a cada precio, por marca y por formato —
para guardar o compartir sin tener que abrir la app y navegar cada nivel/formato a mano.
Pide también reordenar Marca/Gama en Reglas (apiladas en una columna) para dejar sitio a
la derecha para el nuevo botón.

Al preguntar el alcance (¿solo la marca/gama que tengas abierta, o las 6 marcas de
golpe?), Yako propone algo mejor: un selector propio, independiente del que decide qué
marca estás EDITANDO arriba, con las opciones "Todas las marcas" o cada una — así el
propio selector decide el nivel de detalle sin que el usuario tenga que ir marca por
marca si quiere el resumen completo.

## Decisión

### Layout (`index.html`/`styles.css`)

`.rules-marca-gama` (nuevo) envuelve los dos `.field` de Marca y Gama en una columna
(antes eran dos columnas de `.filter-row`) — la leyenda de "Todas las gamas" se queda
igual, ahora debajo de Gama dentro de esa misma columna. A la derecha, un nuevo `.field`
(`.rules-policy-export`) con el selector de alcance + el botón, ocupando el espacio que
antes ocupaba Gama.

### Selector de alcance + botón

`#rulesPolicyBrandSelect` ("Todas las marcas" + una opción por marca, sin depender de
`currentBrandId`) + `#btnExportPolicies` — deliberadamente **independientes** del
Marca/Gama de arriba: exportar la política de AD Parts no requiere tener AD Parts
abierto para editar en ese momento.

- **Una marca concreta**: `PdfWriter.exportPolicyPdf` — A4 apaisado, dos tablas lado a
  lado (PVP a la izquierda, Netos Bonus a la derecha), una fila por formato real de esa
  marca (fusionando todas sus gamas, igual que ya hace "Todas las gamas" en el resto de
  Reglas). Columnas PVP: Formato · Margen aplicado · Modo especial (1+2/PVP Neto/—).
  Columnas Netos Bonus: Formato · Margen aplicado · Obsequio · Salida impresa. Sin
  precios en €: sería un "PVP de tal formato" ficticio (depende del coste real de cada
  producto, no hay un único coste por formato) — el documento explica la REGLA, no un
  importe.
- **"Todas las marcas"**: `PdfWriter.exportAllPoliciesPdf` — A4 vertical, una tabla,
  una fila por marca, sin desglose por formato (para que las 6 quepan en una hoja):
  coste base de PVP, margen por defecto + modo, redondeo, margen por defecto de Netos
  Bonus, y una columna de notas (si algún formato tiene "1+2"/"PVP Neto" activo, o
  cuántos formatos tienen un obsequio puesto).
- **Margen efectivo por formato**: en vez de reimplementar aquí la prioridad
  formatModes > byFormat > defaultMargin (ya la tiene `Pricing.compute`), se construye
  una fila ficticia con coste 100 en los tres campos de coste (para que cualquier
  `baseCostField`/`costCascade` encuentre "coste" y no se pierda en el hueco de "sin
  coste") y se lee `marginPct` del resultado — el PVP que salga de esa llamada no se usa
  para nada, solo el margen resuelto.
- **Nombre de fichero**: `Política de Precios {Marca} dd-mm-aaaa.pdf` (o "Todas las
  Marcas") — mismo formato de fecha que el resto (ADR 0035), pero con "Política de
  Precios" en vez de "Tarifa" al no ser una tarifa. `ExcelWriter.buildFilename` se separa
  en `dateSlug()`/`fileBrandLabel()` (reusables) + la función original (que sigue
  devolviendo "Tarifa …", sin cambios de comportamiento para los exports existentes).
- **Efecto colateral aceptado**: generar el PDF de una marca nunca abierta en Reglas
  sintetiza y guarda sus niveles por defecto (mismo camino que `renderLevels()` la
  primera vez que se visita esa marca) — no hay forma de "leer sin escribir" cuando la
  config todavía no existe, y es exactamente lo que pasaría si Yako abriera esa marca a
  mano.

### Copy desactualizado corregido de paso

El párrafo de ayuda de Reglas seguía mencionando el "precio del premio fijo (50€
bidones / 100€ cubas)" de Netos Bonus — ya no es así desde el ADR 0040 (ahora es un
importe editable por formato, vacío por defecto). Se actualiza el texto a la explicación
correcta ("el Obsequio en € que se ponga por formato").

## Verificación

Con AD Parts (formatos 5L/208L, niveles recién sintetizados): `exportPolicyPdf` genera
`Política de Precios AD 14-08-2026.pdf` sin error, con las dos tablas construidas a
partir de niveles vacíos (`byFormat`/`formatModes` sin entradas → margen efectivo =
margen por defecto en todas las filas, tal y como debe verse para una marca recién
creada). `exportAllPoliciesPdf` con las 6 marcas genera `Política de Precios Todas las
Marcas 14-08-2026.pdf`. Layout comprobado por posición real en el DOM: Gama queda
190px+ por debajo de Marca (apiladas), el bloque de exportar políticas queda a la
derecha (más de 480px de diferencia en `left`). Consola sin errores en ningún caso,
incluida la ruta "Todas las marcas" que recorre las 6 marcas (alguna sin tarifa
importada, sin que eso rompa nada).

## Consecuencias

- `app/index.html`: nueva estructura de Marca/Gama/exportar políticas en Reglas.
- `app/css/styles.css`: `.rules-top-row`/`.rules-marca-gama`/`.rules-policy-export`.
- `js/screens/screen-rules.js`: `renderPolicyBrandSelect()`, `gatherBrandPolicy()`,
  `doExportPolicies()`.
- `js/export/pdf-writer.js`: `exportPolicyPdf()`, `exportAllPoliciesPdf()`,
  `effectiveMarginInfo()`, tablas de etiquetas (`BASE_COST_LABELS`/`MODE_LABELS`/
  `ROUNDING_LABELS`).
- `js/export/excel-writer.js`: `dateSlug()`/`fileBrandLabel()` extraídos de
  `buildFilename()` para reusarlos en documentos que no son una tarifa.

## Referencias

- `js/screens/screen-rules.js`, `js/export/pdf-writer.js`, `js/export/excel-writer.js`.
- [ADR 0035](0035-nomenclatura-limpia-ficheros-exportados.md) (formato de fecha en
  nombre de fichero), [ADR 0040](0040-margen-por-defecto-en-vivo-y-resaltado.md)
  (Obsequio editable, corrige el copy desactualizado).
