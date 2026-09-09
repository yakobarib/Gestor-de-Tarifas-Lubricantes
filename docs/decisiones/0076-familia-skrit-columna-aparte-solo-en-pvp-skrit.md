# ADR 0076 — "Familia Skrit" como columna aparte, solo en PVP (Skrit)

**Fecha:** 2026-09-09
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras ADR 0074/0075 (sustituir la FAMILIA por un código especial en las filas de "Bidones
y Cubas"), Yako reconsideró el diseño y creó un fichero de referencia, `Base de
Conocimiento\Familias\Familias Skrit.xlsx` — una matriz litros × marca (ADP, CAT, REP,
SHE, ENI, RAC) donde va rellenando, formato a formato, qué familia debe salir en Skrit
para cada marca. Por ahora solo tiene relleno los formatos de "Bidones y Cubas"
(185/200/205/208/600/850/1000L, con **Racing Oil incluido esta vez: familia 05**, antes
no la había dado); el resto de litrajes (0.5 a 60L) están vacíos a propósito, pendientes
de que decida el resto de familias más adelante.

Decisión explícita de Yako sobre el diseño: no sustituir la FAMILIA real por la de
Skrit — mejor **las dos, en columnas separadas**, y **solo en el tipo de exportación
"PVP (Skrit)"** — en el resto (PVP Datos incluido) no debe aparecer la columna nueva ni
cambiar el comportamiento de FAMILIA.

## Decisión

`excel-writer.js`: se retira `exportFamilia`/`BIDONES_CUBAS_FAM_BY_ABBR` (el override de
ADR 0074) y se sustituye por `FAMILIA_SKRIT` (tabla `brandAbbr` → litros exactos →
familia Skrit, transcrita a mano del Excel de Yako — sin fila para un litraje sin decidir
todavía) y `familiaSkritFor(brandAbbr, liters)`, que devuelve `''` si esa marca o ese
litraje concreto no tiene entrada. El Excel de Yako usa "SHE" para Shell; la tabla se
guarda con `SHL`, el `brandAbbr` real de la app — anotado en el comentario para no
perder ese detalle en la próxima actualización del fichero.

`exportSkritLean` (la función que usa "PVP (Skrit)") gana una columna nueva "FAMILIA
SKRIT" justo después de "FAMILIA" (que vuelve a ser siempre la real, sin excepción) y
antes de "BIDONES Y CUBAS" (columna que no cambia — sigue siendo el interruptor "PVP Neto
en Bidones y Cubas" de Reglas, un concepto independiente de "Familia Skrit": una fila
puede tener familia Skrit decidida sin estar marcada como Bidones y Cubas para precio, o
viceversa, aunque hoy coincidan en los mismos litrajes).

`exportSkritV2` (la función que usa "PVP (Datos)") vuelve a escribir solo la familia
real, sin ninguna columna nueva — tal cual estaba antes de ADR 0074.

La previsualización en pantalla de "PVP (Skrit)" (`screen-export.js`) se actualiza igual:
FAMILIA vuelve a mostrar la real, y se añade una celda "Familia Skrit" nueva, reusando
`ExcelWriter.familiaSkritFor` (expuesto en la interfaz pública del módulo) para no
duplicar la tabla en dos sitios.

**Nota para el mantenimiento futuro**: como Yako irá mandando versiones nuevas de
`Familias Skrit.xlsx` a medida que decida más familias, `FAMILIA_SKRIT` hay que
actualizarla a mano cada vez (no hay import automático de este fichero todavía — dataset
pequeño, decidido célula a célula por Yako, no una tarifa masiva). Si en algún momento
crece mucho o cambia con frecuencia, valdría la pena moverlo a Neon con el mismo patrón
que `pricing_rules`/`verified_descriptions`.

## Verificación

- `node --check` sobre `excel-writer.js` y `screen-export.js`.
- Probado `familiaSkritFor` en aislado: acierta los 7 litrajes decididos de las 6 marcas,
  devuelve vacío para litrajes sin decidir (ej. 5L) y para una marca no reconocida.

## Referencias

- ADR 0074/0075 (diseño anterior, sustituido por este).
- `Base de Conocimiento/Familias/Familias Skrit.xlsx` (fuente de la tabla).
- `js/export/excel-writer.js`, `js/screens/screen-export.js`.
