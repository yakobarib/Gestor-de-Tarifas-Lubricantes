# Eni Live

## Estado
- **Versión de app:** ⏳ pendiente (v0.4)
- **Última tarifa disponible:** `Tarifa Eni Live - Lubricantes 13 Abril 2026.xlsx`

## Formato de la tarifa entrante

Archivo Excel **multi-hoja por familia**, cabeceras en fila 6 de cada hoja:

| Hoja | Familia | Notas |
|---|---|---|
| `i-Sint` | Aceites motor sintéticos | Estructura completa (TARIFA 0/1/2) |
| `i-Sigma` | Aceites motor gasoil/gasolina | Estructura completa |
| `Rotra` | Transmisiones | Añade columna PAIS, usa `LITROS / KG UNIDAD` |
| `Industria` | Aceites industriales | Como Rotra |
| `Forestal` | Aceites motosierra / motocultor | Como Rotra |
| `i-Ride` | Aceites moto | Sin TARIFA 2 |
| `Food-Line` | Grado alimentario | Sin TARIFA 2 |
| `Grasas` | Grasas lubricantes | Sin TARIFA 2 |
| `Anticongelantes` | Refrigerantes | Sin TARIFA 2 |

Fila 7 contiene subtítulos de sección tipo `LUBRICANTES DE MOTOR`, `CAJAS DE CAMBIO MANUALES O ROBOTIZADAS`. Estas filas no llevan CODIGO numérico y deben saltarse.

## Columnas relevantes

Hojas `i-Sint` / `i-Sigma`:

| Columna | Campo interno |
|---|---|
| `CODIGO` | `ref` |
| `PRODUCTO` | `description` |
| `LITROS UNIDAD` | `liters` (¡presente!) |
| `KGS/NETO ENVASE` | Peso neto |
| `UDS. POR ENVASE` | `unitsPerBox` |
| `EAN 13 (Lata)` | EAN unitario |
| `DUN 14 (caja, garrafa,...)` | EAN caja |
| `P.V.P.R.` | PVP recomendado por Eni (por caja) |
| `P.V.P.R. UNIDAD DE VENTA` | PVP recomendado (por envase) |
| `TARIFA 0` | Precio bruto |
| `TARIFA 0 UNIDAD DE VENTA` | Precio bruto por envase |
| `TARIFA 1` | Precio con dto 1 |
| `TARIFA 1 UNIDAD DE VENTA` | Idem por envase |
| `TARIFA 2` | Precio con dto 2 (el más barato) |
| `TARIFA 2 UNIDAD DE VENTA` | **Coste que va a Skrit** (más barato por envase) |
| `STATUS` | Activo / descatalogado |

## Casuísticas críticas

### 1. Multi-hoja obligatorio

No hay una hoja "master". Hay que recorrer las 9-11 hojas y consolidar. La app tiene que iterar sobre `workbook.SheetNames` filtrando las hojas de datos (por presencia de columna `CODIGO`).

### 2. Cabecera en fila 6

Distinto de Repsol (fila 0) o Castrol (fila 1). Requiere detección robusta: buscar la fila que contenga `CODIGO` + `TARIFA 0`.

### 3. Tres tarifas de coste

TARIFA 0 (bruto) < TARIFA 1 (dto 1) < TARIFA 2 (dto 2, el más barato). El coste que va a Skrit es **TARIFA 2 UNIDAD DE VENTA** — el más barato tras dtos comerciales.

### 4. Hojas sin TARIFA 2

Algunas familias (`i-Ride`, `Food-Line`, `Grasas`, `Anticongelantes`) no tienen TARIFA 2. En esos casos coger `TARIFA 1 UNIDAD DE VENTA`. Añadir aviso en UI.

### 5. Columna LITROS presente

A diferencia de Repsol, Eni sí trae `LITROS UNIDAD` directamente. Usarla en primera instancia; el parser sobre descripción queda como validación cruzada.

### 6. Prefijo "eni" en descripción

En la salida Skrit histórica, se elimina el prefijo `"eni "` del nombre del producto. Ejemplo: `"eni i-Sint 5W40 1L"` → `"i-Sint 5W40 1L"`.

### 7. Formatos especiales

Eni tiene formatos poco comunes (`10L`, `12L`, `50L`) además de los clásicos. El bucket de formatos en la UI debe respetarlos.

## Estado en la app

**No implementado todavía.** Plan (v0.4):

1. Detección por nombre archivo `Eni`.
2. Iterar todas las hojas del workbook. Filtrar por presencia de `CODIGO` numérico.
3. Buscar cabecera en fila 6 o cercana.
4. Extraer `TARIFA 2 UNIDAD DE VENTA` (o `TARIFA 1` si no hay `TARIFA 2`).
5. Usar `LITROS UNIDAD` como fuente primaria; parser como fallback.
6. Limpiar prefijo `"eni "` en la salida.
7. Ofrecer al usuario elegir qué familias exportar (checkbox por hoja).

## Referencias

- Entrada: `EJEMPLOS TARIFAS/ENI LIVE/Ejemplo Tarifa de ENTRADA Eni Live.xlsx`
- Salida esperada: `EJEMPLOS TARIFAS/ENI LIVE/Ejemplo Tarifa de SALIDA Eni Live para SKRIT.xlsx`
- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Eni/Tarifa Eni Live - Lubricantes 13 Abril 2026.xlsx`
