# Krafft

## Estado
- **Versión de app:** ⏳ pendiente auditar
- **Última tarifa disponible:** `Tarifa Krafft Lubricantes - Enero 2026.xlsx`

## Formato de la tarifa entrante

**Pendiente de auditoría.** No hay archivo `EJEMPLOS TARIFAS/KRAFFT/` con entrada/salida de referencia.

Antes de implementar el lector Krafft en la app hace falta:

1. Abrir `TARIFAS ACTUALIZADAS/Krafft/Tarifa Krafft Lubricantes - Enero 2026.xlsx` y documentar:
   - Nº de hojas, sus nombres, uso.
   - Fila de cabecera.
   - Columnas relevantes con sus nombres literales.
   - Precio único o descuentos en cascada.
   - Presencia o no de columna `litros`.
   - Formato de referencia (con prefijo, sin prefijo).
2. Generar una salida Skrit de ejemplo (aunque sea manual) para tener referencia visual.
3. Añadir la ficha completa aquí siguiendo la plantilla común.

## Notas de negocio

- Krafft es proveedor de productos técnicos (lubricantes + químicos industriales + aerosoles).
- Muchos formatos aerosol/spray de tamaño pequeño (400ml, 500ml). Interesa validar que el parser los reconoce.
- Márgenes: pendiente definir.

## Estado en la app

**Sin lector Krafft.** Se planificará junto con Shell en v0.6 tras auditar ambos.

## Referencias

- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Krafft/Tarifa Krafft Lubricantes - Enero 2026.xlsx`
