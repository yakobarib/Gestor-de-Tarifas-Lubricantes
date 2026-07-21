# Racing Oil

## Estado
- **Versión de app:** ⏳ pendiente (v0.5)
- **Última tarifa disponible:** `Tarifa Racing Oil - Lubricantes - Agosto 2025.xlsx`

## Formato de la tarifa entrante

Archivo Excel con **13 hojas por familia**:

| Hoja | Familia |
|---|---|
| `V.LIGERO` | Turismos |
| `V.PESADO` | Camión |
| `AGRÍCOLA` | Tractores |
| `TRANSMISIÓN` | Cajas de cambios / diferenciales |
| `HIDRÁULICOS` | Hidráulicos |
| `INDUSTRIA` | Industrial |
| `GRASA` | Grasas |
| `MOTO` | Motocicletas |
| `CLASSIC` | Vehículos clásicos |
| `MARINA` | Náutica |
| `ANTICOGELANTE` (sic) | Anticongelantes (nota: typo en el nombre de la hoja) |
| `ADITIVOS` | Aditivos |
| `PRECIOS ESPECIALES AD IBIZA` | Precios negociados específicos |

## Casuísticas críticas

### 1. Cabecera bipartita (2 filas)

Estructura observada en la mayoría de hojas:

| Fila | Contenido |
|---|---|
| Fila 12 | `COD. FABRI`, `EAN`, `PRODUCTO ` (con espacio final), — |
| Fila 13 | — , — , `VEICULOS LIGEROS` (nombre sección), `ENVASE`, `UDS. POR CAJA`, `PRECIO` |
| Fila 14+ | Datos |

Es decir: los headers reales se reparten entre 2 filas y hay que combinarlos para obtener la cabecera completa.

### 2. Litros como string sufijado con "L"

La columna `ENVASE` contiene valores como `"1L"`, `"5L"`, `"200L"`, `"1000L"` — string, no numérico. Hay que parsear el número desechando la `L`.

### 3. Hoja especial "PRECIOS ESPECIALES AD IBIZA"

Estructura distinta al resto: cabecera en fila 20-21, columnas `COD. FABRI`, `PEDIDO`, `PRODUCTO `, (vacío), `PRECIO`, `P. NORMAL`, `BAJADA`. Datos desde fila 22.

Este es un caso especial: precios negociados solo para AD Ibiza (el cliente donde trabaja Yako). Al importar, hay que decidir si:
- Usar `PRECIO` (el especial) — que sería lo esperado.
- Usar `P. NORMAL` como referencia.
- Mostrar `BAJADA` (%) como información para el usuario.

### 4. Typo en nombre de hoja

La hoja de anticongelantes se llama `ANTICOGELANTE` (falta la N). La detección debe ser tolerante a errores tipográficos (comparación aproximada o lista de aliases).

### 5. EAN a veces vacío

En algunas refs el EAN viene vacío. Es normal, no un error.

### 6. Precios en 0

Se han observado filas con `PRECIO = 0`. Hay que marcarlas y excluirlas del export (regla común: coste ≤ 0 → excluir).

## Estado en la app

**No implementado todavía.** Plan (v0.5):

1. Detección por nombre archivo `Racing`.
2. Iterar hojas del workbook, saltar las que no tengan cabecera en fila 12.
3. Combinar filas 12+13 para reconstruir headers.
4. Parsear `ENVASE` (string "1L") para obtener litros numéricos.
5. Manejar la hoja especial "PRECIOS ESPECIALES AD IBIZA" como caso aparte (fila 20-22).
6. Filtrar precios ≤ 0.

## Referencias

- Entrada: `EJEMPLOS TARIFAS/RACING OIL/Ejemplo Tarifa de ENTRADA Racing Oil.xlsx`
- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Racing Oil/Tarifa Racing Oil - Lubricantes - Agosto 2025.xlsx`
- Salida esperada: no hay archivo de referencia en `EJEMPLOS TARIFAS/RACING OIL/`. Aplicar el patrón Skrit común (5 columnas).
