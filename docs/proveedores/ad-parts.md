# AD Parts

## Estado
- **Versión de app:** ✅ implementado en v0.3.0 (Aceite Normal + Standard [+ Sport Car] y Producto Químico)
- **Prioridad:** ALTA — marca propia
- **Última tarifa disponible:** `Tarifa AD Aceite - 24 abril 2026.xlsx` + `Tarifa AD Producto Químico Mayo 2026.xlsx`

## Regla de litros por sufijo de referencia (descubierta en v0.3.0)

Los últimos 3 dígitos de la referencia (quitando puntos) codifican los litros del envase,
con el caso especial `'000'` → 1000 L:

| Referencia | Litros |
|---|---|
| `10.005` / `10005` | 5 L |
| `10.208` / `10208` | 208 L |
| `10.600` / `10600` | 600 L |
| `10.1000` / `101000` | 1000 L (caso especial `'000'`) |

Verificado cruzando 235/235 refs de `AD NORMAL` contra la descripción real de `Tarifa`. Es
la única fuente fiable en la **gama Standard**: su descripción es siempre igual para todos
los formatos ("AD STANDARD SC 5W30"), sin ningún dato de tamaño — solo la referencia lo
indica. Implementada en `Parser.litersFromRefSuffix()` (`app/index.html`), usada como
fuente primaria con fallback al parser de descripción existente.

## Dos formatos de entrada (ambos soportados)

AD Parts Aceite llega en uno de estos dos formatos según el mes (confirmado por Yako):

1. **"ENTRADA" crudo** — hojas `AD NORMAL` / `AD STANDARD` (`REFERENCIA` + `PRECIO COMPRA
   FACTURA`) + hoja `Tarifa` maestro. Join: `AD NORMAL/STANDARD.REFERENCIA` ==
   `Tarifa.REF PROVEEDOR` **sin el punto** (`"11.020"` → `"11020"`) — descubierto cruzando
   los datos reales, no documentado por el proveedor.
2. **"de trabajo"** — hojas `Coste` (gama Normal, `PRODUCTO` en carry-forward), `ADStandard`
   (gama Standard, `Envase` ya numérico) y `CosteSC` (línea **Sport Car**, 3ª línea de
   producto no presente en el formato "ENTRADA"). El coste vigente está siempre en la
   columna inmediatamente a la derecha de `ref.` — su cabecera es una fecha variable mes a
   mes, así que se localiza por posición, no por nombre. `CosteSC` trae además una segunda
   columna `ref.` (numérica) antes de la de coste.

`ExcelReader.ADPartsAceiteProfile` detecta cuál de los dos ha llegado por las hojas
presentes en el workbook.

## Formato de la tarifa entrante

Archivo Excel con múltiples hojas. Estructura observada en el ejemplo de entrada:

| Hoja | Uso | Filas |
|---|---|---|
| `Tarifa` | Maestro completo con 42 columnas (precios base, descuentos, netos, familia, dimensiones, tasas) | 276 |
| `Resumen Dto.Compra` | Estructura de descuentos por familia | — |
| `AD NORMAL` | **Fuente para Skrit** (Gama Normal) — solo REFERENCIA + PRECIO COMPRA FACTURA | 236 |
| `AD STANDARD` | **Fuente para Skrit** (Gama Standard) — solo REFERENCIA + PRECIO COMPRA FACTURA | 41 |

Las hojas `AD NORMAL` / `AD STANDARD` son las que alimentan directamente Skrit. La hoja `Tarifa` completa se usa para consultas internas (triple neto, rappels).

## Columnas relevantes

### Hoja `AD NORMAL` / `AD STANDARD` (para Skrit)

| Columna | Campo interno | Notas |
|---|---|---|
| `REFERENCIA` | `ref` | Se prefija con `ADP` en la salida Skrit (`10005` → `ADP10005`). |
| `PRECIO COMPRA FACTURA` | `costPerPack` | Precio factura por envase. Es el coste que va a Skrit. |

**Nota clave:** la descripción del producto no está en estas hojas. Hay que hacer JOIN con la hoja `Tarifa` por `REFERENCIA` para obtener `DESCRIPCION ARTICULO` y `FAMILIA ADGLOBAL`.

### Hoja `Tarifa` (para consulta / triple neto)

Columnas críticas: `MARCA`, `REF PROVEEDOR`, `REF COMERCIAL`, `UD CAJA`, `FAMILIA ADGLOBAL`, `DESCRIPCION ARTICULO`, `PRECIO VENTA`, `DTO VENTA`, `PRECIO COMPRA`, `DTO COMPRA`, `NETO COMPRA`, `RAPPEL SOCIO`, `RAPPEL GRUPO`, `NETO NETO`, `TASAS`.

## Casuísticas críticas

### 1. Dos gamas separadas

- **Gama Normal**: aceite estándar.
- **Gama Standard**: aceite entrada de rango (más barato).

Cada gama genera un Excel Skrit separado, con márgenes potencialmente distintos.

### 2. Refrigerantes en el "saco" de lubricantes

El catálogo de refrigerantes AD forma parte del mismo flujo aunque técnicamente sea químico, no lubricante. Yako los trata en la misma tarifa.

### 3. Producto químico AD Parts

Existe una **tarifa separada** para producto químico AD Parts (`Tarifa AD Producto Químico Mayo 2026.xlsx`) — archivo distinto, perfil de lectura distinto (`profile-ad-parts-quimico.js`), pero se registra bajo la **misma tarjeta de marca** que Aceite (`ad_parts_aceite` en `BRANDS`), como una gama más (`quimico`) junto a Normal/Standard/Sport Car — una sola tarjeta "AD Parts" en Importación, Reglas, Comparación y Exportación.

### 4. Dos tarifas de coste

- **Precio factura**: el que se mete en Skrit como coste (columna `PRECIO COMPRA FACTURA` en las hojas de gama).
- **Triple neto**: coste real tras `DTO COMPRA + RAPPEL SOCIO + RAPPEL GRUPO`. Está en la columna `NETO NETO` de la hoja `Tarifa`. Se usa para análisis interno, NO para Skrit.

### 5. Formato 5L con PVP manual (⚠️ CRÍTICO)

**El PVP del formato 5L lo fija Albert (el jefe) manualmente**. No se debe automatizar. Ver [imagen adjunta al proyecto](../../TARIFAS%20ACTUALIZADAS/AD%20Parts/Tarifa%20AD%20Aceite%20-%20Formato%205%20litros%20modificado%20por%20Albert.jpeg).

**Implementación prevista**: la app debe permitir cargar un archivo de "PVP manuales" (o pegar valores) que sobreescriben el cálculo automático para las refs indicadas. Los otros formatos siguen la regla de margen normal.

### 6. Prefijo REF con "ADP" en salida

Al exportar a Skrit, la referencia se prefija: `10005` → `ADP10005`. Esto es único de AD Parts (Repsol, Castrol, Eni no llevan prefijo).

### 7. Columna FAM en la salida

La salida Skrit de AD Parts incluye una columna extra `FAM` con código de familia de 2 dígitos (ej. `06` = aceite). Se derivaría de `FAMILIA ADGLOBAL` en la hoja `Tarifa`.

## Notas de negocio

- Márgenes típicos (a confirmar por Yako):
  - AD Parts Normal, 1L / 5L: menores que en las marcas premium (competencia agresiva).
  - AD Parts Standard: márgenes altos porque el coste de entrada es muy bajo.
- La marca propia debería tener márgenes objetivo definidos por dirección. Falta capturar la política.

## Estado en la app (v0.3.0)

1. ✅ Detección de archivo AD Parts por nombre (`AD Parts`, `ADP`) o por presencia de hojas `AD NORMAL`/`AD STANDARD`/`Coste`+`ADStandard`.
2. ✅ Las gamas (Normal / Standard / Sport Car si aparece) se muestran en **pestañas independientes**, cada una con su propia configuración de margen, historial de comparación y export.
3. ✅ JOIN automático con la hoja `Tarifa` (formato "ENTRADA") para completar descripción y familia.
4. ✅ Prefijo automático `ADP` en la salida.
5. ✅ Columna extra `FAM` en la salida Skrit (fijo `06` = Aceite Motor, única familia observada).
6. ✅ **PVP manual editable por fila** en la tabla de preview (no limitado a 5L — cualquier ref admite override), en vez de importar un Excel aparte de PVPs manuales.

## Referencias

- Entrada: `EJEMPLOS TARIFAS/ADP/Ejemplo Tarifa de ENTRADA AD Parts GAMA NORMAL Y GAMA STANDARD aceites triple neto.xlsx` y `... aceites precio factura.xlsx`.
- Salida esperada: `EJEMPLOS TARIFAS/ADP/Ejemplo Tarifa de SALIDA para SKRIT acceites AD Parts GAMA NORMAL.xlsx` y `... GAMA STANDARD.xlsx`.
- Salida producto químico: `EJEMPLOS TARIFAS/ADP/Ejemplo Tarifa de SALIDA AD Parts producto quimico.xlsx`.
- Notas Albert 5L: `TARIFAS ACTUALIZADAS/AD Parts/Tarifa AD Aceite - Formato 5 litros modificado por Albert.jpeg`.
