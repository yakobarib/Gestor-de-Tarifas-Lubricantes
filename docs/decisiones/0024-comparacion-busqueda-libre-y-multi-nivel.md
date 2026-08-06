# ADR 0024 — Comparación: búsqueda libre, coste/PVP multinivel, y fix de "sin tarifa importada"

**Fecha:** 2026-08-06
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Con las 6 marcas y la base de conocimiento de equivalencias cargadas, Yako reportó que
Comparación daba "sin tarifa importada" para Eni Live, Shell y Castrol al comparar
`ADP32005`, cuando en realidad las 6 marcas estaban importadas — y pidió además: una
casilla de búsqueda directa (con o sin prefijo de marca) antes de la cascada de selects,
mostrar el coste factura/neto-neto/triple neto disponibles (no solo uno) y los PVP(s)
resultantes de Reglas (no solo "pvp"), y reflejar "en otros formatos" cuando una marca
tiene el producto pero no en ese tamaño.

## El bug real: `EQUIV_BRAND_ALIASES` fija una gama por marca que no siempre es real

`EQUIV_BRAND_ALIASES` mapea cada "brandKey" del Excel de equivalencias (ej. `'ENI'`) a
un `brandId:gama` fijo (`'eni:i-sint'`). Esa gama solo importa de verdad para **AD
Parts** (el Excel distingue "AD PARTS" de "AD STANDARD" como columnas distintas — sí hay
dos brandKeys reales). Para el resto de marcas (Eni Live, Shell, Castrol, Racing Oil,
Repsol) solo existe UN brandKey en el Excel, y la gama del alias es orientativa, no una
restricción real del fichero de equivalencias — el producto de un grupo concreto puede
vivir en cualquier gama real de esa marca. El código antiguo, sin embargo, buscaba el
miembro con `MasterDB.getByRef(mBrandId, GAMA_FIJA_DEL_ALIAS, ref)`: si esa ref
concreta vivía en otra gama de la misma marca (lo normal), la búsqueda fallaba y se
reportaba "sin tarifa importada" aunque la marca sí tuviera datos.

**Corregido con un fallback**: se busca primero en la gama declarada del alias (rápido),
y si no se encuentra, se busca en TODAS las gamas de esa marca
(`MasterDB.getByBrand(brandId, null)`) antes de concluir que falta. Mismo fallback aplica
a la dirección inversa (de qué grupo es una ref recién encontrada): `brandKeyForRow`
prueba primero un alias con gama exacta y, si no hay, usa el único brandKey disponible
para esa marca sin exigir coincidencia de gama.

## Búsqueda libre de referencia

Nueva casilla de texto sobre la cascada de selects. Acepta la ref tal cual (sirve para
marcas sin prefijo) o sin el prefijo de marca (ej. `32005` para AD Parts, que internamente
guarda `ADP32005`): primero busca la ref exacta en TODO el maestro (todas las marcas,
todas las gamas), y si no la encuentra, prueba `prefijo + ref` para cada marca que tenga
uno (AD Parts, Castrol). La cascada de selects se mantiene como alternativa para
explorar sin conocer la ref exacta — ambas rutas llaman a la misma función de
renderizado, así que dan siempre el mismo resultado.

## Coste y PVP multinivel

- **Coste**: se muestran todos los que existan para esa fila (`costFactura`,
  `costNetoNeto`, `costTripleNeto`) como chips, en vez de una sola columna "COSTE" fija a
  factura.
- **PVP**: se muestran TODOS los niveles con `goesToSkrit` de esa marca/gama (PVP,
  Bidones y Cubas Neto, Netos Bonus…), cada uno con su etiqueta — antes solo se calculaba
  el nivel `"pvp"`.
- El layout de cada marca miembro pasa de un grid rígido de 4 columnas a una tarjeta que
  envuelve sus propios chips (`.compare-member`), porque el número de costes y de PVPs
  varía de una marca a otra.

## "En otros formatos" ya no se descarta

`EquivalenceReader` trataba `EN OTROS FORMATOS` igual que `SIN EQUIVALENCIA`/`SIN
ACTUALIZAR` (se ignoraba, el miembro desaparecía del grupo sin dejar rastro). Se separa:
`SIN EQUIVALENCIA`/`SIN ACTUALIZAR` sí se ignoran (esa marca no tiene nada); `EN OTROS
FORMATOS` se conserva como miembro con `ref: null, note: 'otros_formatos'` — Comparación
lo muestra como aviso ("en otros formatos") en vez de omitir la marca sin explicación.
`EquivalenceIndex.build()` ignora estos miembros sin ref al indexar por ref (no son
buscables, solo se ven al llegar a un grupo por otro miembro).

**Importante**: este fix solo aplica a bases de conocimiento cargadas de nuevo — el
índice ya cacheado en `localStorage` con la lógica antigua seguirá sin distinguir "en
otros formatos" hasta recargar los 5 Excel.

## Consecuencias

- `js/comparison/equivalence-reader.js`: `IGNORED_VALUES` se divide en
  `NO_EQUIVALENCE_VALUES` + `OTHER_FORMATS_VALUE`, aplicado en ambos formatos (spec y
  block).
- `js/comparison/equivalence-index.js`: `build()` ignora miembros con `ref == null` al
  indexar.
- `js/screens/screen-compare.js`: reescrito — `resolveRefAcrossBrands`,
  `findMemberRow` (con fallback a todas las gamas), `brandKeyForRow`/`brandKeysFor`,
  `loadLevelsFor` (todos los niveles `goesToSkrit`, no solo "pvp"), `costChipsHtml`,
  nueva casilla de búsqueda libre.
- CSS: `.compare-member`/`.compare-member-head`/`.compare-member-costs`/
  `.compare-member-pvps` sustituyen al grid rígido `.compare-row`; `.chip.pvp`.
- Probado en navegador con las 6 marcas + los 5 Excel de equivalencias reales: buscar
  `ADP32005` (con prefijo) y `32005` (sin prefijo) dan el mismo resultado correcto, con
  Eni Live/Shell/Castrol/Repsol mostrando ya sus datos reales (antes "sin tarifa
  importada"); un grupo real con Castrol marcado `EN OTROS FORMATOS` en el Excel se
  muestra correctamente como aviso; una ref sin ninguna equivalencia y una marca
  genuinamente sin esa ref siguen dando los mensajes correctos.

## Referencias

- `js/screens/screen-compare.js`, `js/comparison/equivalence-reader.js`,
  `js/comparison/equivalence-index.js`.
- ADR 0008 (diseño original de Comparación y `EQUIV_BRAND_ALIASES`).
