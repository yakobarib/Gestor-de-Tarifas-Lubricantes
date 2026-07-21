# Repsol

## Estado
- **Versión de app:** v0.1 (2026-07-20)
- **Última tarifa procesada:** `Tarifa Repsol Lubricants - 06 mayo 2026.xlsx`
- **Última actualización de este documento:** 2026-07-21

## Formato de la tarifa entrante

**Lo que envía Repsol tal cual** es un archivo `.xlsx` con **una sola hoja `Hoja1`**:
- Fila 0: título de la tarifa (ej. `TARIFA 1 MAYO 2026`).
- Fila 1: cabeceras (`SIRDI`, `NOMBRE`, `PESO NETO`, `UDSX CAJA`, `PRECIO FACTURA`, `CLASIFICACIÓN`, `PREMIUNIZACIÓN`, `EAN / 13`, `EAN / 14`, `COMENTARIO`).
- Filas 2+: intercala **filas de sección** vacías (`AUTOMOCION`, `MOTO`, `PESADO`, `INDUSTRIA`…) con filas de producto reales.

La hoja `DATOS` **NO viene del proveedor**: era una hoja que Yako creaba manualmente antes de existir la app, para tener las filas limpias. La app la reconoce como fallback si aparece, pero la ruta principal es `Hoja1`.

Cambios entre versiones de tarifa:
- **2025 y anteriores**: columna de referencia se llamaba `REF PROVEDOR`.
- **2026 en adelante**: la columna pasó a llamarse `SIRDI` (código interno Repsol). Se añadió también la columna `PREMIUNIZACIÓN`. La app detecta ambos nombres.

## Columnas relevantes (hoja `DATOS` o `Hoja1`)

| Columna Excel | Campo interno app | Notas |
|---|---|---|
| `SIRDI` (2026) / `REF PROVEDOR` (2025 y anteriores) | `ref` | Código proveedor. Se mantiene tal cual en la salida Skrit. Repsol renombró la columna en la tarifa 2026. |
| `NOMBRE` | `description` | De aquí se extrae LITROS con el parser. Ejemplo: `RACING 4T 5W40 1000L`. |
| `PESO NETO` | `netWeight` | Informativo. En kg. |
| `UDS X CAJA` | `unitsPerBox` | Informativo. En Skrit no se usa. |
| `PRECIO FACTURA` | `costPerPack` | **Precio neto por envase individual** (no por litro, no por caja). Es lo que Skrit espera como coste. |

## Casuísticas

- **Sin descuentos en cascada**: Repsol ya da el precio neto final. Una sola columna de precio. Ver comparación con Castrol en su ficha.
- **Muchos productos "no aceite"**: Repsol vende lubricantes automoción/moto, pero también químicos (WIZARD, GUARD, SMARTER, QUALIFIER…) con envases pequeños (100ml, 300ml, 500ml). Todos van en la misma tarifa.
- **Grasas en kilos**: la línea `PROTECTOR ... KG` usa formatos 18KG, 45KG, 180KG. En Skrit se registran como si fueran litros equivalentes (densidad ≈ 1).
- **Casos con inconsistencia detectada**: en la salida Skrit histórica de Yako, 2 refs de grasa 180KG aparecen como `LITROS = 208` en lugar de `180`. Parece error humano previo, no del parser actual.

## Notas de negocio

- Márgenes típicos aplicados por formato (a completar por Yako en próximas sesiones):
  - 1L: ~35%
  - 5L: ~30%
  - 20L / 60L: ~25%
  - 208L / 1000L: ~20%
  - Químicos (ML): ~50%
  - (Valores tentativos — el usuario los ajusta en la UI.)
- Tasas Ecoembes y GENCI: aún no incorporadas. Fase 2.

## Estado en la app

**Implementado en v0.1:**
- Detección automática de la hoja `DATOS` (fallback a `Hoja1` con detección de cabecera).
- Parser de litros del `NOMBRE` con 99,8% de acierto (827/829 refs).
- Grupos de formato detectados: 0,125 L, 0,15 L, 0,25 L, 0,4 L, 0,5 L, 1 L, 4 L, 5 L, 12 L, 18 L, 18 KG, 20 L, 45 KG, 50 L, 60 L, 180 KG, 200 L, 205 L, 208 L, 1000 L (según tarifa).
- Configuración de margen sobre venta por formato.
- Export a Skrit con las 5 columnas + fecha.

**No implementado (pendiente si aparece necesidad):**
- Diferenciación automática entre gama automoción vs. gama industria (hoy todo va junto; Yako puede filtrar por texto).
- Detección de refs descatalogadas.
- Enlace con la política PVP oficial de Repsol para comparar.

## Referencias

- Ejemplo entrada: `EJEMPLOS TARIFAS/REPSOL/Ejemplo Tarifa de ENTRADA Repsol.xlsx`
- Ejemplo salida esperada: `EJEMPLOS TARIFAS/REPSOL/Ejemplo Tarifa de SALIDA Repsol para SKRIT.xlsx`
- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Repsol/Tarifa Repsol Lubricants - 06 mayo 2026.xlsx`
