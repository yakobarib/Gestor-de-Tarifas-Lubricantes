# ADR 0056 — Ninguna marca lleva prefijo en el `ref` interno

**Fecha:** 2026-08-24
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Al recargar el maestro compartido en Neon (ver ADR 0054) para las 6 marcas, Castrol salió
con el 100% de sus referencias "pendientes de validar" — ninguna coincidía. Causa:
`profile-castrol.js` antepone `'CAT' + ref` al importar (igual que `profile-ad-parts-
aceite.js`/`profile-ad-parts-quimico.js` antepone `'ADP'`), pero el Excel maestro de
Castrol tenía los códigos sin ese prefijo. AD Parts no mostraba el mismo problema solo
porque Yako había escrito `ADP` a mano en su Excel — por casualidad, no por diseño.

Yako explica el porqué: los fabricantes mandan sus tarifas **sin ningún prefijo** (para
ellos su propia referencia ya es única); el prefijo por marca es un invento del
**distribuidor** (Recambios Ibiza), solo para no confundir productos entre marcas en
Skrit — y esa distinción ya la hace bien la exportación (`screen-export.js`'s
`exportRef()` separa "MARCA" y "REFERENCIA" en columnas distintas, quitando cualquier
prefijo antes de exportar). El prefijo horneado dentro de `ref` en AD Parts/Castrol es un
resto histórico de cómo se programaron esas dos marcas al principio, no una necesidad
real del sistema — y es justo lo que causó el fallo de Castrol.

## Decisión

**Ninguna marca lleva prefijo en `ref`, ni en el maestro ni internamente — una sola regla
para las 6 marcas, sin excepciones.** El `ref` es siempre el código tal cual lo manda el
fabricante.

- `profile-ad-parts-aceite.js`, `profile-ad-parts-quimico.js`, `profile-castrol.js`: se
  quita el `'ADP' + ref` / `'CAT' + ref` de cada punto donde se construía la fila (incluido
  el `_aliasOf` de Castrol para las referencias "Sustituye a").
- `js/core/brands.js`: se elimina el campo `refPrefix` (ya no lo usa nadie).
- `js/screens/screen-compare.js`: se simplifica `resolveRefAcrossBrands()` (ya no hace
  falta probar con prefijo) y se quita el cálculo de `bareRef`/`prefixedRef` basado en
  `refPrefix` — ahora es siempre el `ref` tal cual.
- Yako limpia los 6 Excel maestro para que ninguno lleve prefijo (afectaba solo a AD
  Parts, que sí lo tenía escrito a mano).

De paso, al limpiar el Excel de AD Parts se detectó que 3 referencias (`20105`, `20205`,
`22505`) habían vuelto a aparecer con la descripción "REFRIGERANTE AD CONCENTRADO
UNIVERSAL OCRE" — contradecía la decisión de la misma sesión de marcarlas inválidas por
no ser productos reales (bajo el nombre genérico "C.A.U.+", ver conversación 2026-08-24).
Confirmado con Yako: siguen sin ser productos reales, se han quitado del Excel maestro.

## Verificación

Cruce de las tarifas reales de origen sigue confirmando exactamente las mismas 3
colisiones de ADR 0055 (`20005`/`22005`/`26005`, ahora sin prefijo). En Neon: 0 filas con
`ref` empezando por `ADP`/`CAT` tras la limpieza; totales correctos por marca (AD Parts
377 = 373 del Excel + 4 marcadas inválidas; Castrol 370). `node --check` sobre los 5
ficheros JS modificados.

## Addendum (2026-08-24) — limpieza automática de filas huérfanas

Al reimportar AD Parts/Castrol tras este cambio, las filas ya guardadas en `MasterDB`
(IndexedDB, en el navegador de cada usuario) con el prefijo antiguo (`CAT.../ADP...`) no
se fusionan con las nuevas (sin prefijo) — `putRows` funde por `id = brandId::gama::ref`,
y al cambiar el `ref` deja de ser la misma clave. Resultado: referencias duplicadas
(doble de filas) en "Todas las gamas" hasta limpiarlas.

Se intentó pedirle a Yako que borrara esas filas a mano desde la consola del navegador,
pero tuvo problemas para pegar/ejecutar el script ahí. En vez de depender de eso, se
añade una migración de una vez más en `migration.js` (`removeStalePrefixedRows`,
flag `migrated_v4_remove_stale_prefixed_refs`) que borra, en el próximo arranque de la
app de cada usuario, cualquier fila de `castrol`/`ad_parts_aceite` cuyo `ref` empiece por
`CAT`/`ADP` — sin que haga falta ninguna acción manual.

## Referencias

- ADR 0054 (maestro compartido en Neon — donde se detectó el fallo de Castrol).
- ADR 0055 (colisión de refs AD Parts aceite/químico — mismos 3 códigos, ahora sin
  prefijo).
- `js/profiles/profile-ad-parts-aceite.js`, `js/profiles/profile-ad-parts-quimico.js`,
  `js/profiles/profile-castrol.js`, `js/core/brands.js`, `js/screens/screen-compare.js`.
