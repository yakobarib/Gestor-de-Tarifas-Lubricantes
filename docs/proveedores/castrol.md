# Castrol

## Estado
- **Versión de app:** ⏳ pendiente (v0.3)
- **Última tarifa disponible:** `Tarifa Castrol Lubricantes - Abril 2026.xlsx`

## Formato de la tarifa entrante

Archivo Excel con varias hojas:

| Hoja | Descripción | Uso |
|---|---|---|
| `Sheet1` | Tarifa completa AUTO + VI (Vehículo Industrial), 32 columnas con **descuentos en cascada** | Fuente principal para cálculo detallado |
| `Tarifa AD con Industria` | Ya con neto sin descuentos | Alternativa consolidada |
| `Vdes` | Volúmenes de descuento (escalas) | Referencia |
| `DATOS` | Consolidada (Marca, Material, Referencia, Litros, Neto Factura, Neto Neto) | **Puede ser la que use la app** — igual que en Repsol |

## Columnas relevantes (`Sheet1`)

Cabeceras en fila 1:

| Columna | Uso |
|---|---|
| `Referencia cliente` | REF a subir a Skrit |
| `Material` | Código Castrol interno |
| `Descripción de Material` | Nombre del producto |
| `litros envase` | **Aquí sí viene la columna de litros directamente** (a diferencia de Repsol) |
| `volumen unidad de venta` | Confirmación |
| `Segmento` / `Gama` / `Familia` | Clasificación |
| `Tarifa referencia octubre 2024` | Precio base |
| `Pronto Pago` | Dto 1 |
| `Dto Logistico` | Dto 2 |
| `Dto total` | Dto acumulado |
| `Precio unitario con dto logistico (eur/L)` | Después de dtos parciales |
| `Neto Factura €/Envase` | **Coste que va a Skrit** |
| `Rapel fin de año` | Dto 3 |
| `Precio neto litro` | Neto de litros |
| `Precio neto litro con aportaciones` | Neto incluyendo Ecoembes/GENCI |
| `Neto Neto €/Envase` | Coste real tras todo |
| `Sustituye a` | Referencia sustituida |

## Casuísticas críticas

### 1. Descuentos en cascada (triple neto)

Castrol da precio base + varios descuentos escalonados. Fórmula típica:
```
Precio base
 → aplicar % Pronto Pago
 → aplicar % Dto Logístico
 → llegar a "Neto Factura" (lo que va a Skrit)
 → aplicar % Rappel fin de año
 → llegar a "Neto Neto" (coste real interno)
```

### 2. Neto Factura vs. Neto Neto

- **Neto Factura**: precio que se factura en el momento (con Pronto Pago + Logístico ya aplicados). **Es lo que se sube a Skrit.**
- **Neto Neto**: precio real tras todos los descuentos incluyendo rappel. Se usa para márgenes internos.

### 3. Aportaciones incluidas en algunas columnas

Castrol es de los proveedores que **desglosa las aportaciones Ecoembes/GENCI** en sus propias columnas (`Precio neto litro con aportaciones`). Al importar hay que decidir qué versión coger para no duplicar cargos.

### 4. Salida con FAM

La salida Skrit histórica incluye columna `FAM = "01"` (aceite). Como en AD Parts.

## Estado en la app

**No implementado todavía.** Plan (v0.3):

1. Detección por nombre archivo `Castrol`.
2. Preferencia por hoja `DATOS` (ya consolidada) si existe; fallback a `Sheet1` con cálculo de cascada.
3. Columna `litros envase` ya presente → no necesita parser (¡bonus!). Pero validar con parser como respaldo.
4. Uso de `Neto Factura €/Envase` como coste (no `Neto Neto`).
5. Columna extra `FAM` en salida.
6. Aviso al usuario si se detectan aportaciones ya incluidas (para no volver a añadirlas en Fase 2).

## Referencias

- Entrada: `EJEMPLOS TARIFAS/CASTROL/Ejemplo Tarifa de ENTRADA Castrol para SKRIT.xlsx`
- Salida esperada: `EJEMPLOS TARIFAS/CASTROL/Ejemplo Tarifa de SALIDA Castrol para SKRIT.xlsx`
- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Castrol/Tarifa Castrol Lubricantes - Abril 2026.xlsx`
