# ADR 0069 — Exportación: desplegable de tipos ordenado alfabéticamente, "PVP (Ventas)" → "PVP (Datos)"

**Fecha:** 2026-08-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Dos peticiones rápidas de Yako sobre el desplegable "Tipo de exportación" de la pantalla
Exportación:

1. Renombrar la opción "PVP (Ventas)" (vista rica editable, con margen/beneficio) a **"PVP
   (Datos)"** — nombre más claro de lo que realmente es (una vista de trabajo con todos
   los datos, no una lista de venta).
2. Ordenar todas las opciones del desplegable alfabéticamente, en vez del orden manual
   (histórico: niveles PVP primero, luego Netos Bonus, luego los listados "de Compra").

## Decisión

`screen-export.js` (`renderExportOptions`): en vez de concatenar cadenas HTML ya
ordenadas a mano, se construye un array de `{value, label}` (niveles PVP/Netos Bonus,
listados de compra, "Valor Regalo 1+1" condicional) y se ordena con
`entries.sort((a, b) => a.label.localeCompare(b.label, 'es'))` antes de generar las
`<option>`. Así el desplegable se reordena solo si en el futuro se añade o renombra algún
tipo de exportación, sin tocar este código de nuevo.

Solo se cambia la etiqueta visible del desplegable (`'PVP (Ventas)'` → `'PVP (Datos)'`) —
`EXPORT_FILE_TYPE_LABELS['level:pvp']` (usada para el nombre del fichero exportado, no
para el desplegable) se deja igual, no se pidió cambiarla.

## Verificación

- `node --check` sobre `screen-export.js`.
- Simulado el `sort` con las etiquetas reales de una marca con Netos Bonus + "Valor Regalo
  1+1" activo: resultado — Neto Factura (Compra), Neto-Neto (Compra), Netos Bonus (uso
  interno), PVP (Bonus), PVP (Datos), PVP (Imprimir), PVP (Skrit), Triple Neto (Compra),
  Valor Regalo 1+1 (Compra) — orden alfabético correcto.

## Referencias

- ADR 0066 (batch anterior de detalles de exportación/comparación).
- `js/screens/screen-export.js`.
