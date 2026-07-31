# ADR 0009 — Mapa de rebranding (ref antigua ↔ nueva)

**Fecha:** 2026-07-29
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

La tarifa Repsol de agosto 2026 (`Tarifa Repsol Lubricants 1 agosto 2026.xlsx`) introdujo
dos columnas nuevas, `SIRDI NUEVO` y `NOMBRE NUEVO`: Repsol está dando nueva imagen a
parte de su catálogo — mismo producto por dentro, nuevo código de referencia (SIRDI) y
nuevo nombre comercial por fuera. De 895 filas con datos, 101 ya traían el par
antiguo+nuevo relleno en la misma fila; el resto (794) seguía sin rebrandear.

Yako confirmó la regla de negocio: **para tarifas nuevas, la referencia antigua deja de
usarse — solo cuenta la nueva** ("obvia las antiguas y quédate con las nuevas, las viejas
ya no se necesitan. En Skrit persistirán pero en las tarifas nuevas desaparecerán").

Esto ya se implementó en `profile-repsol.js` (`readRepsol` usa `SIRDI NUEVO`/`NOMBRE
NUEVO` cuando existen, fila a fila, con fallback a las columnas antiguas). Pero al probarlo
contra la comparativa histórica (History.diff, mayo vs. agosto), los 101 productos
rebrandeados aparecían como alta+baja simultánea (ref antigua "desaparecida", ref nueva
"nueva") — un falso positivo, porque en realidad es el mismo producto continuando.

## Decisión

Se crea un **fichero de equivalencias dedicado**,
`BASE DE CONOCIMIENTO/Equivalencias Rebranding Repsol.xlsx` (columnas `MARCA`,
`SIRDI ANTIGUA`, `NOMBRE ANTIGUO`, `SIRDI NUEVA`, `NOMBRE NUEVO`, `FECHA DETECTADO`),
generado extrayendo automáticamente los 101 pares antiguo↔nuevo directamente de la propia
tarifa de agosto. Se prefirió esto sobre depender solo del cruce presente en la tarifa del
mes porque **persiste el mapeo aunque en el futuro Repsol deje de mandar la columna
antigua** — la tarifa de agosto es la última vez que ambos códigos coexisten en el mismo
fichero para estos 101 productos.

Este mapa es distinto en naturaleza a los 5 ficheros de "Equivalencias" ya existentes (que
cruzan referencias **entre marcas** para la pantalla Comparación, ver ADR 0008): este cruza
referencias **dentro de la misma marca**, a lo largo del tiempo. Se modela con un módulo
propio, `RebrandMap` (`js/core/rebrand-map.js`), en vez de reutilizar
`EquivalenceIndex`.

### Modelo de datos

`RebrandMap` persiste en localStorage, clave `rebrand_map_<supplierId>`:
`[{ oldRef, newRef, oldName, newName }]`. `RebrandMap.readRebrandExcel(workbook)` detecta
cabecera flexible (`MARCA` opcional + columnas que contengan "ANTIGU"/"VIEJ" y "NUEV"),
agrupa por marca (columna `MARCA`) y no asume que el fichero traiga una sola marca —
preparado para si en el futuro se cruzan varios proveedores en un mismo Excel de
rebranding.

### `History.diff` extendido

`History.diff(currentRows, previous, rebrandPairs)` acepta un tercer parámetro opcional.
Cuando una ref actual no se encuentra directamente en el histórico pero es la `newRef` de
un par cuyo `oldRef` sí estaba, la fila se marca `_status: 'stable'` con
`_rebrandedFrom: oldRef`, y esa `oldRef` se excluye de `obsoleteRefs`. Sin `rebrandPairs`
(el caso de todos los demás proveedores hoy), el comportamiento es idéntico al de antes —
cambio aditivo, cero regresión.

### UI

**v0.8.2**: no hay control separado — se soltaba en un botón "Cargar mapa de rebranding…"
propio junto a la cuadrícula de marcas, pero Yako pidió integrarlo en el mismo dropzone de
la tarifa (un solo sitio donde arrastrar cualquier Excel). `handleFiles()` en
`screen-import.js` prueba primero si el fichero soltado tiene la forma de un mapa de
rebranding (`RebrandMap.readRebrandExcel` devuelve algo no vacío); si es así, se guarda con
`RebrandMap.save` por cada marca detectada y se corta ahí — si no, se procesa como tarifa
normal con `ExcelReader.read`. Las filas rebrandeadas muestran un chip "REBRAND" (con
tooltip "Antes: `<oldRef>`") en vez del hueco vacío que ya tenían las estables.

## Verificación

Con el mapa cargado, comparando la tarifa vigente de mayo contra la de agosto: pasa de
**113 nuevas / 92 desaparecidas** (sin mapa) a **35 nuevas / 14 desaparecidas / 816
estables** (con mapa) — las 101 parejas de rebranding dejan de contarse como altas+bajas.
Verificado también que una fila rebrandeada calcula su PVP con normalidad (mismo
`Pricing.compute`, sin tratamiento especial más allá de la clasificación en el diff).

## Consecuencias

### Positivas
- Generalizable a cualquier proveedor futuro que rebrandee productos — el módulo no
  asume nada específico de Repsol.
- El fichero de equivalencias queda como registro histórico consultable, no solo como
  parche de una comparativa puntual.

### Negativas / trade-offs aceptados
- Requiere un paso manual: cargar el fichero de rebranding una vez (no se auto-detecta
  desde la tarifa importada). Aceptable porque el rebranding es un evento poco frecuente,
  no mensual.
- El fichero no se versiona en git (`BASE DE CONOCIMIENTO/*.xlsx` está en `.gitignore`,
  igual que los 5 de equivalencias) — vive solo en local/localStorage de quien lo cargue.

## Referencias

- `js/core/rebrand-map.js`, `js/core/history.js`, `js/profiles/profile-repsol.js`,
  `js/screens/screen-import.js`.
- [ADR 0008](0008-rediseno-4-pantallas.md) — equivalencias entre marcas (distinto caso de uso).
