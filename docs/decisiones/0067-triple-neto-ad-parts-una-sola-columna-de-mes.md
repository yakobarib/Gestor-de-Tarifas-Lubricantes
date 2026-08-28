# ADR 0067 — Triple-Neto de AD Parts: reconocer el fichero también con un solo mes

**Fecha:** 2026-08-28
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako detectó que el coste triple-neto de bastantes referencias de AD Parts (124 de 282,
además de 9 de 857 en Repsol por una vía distinta) salía **más alto que el coste de
factura** — algo que nunca debería pasar, el triple-neto es un descuento adicional sobre
factura.

Investigación (sin tocar código, solo lectura y consultas directas a Neon — acceso ya
autorizado, ver memoria `neon_direct_db_access`):

- `profile-ad-parts-triple-neto.js` no hace ningún cálculo sobre el coste: lee el valor de
  la celda del mes más reciente tal cual. `screen-import.js` empareja cada fila por ref
  exacta contra el maestro ya existente, sin ambigüedad posible entre productos.
- El fichero real de Yako en disco (`Triple-neto 08-04-2026.xlsx`, sin editar) **no
  contiene** el valor que aparecía en la app para la referencia de prueba (321000) en
  ninguna de sus columnas ("Abril 2026" ni "Febrero 2026") — descartado por búsqueda
  exhaustiva en las dos hojas del fichero.
- La fecha "25-08-2026" que comparten factura y triple-neto en Neon no prueba que ambos se
  importaran ese día: coincide con la migración de "tarifas compartidas en Neon" (ADR
  0061, Fase 1), que volcó lo que cada referencia ya tenía en local con la fecha de ese
  volcado, no la fecha del import original — el valor "atascado" podía venir de un fichero
  de meses atrás que ya no existe en disco.
- Al pedirle a Yako que volviera a soltar el fichero de abril para forzar la actualización,
  la app respondió "No se reconoce el formato de esta tarifa" (caía al lector genérico de
  tarifas). Yako había **quitado la columna del mes antiguo** del fichero antes de
  soltarlo ("para que la app no se confunda"), dejando una sola hoja ("Hoja1") con una
  sola columna de mes ("Abril 2026").
- `AdPartsTripleNeto.findHeader()` exigía **al menos dos** columnas de mes/año junto a
  "ref" para reconocer la cabecera — diseñado pensando que el fichero siempre trae mes
  actual + uno de referencia anterior. Con una sola columna, `monthCols.length >= 2` nunca
  se cumplía, la detección fallaba y el fichero cae al pipeline de tarifas normales, que
  por supuesto tampoco lo reconoce.

La sospecha inicial de Yako (que la ref con punback, ej. "32.1000", causara el fallo) no
era la causa: `refDigits = String(refRaw).replace(/\./g, '')` ya quita el punto de forma
robusta y no depende de la cabecera — verificado con la misma versión exacta de la
librería que usa la app (`xlsx@0.18.5`) contra el fichero real editado por Yako.

## Decisión

`profile-ad-parts-triple-neto.js` (`findHeader`): bajar el mínimo de columnas de mes/año
requeridas de **2 a 1**. Sigue usando la de mes/año más reciente de las presentes
(`monthCols.sort(...)[0]`), así que un fichero con una sola columna de mes se reconoce y
usa esa columna igual que si trajera varias.

No se toca nada más: `parse()`, la resolución de gama por ref en `screen-import.js` y el
resto de la cascada de import ya funcionaban correctamente — el único fallo real era la
detección de cabecera, demasiado estricta para un caso de uso legítimo (Yako recortando el
fichero antes de importarlo).

## Verificación

- `node --check` sobre `profile-ad-parts-triple-neto.js`.
- Replicado `detect()`/`parse()` con Node y `xlsx@0.18.5` (misma versión que carga la app
  vía CDN) contra el fichero real y editado de Yako
  (`...\COMERCIAL\PRODUCTOS\ACEITES\TARIFAS\2026\AD\4- ABRIL\Triple-neto 08-04-2026.xlsx`,
  una sola hoja, una sola columna de mes): `detect()` devuelve `true`, `parse()` reconoce
  518 filas y la referencia 321000 sale con `costTripleNeto: 1541.373100288` — coincide con
  el valor que Yako confirmó visualmente en el fichero (1.541,37 €), y con el que ya
  esperábamos tras la investigación anterior.
- Pendiente de confirmar por Yako: volver a soltar el fichero en la app y comprobar que
  ahora sí se importa, que la ficha de 321000 pasa a mostrar 1.541,37 € en Triple Neto, y
  que el recuento de anomalías "triple neto > factura" en AD Parts baja tras la
  actualización.

## Referencias

- ADR 0030 (formato original del fichero dedicado de Triple-Neto de AD Parts).
- ADR 0054 / `neon_direct_db_access` (acceso directo a Neon usado para la investigación).
- ADR 0061 (tarifas compartidas en Neon — origen de la fecha "25-08-2026" engañosa).
- `js/profiles/profile-ad-parts-triple-neto.js`, `js/screens/screen-import.js`,
  `js/core/db.js`.
