# ADR 0020 — Nueva pantalla "Tarifas": Importación se queda solo con la carga

**Fecha:** 2026-08-04
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tras usar la app en real (importando las 6 marcas de golpe), Yako reportó una lista de
problemas de flujo, entre ellos el más estructural: al importar cualquier marca, la vista
de la tarifa cargada (tabla, filtros, KPIs, configuración de margen) se queda fija en la
pantalla de Importación y no hay forma de volver a ver la de otra marca ya importada sin
recargar un fichero. Propuso él mismo la solución: dejar Importación limpia (solo
tarjetas + carga) y mover la vista de la tarifa a una pantalla nueva intermedia,
"Tarifas", entre Importación y Reglas. También preguntó si la configuración de margen no
debería vivir directamente en Reglas en vez de en Importación.

## Decisión: Importación solo carga, Tarifas solo muestra, Reglas es la única fuente de margen

- **Importación**: cuadrícula de tarjetas + zonas de arrastre por marca + zona central de
  rebranding. Al cargar una tarifa con éxito, persiste en `MasterDB` (igual que antes) y
  entrega el resultado a un nuevo módulo puente, `LoadedTariff` (solo en memoria), y
  navega automáticamente a Tarifas.
- **Tarifas** (pantalla nueva): lee `LoadedTariff`, muestra pestañas de gama (+ "Todas",
  ver más abajo), banner de histórico, KPIs, filtros, tabla de preview con edición de
  litros y PVP manual por fila, y los botones "Establecer como vigente" / "Cargar otra
  tarifa" (vuelve a Importación y limpia `LoadedTariff`).
- **Reglas**: pasa a ser la ÚNICA pantalla donde se edita margen/redondeo/modo/base de
  coste — ya lo era para los niveles extra (Bidones y Cubas Neto, Netos Bonus), pero el
  nivel "PVP" también se podía editar desde el panel de Importación con sus propios campos
  duplicados. Se retira ese panel entero de Importación (toggle venta/compra, margen por
  formato, margen por defecto, redondeo, "Exportar a Skrit" legacy, "Guardar/Cargar perfil
  de margen") — Tarifas solo LEE el nivel "pvp" vigente de Reglas para calcular el PVP
  mostrado y para guardar los overrides manuales por ref (siguen siendo por fila, no una
  decisión de política de margen).

### Bug real que esto corrige, no solo estético

Importación guardaba su propio `defaultMargin/byFormat/rounding/marginMode/manualPvp` en
la MISMA clave de `Storage` que usa Reglas (`config_<marca>_<gama>`), pero como campos
sueltos al nivel raíz del objeto, no dentro de `priceLevels`. `Migration.synthesizePvpLevel`
solo lee esos campos sueltos la PRIMERA vez que esa marca/gama gana un `priceLevels`
(vía Reglas o vía `Migration.run()` en el arranque) — a partir de ahí, `priceLevels[0]` es
la fuente real que usan Reglas/Comparación/Exportación, pero Importación seguía leyendo y
escribiendo los campos sueltos de siempre, que ya no alimentaban a nadie. Resultado: editar
el margen desde Importación podía dejar de tener efecto en cuanto esa marca/gama se
visitaba una vez en Reglas, sin ningún aviso. Con Tarifas leyendo/escribiendo directamente
sobre `priceLevels[0]` (la misma función `Migration.synthesizePvpLevel`, pero ahora como
única fuente), este desdoblamiento desaparece.

### Función perdida a propósito: "Guardar/Cargar perfil de margen"

Permitía guardar un margen "plantilla" con nombre y reaplicarlo a otra marca/gama. Con
Reglas ya persistiendo la config de cada marca/gama de forma duradera, y sin una
funcionalidad equivalente en Reglas, se decide retirarla en vez de reconstruirla sobre el
nuevo modelo — si Yako la echa en falta, se puede recuperar apuntando a `priceLevels[0]`
en vez de a los campos sueltos legacy.

## Pestaña de gama "Todas" (Tarifas y Exportación)

Segundo problema reportado: las pestañas de gama (Normal/Standard/Sport Car/Químicos, o
las secciones de color de Repsol) se quedaban fijas en la última pulsada, sin forma de
volver a ver todas las gamas juntas. Se añade una pestaña "Todas" en Tarifas y una opción
"Todas" (primera y por defecto, "porque va a ser la más habitual") en el selector de gama
de Exportación.

La complicación real: cada gama puede tener el nivel "pvp" configurado con un margen
distinto en Reglas. "Todas" no usa un único nivel compartido — calcula el PVP de cada fila
con el nivel de SU PROPIA gama real (`levelFor(r.gama)` en Tarifas, y una función
resolutora `(row) => niveles[row.gama]` pasada a `ExcelWriter.exportSkritV2` en
Exportación, en vez de un nivel fijo). Los KPIs de Tarifas en modo "Todas" agregan el
diff de cada gama por separado (no existe "una" tarifa anterior única con la que
comparar de golpe). "Establecer como vigente" en modo "Todas" guarda el histórico de
TODAS las gamas de una vez, como conveniencia.

## Otros ajustes de la misma tanda de feedback

- **Tarjetas de marca**: fecha acortada (`04/08/26` en vez de `2026-08-04`) y tipografía
  más pequeña con `text-overflow: ellipsis` — el texto no cabía en una línea.
- **Buscador de Importación/Tarifas**: el icono de lupa nativo de Pico se solapaba con el
  texto (quedó a la izquierda tras reducir el padding) — movido a la derecha.
- **Reglas → "Añadir nivel"**: se retira el preset obsoleto "Precio Neto de Venta" (del
  diseño original de ADR 0008, nunca usado en la práctica — Yako lo confundía con PVP) y
  se añade una nota explicando que el nivel PVP ya existe por defecto y no hace falta
  "añadirlo".
- **Exportación**: "Tipo de exportación" y "Nivel de precio" (dos selects, el segundo
  escondía los niveles reales) se fusionan en un único select plano: cada nivel con
  `goesToSkrit` (PVP, Bidones y Cubas Neto, Netos Bonus…) aparece como "‹nombre› (Venta)",
  junto a los listados fijos "Neto Factura (Compra)" / "Neto-Neto (Compra)" — así se ve de
  un vistazo todo lo exportable para esa marca/gama, sin un menú secundario oculto.

## Consecuencias

- Nuevo módulo `js/core/loaded-tariff.js` (`LoadedTariff`) — puente en memoria entre
  Importación y Tarifas, vía `Store.emit('tariff:loaded', …)`.
- Nuevo `js/screens/screen-tarifas.js`; `js/screens/screen-import.js` se reduce a
  cuadrícula de tarjetas + carga (sin tabla, filtros, ni configuración de margen).
- `Router.SCREENS` gana `'tarifas'`; nuevo enlace de navegación entre Importación y
  Reglas.
- `js/export/excel-writer.js`: `exportSkritV2` acepta ahora también una función
  `(row) => nivel` como `levelConfig`, para el caso "Todas" de Exportación.
- CSS muerto retirado: `.config-panel`, `.format-row` (variante del panel de margen de
  Importación), `.wide-row`, `.panel-actions`, `.formula-hint`, `.layout` — todo exclusivo
  del panel de margen que ya no existe en Importación. `.mode-toggle`/`.mode-btn` se
  conservan (los usan también las pestañas de gama).
- Probado en navegador de punta a punta: cargar Castrol → auto-navega a Tarifas → tabla
  con PVP correcto (nivel compartido con Reglas) → pestaña "Todas" agrega las 9 gamas
  (449 filas) → override manual por fila persiste en la gama real de esa fila incluso
  viendo "Todas" → "Establecer como vigente" en "Todas" guarda las 9 gamas → "Cargar otra
  tarifa" limpia y vuelve a Importación → Exportación con gama "Todas" exporta las 449
  filas con el PVP resuelto fila a fila.

## Referencias

- `js/core/loaded-tariff.js`, `js/screens/screen-tarifas.js`, `js/screens/screen-import.js`.
- ADR 0008 (diseño original de las 4 pantallas y `priceLevels`).
