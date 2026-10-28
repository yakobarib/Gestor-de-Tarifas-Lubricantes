# ADR 0087 — Tarjetas de Importación: mini-tabla Tarifa | Refs | Fecha

**Fecha:** 2026-10-28
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Cada tarjeta de marca en Importación mostraba el estado de cada tarifa en UNA línea de texto
(`Normal: 239 refs · 24/09/26`, `Tarifa general: 864 refs · 21/09/…`). Con 6 tarjetas de ancho
(~245 px), esa línea solo cabía entera en AD Parts; en el resto el texto se cortaba con
puntos suspensivos y se perdía justo la fecha de la última tarifa, que es lo que más
interesa de un vistazo. Yako pidió reformatearlo para que fuera legible, manteniendo las 6
tarjetas de ancho y todas del mismo alto, y sugirió cambiar "Tarifa general" por "General".

## Decisión

Cada gama pasa a ser una fila de una mini-tabla con columnas fijas, con cabecera común
(TARIFA / REFS / FECHA) en todas las tarjetas, para que se lean alineadas:

- **Tarifa**: nombre de la gama (Normal, Standard, Sport Car, Químicos…) o **"General"**
  para las marcas cuyas gamas llegan juntas en un mismo Excel (suma de refs y fecha más
  reciente de todas ellas).
- **Refs**: número de referencias, con separador de miles.
- **Fecha**: fecha de la tarifa (la del propio fichero si la trae, si no la de importación),
  en verde y negrita, columna de ancho fijo (4,2 rem) — nunca se recorta.
- Una gama sin importar sale como "sin importar" en gris; la fecha de importación real
  queda en el tooltip de la fila ("Importada el …").

**Mismo alto en las 6**: la rejilla estira todas las tarjetas al alto de la más alta
(`align-items: stretch`) y la zona de arrastre se ancla al borde inferior
(`margin-top: auto`, tarjeta flex-column); además `min-height: 258px` deja sitio de sobra
para AD Parts (4 gamas). Si una marca gana gamas, el resto crece con ella aunque le sobre
aire — lo que pidió Yako.

Archivos: `screen-import.js` (`renderBrandCards`), `styles.css` (`.tariff-table`,
`.tariff-row`).

## Verificación

Renderizando las tarjetas con el `renderBrandCards` real y datos como los de la captura de
Yako (incluido un caso extremo de 1.805 refs), en tema oscuro y claro, a 1650 px: fechas
completas en las 6, columnas alineadas, mismo alto, nada recortado. No probado con la app
real (requiere login).

## Posible mejora (no hecha)

Marcar en ámbar la fecha de las tarifas antiguas (p. ej. > 45 días) para ver de un vistazo
qué marca está desactualizada. Pendiente de que Yako decida si la quiere y con qué umbral.
