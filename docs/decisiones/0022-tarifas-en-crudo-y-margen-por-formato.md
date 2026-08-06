# ADR 0022 — Tarifas vuelve a ser solo la tarifa entrante; margen por formato en Reglas

**Fecha:** 2026-08-04
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras usar Tarifas/Reglas/Exportación con las 6 marcas ya importadas, Yako señaló dos
cosas:

1. Tarifas mostraba columnas de cálculo (% Margen, PVP envase, PVP manual, Ganancia €,
   Margen real) que no pintan nada ahí — es la tarifa ENTRANTE del proveedor, antes de
   aplicar ninguna regla. Las columnas importantes de una tarifa entrante son
   Referencia, Estado (nueva/estable/rebrand — ya existía vía `_status`/`_rebrandedFrom`
   de `History.diff`), Producto, Litros y Coste de envase. El listado con las columnas
   calculadas (con el "Tipo de Exportación" elegido) debería verse en Exportación.
2. Reglas solo tiene un margen "por defecto" que aplica a todos los formatos por igual
   — echaba en falta poder fijar un margen distinto por cada formato real de cada
   tarifa (el campo `byFormat` del modelo de datos ya existía y `Pricing.compute` ya lo
   usa, pero nunca hubo una UI en Reglas para editarlo desde que se separó de
   Importación en la v0.9.5 — la pantalla de Importación original sí lo tenía).

## Decisión 1: Tarifas pierde las columnas de cálculo

Se retiran de la tabla de Tarifas: % Margen, PVP envase, PVP manual, Ganancia €, Margen
real, y todo el código que las calculaba (`loadPvpLevel`, `forMaster`,
`saveManualOverride`, la lectura de `Pricing.compute` por fila). La tabla queda con
Ref / Estado / Producto / Litros / Coste de envase — un vistazo rápido de "qué ha
llegado", no "cuánto voy a vender esto". El override manual de PVP por fila desaparece
de aquí (se moverá a donde viva el listado calculado — pendiente, ver Exportación).

## Decisión 2: Margen por formato en Reglas, con los formatos reales de cada tarifa

Cada tarjeta de nivel (PVP, Bidones y Cubas Neto, Netos Bonus…) gana un desglose "Margen
por formato (%)" — un input por cada litraje real que tenga esa marca/gama en el
maestro (consultado vía `MasterDB`, igual patrón que `availableCostFields` del ADR
0021), con placeholder = margen por defecto y contador de referencias por formato. Para
niveles con `onlyFormats` (Bidones y Cubas Neto, Netos Bonus), el desglose solo muestra
los formatos que estén tanto en `onlyFormats` como en los datos reales — no tiene
sentido ofrecer margen por formato para un formato en el que ese nivel nunca calcula
precio.

Guardar con "Todas las gamas" seleccionada (ADR 0021) difunde el `byFormat` igual que el
resto de campos del nivel — un margen fijado para un formato aplica a todas las gamas
de la marca a la vez, salvo que se edite con una gama suelta seleccionada.

## Consecuencias

- `js/screens/screen-tarifas.js`: tabla reducida a 5 columnas; se retira todo el cálculo
  de PVP de esta pantalla.
- `js/screens/screen-rules.js`: nueva función `availableFormats(brandId, gama)`;
  `levelCardHtml` recibe `formats` y pinta un `.byformat-grid` de inputs; nuevo
  `updateByFormat(index, formatKey, value)`.
- CSS: se recupera `.format-row` (retirada en la limpieza de la v0.9.5, ahora vuelve a
  hacer falta) y se añade `.byformat-grid`/`.level-field.wide`.
- Pendiente explícito (siguiente tarea): construir en Exportación el listado calculado
  con las columnas completas (Ref, Estado, Producto, Litros, Coste, % Margen, PVP, PVP
  manual, Ganancia, Margen real) según el "Tipo de Exportación" elegido, con el override
  manual de PVP reubicado ahí.
- Probado en navegador con Castrol: Tarifas muestra las 5 columnas correctas; Reglas
  ofrece 10 formatos reales para el nivel PVP y solo 208L/1000L para Bidones y Cubas
  Neto (los únicos de `onlyFormats` presentes en los datos); fijar el margen de un
  formato con "Todas las gamas" seleccionada se difunde a las 9 gamas.

## Referencias

- `js/screens/screen-tarifas.js`, `js/screens/screen-rules.js`.
- ADR 0020 (pantalla Tarifas), ADR 0021 ("Todas las gamas" y base de coste disponible).
