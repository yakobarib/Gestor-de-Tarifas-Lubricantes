# ADR 0019 — Perfil Castrol: cascada de descuentos y colisión de detección entre proveedores

**Fecha:** 2026-08-03
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Sexto y último proveedor del roadmap inicial. Yako aportó un fichero más reciente que el
que existía documentado (`Tarifa Julio 2026 - Formato Castrol y neto neto.xlsx`, hoja
`TARIFA JUNIO` + una hoja `DATOS` creada a mano por él) y explicó columna a columna la
cascada completa de descuentos (Pronto Pago → Dto Logístico → Precio Unitario "tarifa" →
Rapel fin de año → 5 aportaciones en céntimos/litro → Precio Neto Neto con todas las
aportaciones), pidiendo quedarse solo con: referencia, descripción limpia, litros por
envase (no por unidad de compra), precio tarifa por envase (`costFactura`) y precio
neto-neto por envase (`costTripleNeto`).

## Decisión: precio por litro × litros, igual que Shell

La columna `O` ("Precio Unitario") es €/litro, no €/envase — igual que Shell (ADR 0018).
`costPerPack = precioUnitarioLitro × liters`. La columna `Z` ("Precio Neto Neto envase con
todas aportaciones YAKO") ya viene calculada por envase por el propio Yako, se usa tal
cual como `costTripleNeto`. Verificado con la cascada real fila a fila (`O = J×(1-N)`,
`Q = O×(1-P)`, `W = Q − ΣR..V`, `Z = W×F`) contra varios ejemplos del fichero real.

## Descripción: limpieza de ruido de packaging

`Descripción de Material` mezcla el nombre comercial con unidad de venta y códigos de
almacén en el mismo campo, sin un separador uniforme (`"Brake Fluid DOT 4 (C), 12X1L H
Q3"`, `"EDGE 0W-20 LL IV, 4X5L H 4A"`). Se toma el texto antes de la primera coma, se
quita cualquier paréntesis final, se normaliza la viscosidad (`0W-20` → `0W20`) y se
añade el sufijo de litros propio de la app — dando `"Brake Fluid DOT 4 1L"` y `"EDGE
0W20 LL IV 5L"` exactamente como pidió Yako.

## Litros: tabla kg→L propia de Castrol

Los envases en Kg se convierten con `{0.4: 0.4 (→ 400ML), 18: 20, 25: 25, 180: 208}` —
confirmado por Yako (bidones de 208L en esta marca, igual que Repsol; 25kg = 25L, envase
de grasa `CAT15EEF3`/`CAT15A3DA` "CLS Grease"). El 25kg se detectó primero como caso sin
resolver (esas 2 filas se descartaban silenciosamente del import) y se cerró el mismo día
al confirmar Yako el volumen — ver CHANGELOG v0.9.4.

## "Sustituye a": duplicar salvo placeholder "NUEVO"

Yako pidió duplicar la fila bajo la referencia antigua (columna `X`, "Sustituye a") para
no romper stock/Turfview a fin de mes. Primera implementación trataba cualquier valor no
vacío como una ref antigua real, pero 26 de 104 valores no vacíos son literalmente el
texto `"NUEVO"` (placeholder de "producto nuevo, no sustituye nada"), lo que colisionaba
28 filas de Vecton bajo la ref fabricada `CATNUEVO`. Se excluye explícitamente
`oldRef.toUpperCase() === 'NUEVO'` de la duplicación.

## Bug de detección: colisión con Repsol y Shell por convenciones de hoja/columna compartidas

Al probar en el navegador (no solo con el harness de Node), `ExcelReader.read()` clasificó
el fichero real de Castrol como **Repsol** primero, y tras corregir eso, como **Shell**:

- El `detect()` de Repsol aceptaba *cualquier* fichero con una hoja llamada `DATOS`
  (ADR 0013 documenta que esa hoja es una convención manual de Yako, no del proveedor) —
  pero Castrol **también** trae una hoja `DATOS` creada por Yako de la misma manera.
  Corregido: `detect()` de Repsol ahora exige además que esa hoja tenga la cabecera real
  de Repsol (`PRECIO FACTURA` + columna de ref + columna de nombre en las primeras 10
  filas), reutilizando la misma lógica de búsqueda de cabecera que `readRepsol`.
- El `detect()` de Shell aceptaba cualquier primera hoja con columnas `MATERIAL` y `GAMA`
  — pero la hoja `TARIFA JUNIO` de Castrol también tiene columnas `Material` y `Gama`
  (misma convención de nombres). Corregido: se descarta si la cabecera contiene además
  `PRONTO PAGO` (columna exclusiva de Castrol).

Ninguno de los dos bugs aparecía en el harness de Node porque ese harness invoca
directamente `readCastrol()`, sin pasar por el `ExcelReader.read()` con auto-detección de
perfil — **lección repetida ya en Racing Oil (gamas TRANSMISIÓN/INDUSTRIA)**: el harness
de Node valida el parser, pero solo la prueba en navegador contra `ExcelReader.read()`
con el fichero real detecta colisiones de `detect()` entre proveedores. Se mantiene la
verificación en navegador como paso obligatorio, no opcional, en el flujo de cada
proveedor nuevo.

## Consecuencias

- `js/profiles/profile-castrol.js`: perfil nuevo.
- `js/profiles/profile-repsol.js`: `detect()` ahora verifica cabecera real, no solo
  nombre de hoja.
- `js/profiles/profile-shell.js`: `detect()` ahora excluye cabeceras con "PRONTO PAGO".
- `BRANDS.castrol` pasa de `pending: true` a `false`, con 9 gamas reales y
  `refPrefix: 'CAT'`; `EQUIV_BRAND_ALIASES['CASTROL']` apunta a `castrol:edge`.
- Probado contra la tarifa real de julio 2026: 449 filas, 9 gamas, 0 duplicados, import →
  MasterDB → Exportación (Skrit V2 y listado Neto-Neto) verificado en navegador.

## Referencias

- `js/profiles/profile-castrol.js`, `js/profiles/profile-repsol.js`,
  `js/profiles/profile-shell.js`.
- [docs/proveedores/castrol.md](../proveedores/castrol.md)
- ADR 0013 (hoja `DATOS` de Repsol), ADR 0018 (perfil Shell).
