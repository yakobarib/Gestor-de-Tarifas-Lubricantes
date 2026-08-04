# ADR 0021 — Reglas: "Todas las gamas" por defecto y base de coste según datos reales

**Fecha:** 2026-08-04
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Dos observaciones de Yako sobre la pantalla Reglas:

1. El selector de Gama no tenía opción "Todas" (a diferencia de Tarifas/Exportación, que
   ya la tienen) y por defecto se quedaba en la primera gama suelta — pero "es muy
   probable que se gestionen todas las gamas a la vez", ya que casi siempre se quiere la
   misma política de margen para toda la marca, no gama a gama.
2. El selector "Base de coste" de un nivel siempre mostraba las 3 opciones fijas (factura
   / neto-neto / triple neto) sin importar si esa marca/gama realmente tenía esos datos.
   Racing Oil y Eni Live solo traen factura (Eni Live siempre coge la columna más barata
   y la guarda como factura); Repsol/Castrol pueden tener también neto-neto o triple
   neto. Elegir una base sin datos reales para esa marca daría "sin coste" en todas las
   filas, sin ningún aviso de por qué.

## Decisión 1: "Todas las gamas" primera y por defecto, con guardado en difusión

Igual patrón que Tarifas/Exportación (ver ADR 0020): la opción "Todas las gamas" aparece
primero y queda seleccionada por defecto al cambiar de marca. La diferencia con esas dos
pantallas es que aquí "Todas" no es solo una vista de lectura — Reglas EDITA, así que
"Todas" tiene que decidir qué pasa al guardar:

- **Lectura** (`loadConfig`): con "Todas" seleccionada, se usa la config de la PRIMERA
  gama real como representante para mostrar los niveles.
- **Escritura** (`saveConfig`): con "Todas" seleccionada, cualquier cambio se DIFUNDE a
  la config de CADA gama real de la marca — no solo a la representante. Es una decisión
  deliberada de "la última edición manda para todas", coherente con "se gestionan todas
  las gamas a la vez": si dos gamas tenían márgenes distintos y se edita algo con "Todas"
  seleccionada, las dos quedan iguales a partir de ese momento. Para mantener un margen
  distinto en una gama concreta, hay que seleccionarla suelta en el desplegable — se
  documenta con un `hint` bajo el selector para que no sea una sorpresa.

## Decisión 2: "Base de coste" solo ofrece lo que esa marca/gama tenga en el maestro

Antes de pintar las tarjetas de nivel, se consulta `MasterDB.getByBrand(brandId, gama)`
(o con `gama: null` para "Todas") y se comprueba qué campos (`costFactura`,
`costNetoNeto`, `costTripleNeto`) tienen al menos una fila con valor numérico. Las
opciones sin datos se marcan `disabled` y con el sufijo "(sin datos)" — se dejan visibles
(no se ocultan) para que se entienda por qué no están disponibles, en vez de que
simplemente falten sin explicación. Si un nivel ya tenía seleccionada una base sin datos
(por ejemplo, se auditó neto-neto y luego se dejó de recibir esa columna), la opción
sigue apareciendo seleccionada aunque deshabilitada — no se fuerza un cambio automático.

Esto convierte `renderLevels()` en asíncrona (espera la consulta a `MasterDB`) — los
llamadores (cambio de marca/gama, añadir/eliminar nivel) no necesitan esperarla, el
guardado ya funcionaba de forma síncrona/local antes de repintar.

## Consecuencias

- `js/screens/screen-rules.js`: `loadConfig`/`saveConfig` aceptan `gama === '__all__'`;
  nueva función `availableCostFields(brandId, gama)`; `renderLevels`/`levelCardHtml`
  ahora tienen en cuenta la disponibilidad real de coste.
- Probado en navegador con datos reales: Castrol (factura + triple neto, neto-neto
  deshabilitado) y Racing Oil (solo factura, neto-neto y triple neto deshabilitados).
  Editar el margen con "Todas las gamas" seleccionada en Castrol actualizó las 9 gamas a
  la vez; seleccionar una gama suelta (EDGE) y editar solo la afectó a ella, dejando el
  resto intacto.

## Referencias

- `js/screens/screen-rules.js`.
- ADR 0020 (pantalla Tarifas, mismo patrón de "Todas" para lectura).
