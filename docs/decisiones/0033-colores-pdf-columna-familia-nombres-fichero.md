# ADR 0033 — Color de marca en el PDF, columna Familia en "PVP (Skrit)" y nombres de fichero diferenciados

**Fecha:** 2026-08-13
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tres ajustes tras el ADR 0032:

1. La cabecera del PDF "PVP (Imprimir)" usaba `brand.color` (el mismo color de la
   tarjeta de marca en Importación), que no coincidía con los colores reales de marca
   que quería Yako para esta salida en concreto.
2. La previsualización en pantalla de "PVP (Skrit)" no mostraba la columna Familia (sí
   se exportaba al Excel, ver ADR 0032, pero faltaba en la tabla de pantalla — rompía el
   WYSIWYG del ADR 0023).
3. "PVP (Venta)" y "PVP (Skrit)" generaban nombres de fichero casi idénticos
   (`tarifa-skrit-adp-pvp-...` vs `pvp-skrit-adp-...`) — fácil confundirlos en una
   carpeta de descargas.

## Decisión 1 — Colores de cabecera del PDF, específicos de esta salida

Se añade `HEADER_COLOR_BY_BRAND` en `pdf-writer.js` — **no** se toca `brand.color` (usado
en otras partes de la UI, ej. la tarjeta de Importación): Yako pidió el color
explícitamente "para la selección PVP (Imprimir)", no un rebranding general de la app.

| Marca | Color |
|---|---|
| AD Parts | `#3b82f6` azul AD |
| Repsol | `#f97316` naranja Repsol |
| Shell | `#eab308` amarillo Shell |
| Eni Live | `#38bdf8` azul claro Eni Live |
| Racing Oil | `#6b7280` gris medio |
| Castrol (no mencionado) | cae a `brand.color` de siempre (`#8b5cf6`, sin cambios) |

## Decisión 2 — Familia también en pantalla, mismo orden en Excel y PDF

`renderPreviewTable()` (`kind === 'skrit'`) añade la columna Familia. Orden final, igual
en pantalla y en `exportSkritLean`: Marca, Referencia, Producto/Descripción, Litros,
Familia, Coste compra, PVP.

## Decisión 3 — Nombres de fichero: "venta" vs "pvp", ambos bajo "tarifa-skrit-"

- **PVP (Venta)** (`exportSkritV2`, nivel "pvp"): `tarifa-skrit-{marca}-venta-{fecha}.xlsx`
  — antes usaba el id del nivel tal cual (`pvp`), indistinguible de "PVP (Skrit)".
- **PVP (Skrit)** (`exportSkritLean`): `tarifa-skrit-{marca}-pvp-{fecha}.xlsx` — antes
  `pvp-skrit-{marca}-{fecha}.xlsx`. Los dos comparten ahora el mismo prefijo
  `tarifa-skrit-` (es el mismo formato de 9/7 columnas tipo Skrit); solo cambia el
  sufijo (`venta` vs `pvp`), que es la única diferencia real entre ambos exports.
- Netos Bonus (también `exportSkritV2`) no se toca — su slug (`netos_bonus`) ya era
  suficientemente distinto, no hacía falta ningún alias.

## Verificación

AD Parts (302 refs): "PVP (Skrit)" — pantalla y Excel muestran las 7 columnas en el
mismo orden, `.xlsx` exportado como `tarifa-skrit-adp-pvp-2026-08-13.xlsx`; "PVP (Venta)"
exportado como `tarifa-skrit-adp-venta-2026-08-13.xlsx` — nombres ya distintos a simple
vista. PDF probado con las 6 marcas (interceptando `headStyles.fillColor` de
`autoTable`): cada una sale con su color pedido; Castrol mantiene el suyo de siempre.

## Consecuencias

- `js/export/pdf-writer.js`: `HEADER_COLOR_BY_BRAND`.
- `js/export/excel-writer.js`: alias `pvp` → `venta` en `exportSkritV2`; orden de
  columnas y nombre de fichero de `exportSkritLean`.
- `js/screens/screen-export.js`: columna Familia en la previsualización de "PVP
  (Skrit)".

## Referencias

- `js/export/pdf-writer.js`, `js/export/excel-writer.js`, `js/screens/screen-export.js`.
- [ADR 0032](0032-excel-negrita-columnas-boton-exportar.md).
