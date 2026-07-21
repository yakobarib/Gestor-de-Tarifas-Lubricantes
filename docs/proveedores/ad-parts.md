# AD Parts

## Estado
- **Versión de app:** ⏳ pendiente (v0.2, próximo objetivo)
- **Prioridad:** ALTA — marca propia
- **Última tarifa disponible:** `Tarifa AD Aceite - 24 abril 2026.xlsx` + `Tarifa AD Producto Químico Mayo 2026.xlsx`

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

Existe una **tarifa separada** para producto químico AD Parts (`Tarifa AD Producto Químico Mayo 2026.xlsx`). Se procesa igual pero es un archivo distinto.

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

## Estado en la app

**No implementado todavía.** Plan de implementación (v0.2):

1. Detección de archivo AD Parts por nombre (`AD Parts`, `ADP`) o por presencia de hojas `AD NORMAL`/`AD STANDARD`.
2. Preguntar al usuario **qué gama importar** (Normal / Standard) — o importar las dos en pestañas separadas.
3. JOIN automático con la hoja `Tarifa` para completar descripción y familia.
4. Prefijo automático `ADP` en la salida.
5. Columna extra `FAM` en la salida Skrit.
6. **Interfaz para PVP manuales del 5L**: opción "cargar PVPs manuales" que sobreescribe el cálculo por margen.

## Referencias

- Entrada: `EJEMPLOS TARIFAS/ADP/Ejemplo Tarifa de ENTRADA AD Parts GAMA NORMAL Y GAMA STANDARD aceites triple neto.xlsx` y `... aceites precio factura.xlsx`.
- Salida esperada: `EJEMPLOS TARIFAS/ADP/Ejemplo Tarifa de SALIDA para SKRIT acceites AD Parts GAMA NORMAL.xlsx` y `... GAMA STANDARD.xlsx`.
- Salida producto químico: `EJEMPLOS TARIFAS/ADP/Ejemplo Tarifa de SALIDA AD Parts producto quimico.xlsx`.
- Notas Albert 5L: `TARIFAS ACTUALIZADAS/AD Parts/Tarifa AD Aceite - Formato 5 litros modificado por Albert.jpeg`.
