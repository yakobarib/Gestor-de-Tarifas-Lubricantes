# ADR 0029 — Repsol: neto-neto/triple-neto también por caja; quitar carga de equivalencias duplicada en Comparación

**Fecha:** 2026-08-11
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako detectó, comparando Repsol en la pantalla Comparación, que el orden esperado
Factura ≥ Neto-Neto ≥ Triple Neto no se cumplía: para `RPP1042QFB` (GIANT 7530 15W-40,
envase de 5 unidades de 5L) salía Factura 15,98€, Neto-Neto **70,62€** y Triple Neto
**66,12€** — muy por encima de la factura, imposible.

## Causa

`profile-repsol.js` ya divide `PRECIO FACTURA` entre `UDS X CAJA` para obtener el coste
por envase individual (`costPerPack`), con el comentario explícito "Repsol factura por
CAJA, no por envase". Pero las columnas de neto-neto/triple-neto (`PRECIO NETO CAJA/
ENVASE` y `PRECIO NETO NETO CAJA/ENVASE`, ver ADR 0010) se leían **sin esa misma
división**, bajo el supuesto (nunca verificado con un envase de más de 1 unidad) de que
"ya vienen por envase en la propia hoja".

Inspeccionando el Excel real (`Tarifa Repsol Lubricants 1 agosto 2026 (con
aportaciones).xlsx`, fila `RPP1042QFB`): `PRECIO NETO CAJA/ENVASE = 70,6196…` = `PRECIO
NETO LITRO (2,8248…) × 25` — 25 son los litros de la CAJA completa (5 uds. × 5L), no de
un envase suelto. Es decir, esa columna está al mismo nivel que `PRECIO FACTURA`: por
caja, no por envase — exactamente lo que ya se sabía y dividía para la factura, pero no
para estas dos columnas. El control de la propia ADR 0010 (`RPG300BCAB`) no detectó el
fallo porque su `UDS X CAJA = 1` (envase suelto) — dividir entre 1 no cambia nada, así
que el bug quedó oculto hasta un producto con caja de varias unidades.

## Decisión

`profile-repsol.js` divide `netoNetoVal`/`tripleNetoVal` entre `unitsPerBox`, igual que
`costPerPack`. Verificado en navegador tras el fix, importando la misma tarifa real:
- `RPP1042QFB` (caja de 5): Factura 15,98€ → Neto-Neto 14,12€ → Triple Neto 13,22€
  (orden correcto).
- `RPG300BCAB` (caja de 1, control de la ADR 0010): sin cambios — Factura 7.837,65€,
  Neto-Neto 7.196,63€, Triple Neto 7.025,87€, idéntico a lo ya verificado entonces.

## Decisión 2 — Quitar la carga de equivalencias duplicada de Comparación

Desde el ADR 0025, Importación ya tiene su propia zona para cargar los 5 Excel de
equivalencias entre marcas — la de Comparación (`#btnLoadKb`/`#kbFileInput`, ambas
apuntando al mismo índice `EquivalenceIndex` compartido) quedó redundante y ocupando
espacio. Se retira de Comparación; el aviso de "sin base de conocimiento cargada" al
buscar ahora indica explícitamente que se carga desde Importación.

## Sobre AD Parts sin coste neto/triple neto en Comparación

Yako preguntó por qué AD Parts no muestra ningún coste neto en Comparación: no es un
bug — `profile-ad-parts-aceite.js` nunca ha leído columnas de neto-neto/triple-neto (solo
Repsol y Castrol las soportan hoy). Existe un fichero de ejemplo
(`EJEMPLOS TARIFAS/ADP/…triple neto.xlsx`) pero su formato es distinto al de la tarifa
normal (solo ref + dos columnas de importe mensual "Triple-neto" para comparar variación
mes a mes, sin las columnas de litros/formato que usa el resto del perfil) — no está claro
todavía si es una tarifa real importable o un informe de otro tipo; queda pendiente
aclarar con Yako antes de construir soporte para ella.

## Consecuencias

- `js/profiles/profile-repsol.js`: `netoNetoVal`/`tripleNetoVal` divididos por
  `unitsPerBox`.
- `app/index.html` / `js/screens/screen-compare.js`: se retira el artículo "Base de
  conocimiento de equivalencias" (y `renderKbStatus`/`handleKbFiles`/sus listeners) de
  Comparación.

## Referencias

- `js/profiles/profile-repsol.js`, `js/screens/screen-compare.js`.
- [ADR 0010](0010-triple-neto-repsol.md) (diseño original, control ahora ampliado),
  [ADR 0025](0025-cruces-de-referencias-en-importacion.md) (carga de equivalencias en
  Importación).
