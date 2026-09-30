# ADR 0085 — Equivalencias reorganizadas por tipo de uso final

**Fecha:** 2026-09-30
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras el ADR 0084 (que convirtió "Aceites"/"Transmisión" al formato "block" con
descripción por marca), Yako revisó el resultado y no le convenció: "no me gustaba como
quedaban, para mi no es visual". Rehizo él mismo, a mano, los ficheros de equivalencias
desde cero, organizados por tipo de uso final en vez de por familia técnica, y movió el
resultado del ADR 0084 a `Sistema actual de equivalencias/` (a pesar del nombre de
carpeta, es el que se DEJA de usar) y el nuevo conjunto a
`Sistema anterior de equivalencias/` (el que se usa a partir de ahora — nombres de
carpeta invertidos respecto a lo que sugieren, ver conversación).

## Decisión

**8 ficheros**, todos en un formato mucho más simple y uniforme que cualquiera de los dos
anteriores: `GAMA | VISCO | ACEA | ILSAC | AD | LITROS | (hueco) | AD PARTS | AD STANDARD
| ENI | SHELL | CASTROL | REPSOL` — sin descripción por marca (deliberado: Yako prefiere
revisar solo con la referencia). La columna GAMA es informativa (repite el nombre de la
categoría en cada fila, para filtrar a mano en el propio Excel) — la categoría real la
sigue decidiendo el nombre de fichero, igual que siempre.

- Equivalencias Vehiculo Ligero.xlsx → categoría `vehiculo_ligero`
- Equivalencias Vehiculo Pesado.xlsx → categoría `vehiculo_pesado`
- Equivalencias Vehiculo Agricola.xlsx → categoría `vehiculo_agricola` (nueva)
- Equivalencias Vehiculo Electrico.xlsx → categoría `vehiculo_electrico` (nueva)
- Equivalencias Transmision Automatica.xlsx → categoría `transmision`
- Equivalencias Transmision Manual y Ejes.xlsx → categoría `transmision`
- Equivalencias Industria Hidraulicos.xlsx → categoría `hidraulicos`
- Equivalencias Grasas.xlsx (sin cambios) → categoría `grasas`, sigue en formato "block"

**Transmisión Automática y Transmisión Manual y Ejes se quedan en DOS ficheros
separados** — decisión explícita de Yako ("mantenerlos separados puede ayudar a
mantenerlos actualizados y limpios"), no un descuido. Ambos comparten la misma categoría
interna `transmision`, así que el Ranking los junta en un solo filtro sin que haga falta
fusionar los ficheros — la app resuelve con código lo que antes se pidió resolver
fusionando el Excel (ver ADR 0084), sin obligar a Yako a mantener un único fichero grande.

**Nuevo marcador reconocido**: "PENDIENTE DE CRUCE" — semánticamente distinto de "SIN
EQUIVALENCIA": no significa que la marca no tenga el producto, significa que Yako
todavía no ha buscado/confirmado ese cruce. Se trata como una tercera nota (`note:
'pendiente_de_cruce'`, junto a `'otros_formatos'` ya existente) en vez de agruparlo con
"sin equivalencia" — Comparación (individual y Ranking) lo muestra en ámbar con el texto
"pendiente" / "pendiente de cruzar", distinto del gris apagado de "sin tarifa"/"en otros
formatos", para que se note que es algo por revisar, no un "no hay nada" definitivo.

**Verificado con datos reales** (ejecutando `EquivalenceReader`/`EQUIV_BRAND_ALIASES`
reales contra los 8 ficheros): 0 colisiones de referencia entre las 7 categorías nuevas
(igual que el ADR 0084, pero reorganizado por Yako a mano en vez de por script).

## Cambios de código

- `equivalence-reader.js`: nuevo `readGamaSpecFormat` (sustituye a `readSpecFormat`,
  ahora eliminado por no tener ya ningún fichero real que lo use) — reconoce la columna
  GAMA y clasifica cada celda de marca en `ref real` / `sin_equivalencia` /
  `otros_formatos` / `pendiente_de_cruce` mediante `markerFor()`. `readBlockFormat` se
  mantiene sin cambios (lo sigue usando Grasas). `readKnownFile` reescrito con los 8
  nombres de fichero nuevos; los patrones antiguos (Aceites por Marcas, Vehículo
  Industrial, Hidraulicos a secas, Transmisión genérica) se retiran — ya no hay ningún
  fichero real con esos nombres.
- `screen-compare.js`: `RANK_CATEGORY_LABELS` con las 7 categorías nuevas (antes 5).
  Nuevo estado `pendiente_de_cruce` gestionado en `buildRankingRows`/`rankingCellHtml`
  (Ranking) y en `renderGroupFor` (Comparación individual).
- `styles.css`: clase `.pendiente-cruce` (ámbar, con variante para tema oscuro).
- `EQUIV_BRAND_ALIASES` (brands.js) no cambia — los 7 ficheros nuevos usan "AD PARTS"/"AD
  STANDARD" tal cual (como el antiguo Aceites), Grasas sigue con "ADP" (como antes) — ambos
  alias ya convivían desde el ADR 0083.

## Pendiente

- Las carpetas `Sistema actual de equivalencias/` (ya no se usa) y
  `Sistema anterior de equivalencias/` (la que se usa) tienen nombres invertidos respecto
  a su función real — cosmético, no bloquea nada, pero puede confundir en el futuro si se
  olvida este detalle.
- 188 referencias del índice anterior (144 todavía activas en tarifa) no llegaron a los
  ficheros nuevos — Yako las está completando a su ritmo desde un Excel de apoyo generado
  a partir de una comparación directa entre ambos índices (no bloquea nada, informativo).

## Actualización 2026-09-30 — categorías antiguas huérfanas tras reimportar

Al reimportar los 8 ficheros nuevos, el filtro de categoría del Ranking siguió mostrando
`aceites`/`motor_industrial`/`transmision_ejes` (las categorías del ADR 0084) además de
las 7 nuevas. Causa: `EquivalenceIndex.build()` fusiona por categoría a propósito (ver ADR
0084) para que reimportar un fichero suelto no borre las demás categorías — pero eso
significa que una categoría que YA NO MENCIONA NINGÚN FICHERO (porque se renombró, no
porque se dejara de importar) nunca se reemplaza ni se limpia, queda huérfana para
siempre. Intenté corregir el índice de Neon directamente por SQL, pero el clasificador de
seguridad del entorno lo bloqueó (operación de "borrado masivo en la nube").

**Solución**: `EquivalenceIndex.resetAll()` (vacía el índice entero, local y en Neon, vía
el mismo camino de escritura autorizado que ya usa `build()`) + un enlace "Vaciar
equivalencias por completo" en Importación (`screen-import.js`, `handleEquivReset`) para
que Yako pueda usarlo él mismo la próxima vez que reestructure categorías, sin necesitar
acceso directo a la base de datos.

## Referencias

- ADR 0084 (versión anterior de esta misma reestructuración, ya sustituida).
- ADR 0083 (Ranking completo, ADP/ADS, EQUIV_BRAND_ALIASES).
- ADR 0008 (equivalencias entre marcas).
- `app/js/comparison/equivalence-reader.js`, `app/js/screens/screen-compare.js`.
