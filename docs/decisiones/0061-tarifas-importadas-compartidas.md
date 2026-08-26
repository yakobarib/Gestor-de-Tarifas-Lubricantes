# ADR 0061 — Tarifas importadas compartidas en Neon (Fase 1 de 3)

**Fecha:** 2026-08-25
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako le enseñó la app a su jefe desde el ordenador del jefe (mismo login, cuenta de
Yako). Solo el maestro de descripciones/litros (ADR 0054, `verified_descriptions`) vive en
Neon — las tarifas importadas en sí viven solo en IndexedDB de cada navegador. Resultado:
en el ordenador del jefe no había ninguna tarifa importada, así que Reglas/Exportación/
Comparación no tenían nada que mostrar, aunque el login funcionara.

Yako quiere dar acceso de **trabajo completo** a 3 personas más (Albert, Ernesto, Nuria,
añadidos a `allowed_emails`): importar tarifas, ajustar márgenes y exportar cada uno desde
su propio ordenador, viendo siempre lo mismo que los demás. Se aborda por fases — esta es
la Fase 1 (tarifas importadas), la más urgente porque bloquea a las otras dos (reglas de
márgenes, equivalencias — pendientes, ver plan). Plan completo en
`C:\Users\RIB\.claude\plans\playful-crafting-snail.md`.

## Decisión

Nueva tabla `imported_tariff_rows` en Neon — solo los campos que **no** vienen ya de
`verified_descriptions`/`MasterCache` (evita duplicar descripción/litros verificados en dos
tablas): `description_raw`, `description_export`, `liters`, `format_key`,
`liters_detected`, `fam`, y los tres niveles de coste con su fecha
(`cost_factura[_imported_at]`, `cost_neto_neto[_imported_at]`,
`cost_triple_neto[_imported_at]`). Clave primaria `(brand_id, gama, ref)`, misma RLS de
lista blanca que `verified_descriptions` (reutiliza `allowed_emails`).

`js/core/neon-tariffs.js` (nuevo, mismo patrón que `neon-master.js`): `fetchAll()`
paginado, y `upsert`/`upsertBatch`/`upsertMany` — todos PARCIALES a propósito (solo se
manda la columna que de verdad cambia). El Data API solo toca en el `UPDATE` las columnas
presentes en el cuerpo del upsert; las omitidas quedan intactas — así una importación de
"solo triple-neto" (AD Parts, fichero aparte) no anula `cost_factura` ya guardado en Neon,
replicando en remoto el mismo merge por campo que `MasterDB.putRows()` ya hacía en local.
`upsertMany` agrupa por el conjunto exacto de columnas presentes (necesario: un upsert en
lote de PostgREST usa una sola lista de columnas para todo el lote) y trocea en tandas de
500 filas.

`db.js`'s `putRows()` sigue escribiendo en IndexedDB exactamente igual que antes — **cero
cambios de firma o comportamiento para los 5 módulos que lo consumen**
(`screen-tarifas.js`, `screen-rules.js`, `screen-compare.js`, `screen-export.js`,
`migration.js`) — y además empuja a Neon, por fila, solo los campos que esa fila trae de
verdad (`r.description`/`r.liters`/... `!= null`). Importante: la pasada de
`Migration.applyMasterDescriptions()` (recalcula descripción/litros contra el maestro en
CADA arranque, para toda fila ya importada) llama a `putRows` con filas esqueleto
(`{ref}` nada más) — con este filtro por `!= null`, esa pasada no empuja nada a Neon (no
hay nada nuevo que decir), evitando que cada arranque corrompiera `liters`/`format_key`/
`fam` de todo el catálogo compartido con `null`.

Nueva `MasterDB.hydrateFromNeon(rows)` vuelca en IndexedDB, al arrancar, lo que
`NeonTariffs.fetchAll()` traiga — se llama en `app.js`'s `finishBoot()`, antes de
`Migration.run()`, para que su `applyMasterDescriptions()` recalcule descripción/litros/
`descVerified` de esas filas recién llegadas contra el maestro ya calentado (no hace falta
que `hydrateFromNeon` acierte esos tres campos, se recalculan justo después).

Migración de una sola vez (`Migration.pushLocalTariffsToNeonOnce`, flag
`migrated_v6_push_local_tariffs_to_neon`): sube lo que Yako ya tuviera importado SOLO en su
ordenador antes de que existiera esta tabla — sin esto, Albert/Ernesto/Nuria arrancarían
con las tarifas vacías igual la primera vez. Se llama ANTES de `hydrateFromNeon`, para no
pisar estas filas locales con un Neon aún vacío la primera vez que esto se despliega. Si
falla (sin red), no marca el flag — se reintenta en el siguiente arranque.

Push a Neon: si falla, **no bloquea el import** (ya quedó guardado en local, se ve en
pantalla) — solo avisa con un toast no bloqueante. Distinto del guardado de una validación
en Tarifas (ADR 0054), que si falla sí bloquea — aquí el dato local ya es válido por sí
mismo, lo único que puede fallar es que tarde en llegar a los demás.

**Fuera de alcance de esta fase** (documentado, no un descuido): dos dispositivos
importando la misma marca/gama en la misma ventana de minutos pueden pisarse entre sí
(mismo recorte ya aceptado para el maestro de descripciones en ADR 0054 — se resuelve con
el próximo arranque); tampoco hay borrado de refs que desaparecieron de la última tarifa
(ya era así antes de este cambio).

## Ficheros

**Crear:** `js/core/neon-tariffs.js`.
**Modificar:** `app/index.html` (script tag), `js/core/db.js` (push en `putRows` +
`hydrateFromNeon`), `js/app.js` (hidratar en `finishBoot`), `js/core/migration.js`
(`pushLocalTariffsToNeonOnce`), `Archivo Maestro/_sql_carga_neon/schema_imported_tariff_rows.sql`
(nuevo, DDL de la tabla + trigger + RLS, para pegar en el SQL Editor de Neon).
**Sin cambios:** `screen-tarifas.js`, `screen-rules.js`, `screen-compare.js`,
`screen-export.js`, todos los `profiles/*.js`.

## Verificación

- `node --check` sobre los ficheros nuevos/modificados.
- **Pendiente de Yako**: pegar `schema_imported_tariff_rows.sql` en el SQL Editor de Neon
  (crea la tabla, aún no existe). Sin la tabla, `NeonTariffs.fetchAll()`/`upsert*` fallan y
  el import sigue funcionando solo en local (degradado, como está diseñado) — pero no hay
  nada que sincronizar todavía.
- **No verificado en vivo por mí** (sin acceso directo a Neon en esta sesión — CLI
  instalada pero sin cuenta enlazada, ver nota de tooling en el plan): que
  `client.from(TABLE).upsert(arrayDeObjetos)` del SDK acepte de verdad un array para
  upsert en lote (`upsertBatch`/`upsertMany`), y que el merge parcial por columna se
  comporte como se espera en un upsert en lote (no solo en uno de una fila, que es lo único
  que `NeonMaster.upsert` ya usaba). Primer punto real a probar en cuanto la tabla exista:
  importar una tarifa real y confirmar en Neon que se guardó bien, ANTES de dar por buena
  esta fase.
- Importar una tarifa real; confirmar en Neon que aparecen las filas. Desde una segunda
  cuenta o perfil de navegador, recargar sin importar nada — deben verse esas mismas filas.
- Importar el fichero de triple-neto de AD Parts: confirmar que NO borra `cost_factura` de
  las filas ya existentes en Neon, y que solo se tocó `cost_triple_neto`.
- Confirmar que `migrated_v6_push_local_tariffs_to_neon` sube el catálogo de Yako una sola
  vez (recargar dos veces seguidas no debe duplicar trabajo la segunda).

## Referencias

- ADR 0054 (maestro compartido en Neon — patrón replicado aquí).
- Plan completo (Fases 1/2/3): `C:\Users\RIB\.claude\plans\playful-crafting-snail.md`.
- `js/core/neon-tariffs.js`, `js/core/db.js`, `js/app.js`, `js/core/migration.js`.
