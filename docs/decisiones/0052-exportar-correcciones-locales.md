# ADR 0052 — Exportar correcciones/descartes locales para incorporar al maestro

**Fecha:** 2026-08-19
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Las correcciones hechas en el panel de validación de descripciones (`DescriptionOverrides`,
ADR 0043) y los descartes de referencias inválidas (`LocalInvalidRefs`, ADR 0048) viven
solo en `localStorage`, en el navegador donde se hicieron — decisión explícita para no
depender de un servicio externo (ADR 0043). El único aviso que existía era un contador
("N correcciones/descartes guardados solo en este navegador — pide que se incorporen al
maestro"), sin ninguna forma de sacar esos datos del navegador salvo abrir las
herramientas de desarrollador a mano.

Yako tiene ya varias tarifas completas con correcciones hechas (AD Parts, Shell, Eni Live,
Racing Oil — 76 correcciones en total) y necesita pasármelas para incorporarlas al maestro
de fábrica (`master-descriptions.js`). Sin un navegador conectado por la extensión de
Chrome (no vinculada en esta sesión), la única vía práctica es que la propia app genere
ese volcado y Yako me lo pegue o lo adjunte.

## Decisión

- `DescriptionOverrides.exportAll()` y `LocalInvalidRefs.exportAll()`: mismo patrón que
  `countAll()` (recorren `Storage.list()` buscando sus claves), pero devuelven el
  contenido completo agrupado por marca en vez de solo el recuento.
- El aviso persistente (`renderDescOverridesNotice()`) pasa de `textContent` a `innerHTML`
  y añade un enlace "exportar para incorporar al maestro →" — visible en cualquier
  marca/gama, ya que el aviso siempre fue independiente de lo que se esté viendo.
- Nuevo modal `#modalExportOverrides`: un `<textarea readonly>` con el JSON completo
  (`{ generatedAt, overrides: {brandId: {ref: [desc, litros]}}, invalidRefs: {brandId:
  [ref, ...]} }` — mismo shape que ya usa cada clave de `localStorage`, para que
  incorporarlo al maestro sea un merge directo) más dos botones: "Copiar" (con
  `navigator.clipboard.writeText`, y si el navegador lo bloquea, cae a
  `document.execCommand('copy')` con el texto ya seleccionado) y "Descargar fichero"
  (Blob + enlace `download` temporal, sin depender de ningún servicio).
- De paso, se corrige una errata de acentuación ya existente en el propio aviso
  ("correcciónes" → "correcciones"/"corrección" según el plural).

No se automatiza la subida a ningún sitio — Yako sigue pasándome el resultado como hasta
ahora (copiar/pegar o fichero), y la incorporación al código del maestro sigue siendo un
paso manual mío, igual que con los Excel de `Descripciones Válidas/`.

## Verificación

Sembrando correcciones/descartes de prueba en tres marcas distintas (Shell, AD Parts,
Racing Oil) en una sesión de navegador aislada: el aviso muestra el recuento correcto
("3 correcciones/descartes"), el enlace abre el modal con el JSON completo y bien
formado agrupado por marca, el botón "Descargar" genera una URL `blob:` válida, y el
botón "Copiar" cae correctamente al mensaje de aviso cuando el navegador (headless, sin
permiso de portapapeles) rechaza `clipboard.writeText`. Consola sin errores en ningún
paso.

## Referencias

- ADR 0043 (maestro de descripciones, por qué las correcciones no se sincronizan solas).
- ADR 0048 (descartes de referencias inválidas).
- `js/core/description-overrides.js`, `js/core/local-invalid-refs.js`,
  `js/screens/screen-tarifas.js`.
