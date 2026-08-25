# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [v1.0.8] — 2026-08-25

### Cambiado
- Importador de Castrol: los tres niveles de coste (factura, neto-neto,
  triple-neto) se calculan ahora por litro × precio-por-litro de la
  columna correspondiente, en vez de depender de una columna de
  "envase ya multiplicado" que Yako añadía a mano y que las tarifas
  oficiales no traen. Detección de columnas por contenido, resistente
  a que cambien nombre/orden de una tarifa a otra.
- Importador de Castrol: los litros del envase priorizan el valor ya
  verificado del maestro compartido (por referencia) en vez de
  derivarse siempre de la descripción — la columna de "unidad de
  venta" de la tarifa no es fiable para formato caja.

Ver [ADR 0060](docs/decisiones/0060-castrol-tres-niveles-por-litro.md).

## [v1.0.7] — 2026-08-25

### Añadido
- Panel de validación de descripciones (Tarifas): botón "Exportar
  pendientes a Excel" — genera un fichero con el mismo formato que
  las plantillas "Maestro {Marca}.xlsx", para corregir lotes grandes
  de referencias pendientes con calma en Excel en vez de una a una
  en el panel.

Ver [ADR 0059](docs/decisiones/0059-exportar-pendientes-a-excel.md).

## [v1.0.6] — 2026-08-24

### Arreglado
- Tras el arreglo de Racing Oil (v1.0.4), reimportar dejaba las
  referencias viejas (con espacios) duplicadas junto a las nuevas
  (sin espacios) — la app las limpia sola en el próximo arranque,
  igual que ya se hizo para AD Parts/Castrol.

Ver [ADR 0057](docs/decisiones/0057-racing-oil-espacios-en-ref.md).

## [v1.0.5] — 2026-08-24

### Cambiado
- Al importar una tarifa, la pantalla de Tarifas se abre ahora siempre
  en "Todas las gamas" — antes se abría en la primera gama de la
  lista de esa marca, distinto según la marca (mismo criterio que ya
  se aplicó al cambiar de marca a mano, ADR 0050).

Ver [ADR 0058](docs/decisiones/0058-todas-tambien-al-saltar-de-importacion.md).

## [v1.0.4] — 2026-08-24

### Arreglado
- Racing Oil salía con el 100% de sus referencias "pendientes de
  validar" — la tarifa real trae el código con espacios sueltos en
  medio (ej. "1 0002 0001C2"), que ahora se quitan al importar
  (nunca son parte real del código).

Ver [ADR 0057](docs/decisiones/0057-racing-oil-espacios-en-ref.md).

## [v1.0.3] — 2026-08-24

### Arreglado
- Al reimportar AD Parts/Castrol tras quitarles el prefijo del ref
  (v1.0.2), las filas ya guardadas con el prefijo antiguo se quedaban
  duplicadas junto a las nuevas — la app las limpia sola en el
  próximo arranque, sin ninguna acción manual.

## [v1.0.2] — 2026-08-24

### Cambiado
- Ninguna marca lleva ya prefijo en la referencia interna (antes AD Parts
  usaba `ADP` y Castrol `CAT`) — una sola regla para las 6 marcas, sin
  excepciones. Esto es lo que causaba que Castrol saliera con el 100%
  de sus referencias "pendientes de validar": el maestro no tenía el
  prefijo que el código sí añadía al importar. Hace falta reimportar
  las tarifas de AD Parts y Castrol una vez para limpiar lo que ya
  estaba guardado con el prefijo antiguo.

Ver [ADR 0056](docs/decisiones/0056-sin-prefijo-en-ref-interno.md).

## [v1.0.1] — 2026-08-24

### Arreglado
- El maestro compartido en Neon solo se reaplicaba a las tarifas ya
  importadas la primera vez que se iniciaba sesión, no en cada
  arranque — cualquier corrección hecha después en Neon no llegaba a
  lo que ya estaba importado hasta reimportar esa tarifa. Ahora se
  reaplica siempre.
- AD Parts: 3 referencias (`ADP20005`, `ADP22005`, `ADP26005`)
  aparecían duplicadas en Tarifas con dos costes distintos — AD Parts
  reutiliza esos códigos entre su tarifa de aceites y la de
  "Producto Químico". Se descartan ahora al importar la tarifa de
  químicos, en vez de colarse como una fila fantasma con el coste
  equivocado.
- Textos del pie de la barra lateral traducidos al español.

Ver [ADR 0055](docs/decisiones/0055-colision-refs-ad-parts-quimico.md).

## [v1.0.0] — 2026-08-21

### Cambiado
- Cambio mayor: la app entera queda detrás de un **login real** (Neon Auth),
  sustituyendo el botón "Iniciar sesión (próximamente)" de la cabecera.
  Requiere HTTP(S) — abrir el fichero directamente por `file://` ya no
  funciona para el login (protección de seguridad del proveedor de
  autenticación, no algo que se pueda evitar).
- El maestro de descripciones/litros verificados deja de vivir en el código
  (`master-descriptions.js`) y en el navegador
  (`description-overrides.js`/`local-invalid-refs.js`, ver ADR 0052) — pasa
  a una tabla compartida en **Neon** (`verified_descriptions`), consultada
  en vivo desde cualquier dispositivo. Validar o descartar una referencia
  desde el panel de Tarifas se incorpora al instante para todos los
  usuarios, sin exportar nada ni esperar a que un desarrollador lo
  incorpore al código.
- Acceso restringido por lista blanca de emails (gestionada por Yako) —
  cualquiera puede crear una cuenta, pero solo los emails aprobados pueden
  leer/escribir el maestro compartido.

Ver [ADR 0054](docs/decisiones/0054-maestro-compartido-en-neon.md).

## [v0.9.43] — 2026-08-19

### Cambiado
- Maestro de descripciones vaciado por completo (las 3.284 referencias que
  tenía se acabaron mezclando datos de fuentes distintas en conflicto entre
  sí). Se reconstruye desde cero a partir de un Excel por marca, revisado
  con calma fuera de la app, en `Archivo Maestro/` — hasta que se
  incorporen esos Excel, todas las referencias importadas aparecen como
  "pendientes de validar" en Tarifas (salvo las que ya tengan una
  corrección guardada en el navegador). Ver
  [ADR 0053](docs/decisiones/0053-maestro-vaciado-excel-externo.md).

## [v0.9.42] — 2026-08-19

### Añadido
- Panel de validación de descripciones (Tarifas): el aviso de "correcciones
  guardadas solo en este navegador" ahora tiene un enlace "exportar para
  incorporar al maestro →" que abre un modal con todas las correcciones y
  descartes (de todas las marcas) en un único JSON, con botones para
  copiarlo o descargarlo como fichero — antes había que abrir las
  herramientas de desarrollador a mano para sacar esos datos del
  navegador. Ver
  [ADR 0052](docs/decisiones/0052-exportar-correcciones-locales.md).

## [v0.9.41] — 2026-08-19

### Arreglado
- Tarifas mostraba descripciones en mayúsculas o minúsculas según si la
  referencia ya estaba verificada o no (verificadas = maestro, siempre en
  mayúsculas; sin verificar = texto crudo del proveedor, capitalización
  variable), dando un aspecto inconsistente en la misma tabla (ej. Castrol).
  Ahora la tabla principal, el panel de validación (vista y campo editable)
  y el modal de "Referencias desaparecidas" muestran siempre en mayúsculas,
  y una corrección tecleada a mano se guarda también en mayúsculas — el
  aspecto ya no depende del estado de verificación de la referencia. Ver
  [ADR 0051](docs/decisiones/0051-mayusculas-siempre-en-tarifas.md).

## [v0.9.40] — 2026-08-19

### Cambiado
- Tarifas: al cambiar de marca, la gama por defecto es siempre "Todas"
  (antes era la primera gama de la lista, distinta según la marca). Ver
  [ADR 0050](docs/decisiones/0050-gama-todas-por-defecto-tarifas.md).

## [v0.9.39] — 2026-08-19

### Arreglado
- Castrol mostraba muchas referencias "sin verificar" que en realidad ya
  estaban validadas — cuando Castrol renombra un código de producto, la
  tarifa duplica la fila bajo el código antiguo (para no romper stock),
  y ese código retirado nunca iba a estar en el maestro. Ahora hereda la
  verificación del código nuevo en vez de pedir una validación aparte
  para el mismo producto. Solo afecta a Castrol (el único perfil con este
  patrón); requiere reimportar su tarifa para que se corrijan las filas
  ya importadas. Ver
  [ADR 0049](docs/decisiones/0049-alias-castrol-hereda-verificacion.md).

## [v0.9.38] — 2026-08-17

### Añadido
- Panel de validación de descripciones (Tarifas): botón "Eliminar" junto a
  "Guardar" — borra del maestro toda huella de una referencia que no
  existe como producto real (no vuelve a importarse, aunque la traiga la
  tarifa del proveedor). El modal se ensancha para que no se amontonen
  los campos con la columna nueva.
- Referencia `ADP16508` (AD Parts) añadida a las confirmadas como
  inexistentes.

Ver [ADR 0048](docs/decisiones/0048-boton-eliminar-referencia-invalida.md).

## [v0.9.37] — 2026-08-17

### Añadido
- Referencia faltante de AD Parts (`ADP12302`) incorporada al maestro, y
  corregido el texto de las 37 entradas de refrigerante ya existentes
  ("AD" añadido, typo "REFRIGEANTE" arreglado).
- Referencias de AD Parts confirmadas como inexistentes en catálogo
  (`ADP11505`, `ADP16403`, `ADP16502`, `ADP16503`) se descartan al
  importar y se borran solas si ya estaban importadas de antes — no
  vuelven a aparecer como pendientes de validar.

Ver [ADR 0046](docs/decisiones/0046-lote-refrigerantes-quimicos-y-version-maestro.md) y
[ADR 0047](docs/decisiones/0047-referencias-invalidas-descartadas.md).

## [v0.9.36] — 2026-08-17

### Añadido
- Segundo lote de descripciones y litros verificados: 80 referencias más
  de AD Parts (refrigerantes y otros químicos). El maestro pasa de un
  flag "aplicado una vez" a un número de versión — los próximos lotes se
  reaplican solos a las tarifas ya importadas, sin esperar a reimportarlas.

### Arreglado
- 2 referencias de AD Parts (`ADP20005`, `ADP22005`) resultaron ser un
  error de fábrica del proveedor (la misma referencia usada para dos
  productos distintos) — se descartó el refrigerante duplicado, sin
  tocar los productos ya verificados.

Ver [ADR 0046](docs/decisiones/0046-lote-refrigerantes-quimicos-y-version-maestro.md).

## [v0.9.35] — 2026-08-17

### Arreglado
- Modal de validación de descripciones: casillas de litros más anchas
  (1000 ya no se cortaba), referencias y descripciones anchas ya no se
  parten en dos líneas ni se recortan a media palabra, y el modal en
  conjunto es lo bastante alto para que solo la lista de referencias
  haga scroll — el título, los avisos, las pestañas y "Cerrar" se quedan
  siempre visibles. Ver
  [ADR 0045](docs/decisiones/0045-maquetado-modal-validacion.md).

## [v0.9.34] — 2026-08-17

### Arreglado
- Tarifas: los desplegables de Marca y Fecha se quedan fijos al hacer
  scroll (justo debajo de la cabecera), en vez de desaparecer con el resto
  del contenido en tarifas largas.

## [v0.9.33] — 2026-08-17

### Añadido
- Panel de validación de descripciones (Tarifas): pestaña "Ya validadas",
  con buscador, para corregir una referencia que ya se había validado
  antes — antes solo se podían corregir las pendientes.

### Cambiado
- Toda descripción que se valide (nueva o ya corregida antes) termina
  siempre en el mismo formato de litros ("5L", "1000L", "230ML"), sin
  importar cómo se haya escrito — homogéneo entre marcas.

### Arreglado
- Validar una descripción no se guardaba de verdad en el maestro — solo
  quedaba en memoria y se perdía al recargar la página hasta la próxima
  importación real. Ahora se persiste al instante.

Ver [ADR 0044](docs/decisiones/0044-consistencia-sufijo-litros-editar-validadas.md).

## [v0.9.32] — 2026-08-17

### Arreglado
- Panel de validación de descripciones (Tarifas): el botón "Guardar"
  quedaba un poco más alto que los campos de texto de su misma fila —
  heredaba un margen por defecto que los inputs ya tenían puesto a 0.

## [v0.9.31] — 2026-08-17

### Añadido
- Maestro de descripciones y litros verificados por Yako, incrustado en el
  propio código (3.284 referencias en las 6 marcas, sin depender de subir
  ningún fichero ni de un servicio externo). Al importar, si la referencia
  está en el maestro, la descripción y los litros que se guardan son
  siempre los verificados, sustituyendo lo que traiga la tarifa de ese mes.
- Tarifas: panel de validación para las referencias que aún no están en el
  maestro — un aviso parpadeante en amarillo pastel abre una ventana donde
  corregir descripción y litros; se guardan al instante en el navegador.
  Un aviso recuerda cuántas correcciones siguen sin incorporarse al
  maestro de fábrica (no viajan solas entre dispositivos — hay que pedir
  que se incorporen). Ver
  [ADR 0043](docs/decisiones/0043-maestro-de-descripciones-verificadas.md).

## [v0.9.30] — 2026-08-14

### Arreglado
- Reglas: el hueco entre Marca y Gama era enorme (un `flex-grow` heredado
  de la fila horizontal se aplicaba también dentro de la columna vertical)
  — ahora queda justo el espacio esperado.

### Cambiado
- Reglas: en el bloque de exportar políticas de precios, el botón
  "Exportar Políticas de Precios" pasa a la altura de Marca y el
  desplegable (renombrado a "Política a exportar") a la altura de Gama.
  Ver [ADR 0042](docs/decisiones/0042-reordenar-bloque-politicas-de-precios.md).

## [v0.9.29] — 2026-08-14

### Añadido
- Reglas: nuevo botón "Exportar Políticas de Precios", con su propio
  selector de alcance ("Todas las marcas" o cada una) — genera un PDF de
  una hoja que explica, por formato, las reglas vigentes hoy para calcular
  PVP y Netos Bonus de esa marca (o un resumen de las 6 si eliges "Todas
  las marcas"). Sin precios en €: explica la regla/margen, no un importe,
  que depende del coste real de cada producto. Ver
  [ADR 0041](docs/decisiones/0041-exportar-politicas-de-precios.md).

### Cambiado
- Reglas: Marca y Gama pasan a ir apiladas en una columna (antes en dos
  columnas separadas), dejando sitio a la derecha para el nuevo bloque de
  exportar políticas de precios.

## [v0.9.28] — 2026-08-14

### Cambiado
- Reglas: cambiar "Margen por defecto" ahora se refleja al instante en las
  casillas de margen por formato que no tienen un valor propio (antes se
  quedaban con el placeholder viejo hasta cambiar de gama). Las casillas
  con un valor puesto a mano (Margen y Obsequio, en PVP y Netos Bonus) se
  resaltan con fondo gris medio y negrita.

### Arreglado
- Netos Bonus, al crearse por primera vez, rellenaba de fábrica el margen
  (20%/15%) y el obsequio (50€/100€) por formato de bidones/cubas, guardado
  igual que un valor manual — esas casillas nunca seguían "Margen por
  defecto". Los niveles nuevos empiezan ahora sin esa semilla; los ya
  guardados se limpian una sola vez (solo lo que nunca se tocó a mano; lo
  editado de verdad se conserva). Ver
  [ADR 0040](docs/decisiones/0040-margen-por-defecto-en-vivo-y-resaltado.md).

## [v0.9.27] — 2026-08-14

### Añadido
- Nuevo tipo de exportación "PVP (Bonus)": PDF sin coste, mismo maquetado
  que "PVP (Imprimir)", con el resultado de Netos Bonus (solo los formatos
  marcados "Salida impresa") en 4 columnas — Referencia, Descripción,
  Litros, PVP Bonus. Ver [ADR 0039](docs/decisiones/0039-pvp-bonus-pdf.md).

## [v0.9.26] — 2026-08-14

### Arreglado
- Detección de litros: cuando la descripción no trae ningún tamaño con
  unidad explícita pero termina en un código de familia tipo "-400" (ej.
  "GREASE CG-400"), se interpreta como gramos → litros (400 → 0,4 L),
  confirmado por Yako. Se excluyen los códigos de viscosidad ("5W-40",
  "10W-60") para no confundirlos con un tamaño de envase. Ver
  [ADR 0038](docs/decisiones/0038-litros-desde-codigo-de-familia.md).

## [v0.9.25] — 2026-08-13

### Arreglado
- El cuadro "Mostrando X de Y referencias" de Exportación se veía sin
  espacios ("Mostrando2de689referencias") — los espacios normales entre el
  texto y los números se colapsaban al estar dentro de un contenedor
  `display: flex`. Sustituidos por `&nbsp;`, que no se colapsan.

## [v0.9.24] — 2026-08-13

### Añadido
- Reglas/Netos Bonus: nueva fila "Obsequio (€)" por formato, debajo del
  margen — el importe se suma al coste antes de calcular el PVP de Netos
  Bonus (antes era un valor fijo de 50€/100€ sin forma de cambiarlo desde
  la pantalla). Ver [ADR 0037](docs/decisiones/0037-obsequio-por-formato-netos-bonus.md).

### Arreglado
- Reglas: el margen por formato (fila "Margen (%)" de PVP y Netos Bonus) no
  se guardaba nunca al editarlo — un `data-index` que faltaba en el propio
  input hacía que el cambio se descartara en silencio. Corregido junto con
  la nueva fila de Obsequio, que usaba el mismo mecanismo.

## [v0.9.23] — 2026-08-13

### Cambiado
- Cabeceras de columna de coste más claras y consistentes entre tipos de
  exportación: "PVP (Skrit)" pasa de "Coste compra" a **Coste factura**
  (Excel y pantalla); los listados de coste simple pasan de "Neto Factura"
  / "Neto-Neto" / "Triple Neto" a **Compra Factura** / **Compra Neto-Neto**
  / **Compra Triple-Neto**. El nombre del tipo (desplegable, nombre de hoja)
  no cambia, solo el texto de la columna. Ver
  [ADR 0036](docs/decisiones/0036-columna-coste-precio-por-tipo-exportacion.md).

## [v0.9.22] — 2026-08-13

### Cambiado
- Nomenclatura de todos los ficheros exportados (Excel y PDF), homogénea para
  las 7 marcas: `Tarifa {Marca} {Tipo} dd-mm-aaaa.{ext}` — sin guiones salvo
  en la fecha y en Neto-Neto/Triple-Neto. Por ejemplo: `Tarifa AD PVP Venta
  13-08-2026.xlsx`, `Tarifa Repsol PVP SKRIT 13-08-2026.xlsx`, `Tarifa AD PVP
  Comerciales 13-08-2026.pdf` (PVP Imprimir), `Tarifa AD Neto Bonus
  13-08-2026.xlsx`. AD Parts usa "AD" en el nombre de fichero (ni "AD Parts"
  ni el abreviado interno "ADP", que sigue igual en la columna MARCA del
  Excel). Ver [ADR 0035](docs/decisiones/0035-nomenclatura-limpia-ficheros-exportados.md).

## [v0.9.21] — 2026-08-13

### Cambiado
- Toda salida de tarifa (pantalla, Excel, PDF) se homogeneiza en mayúsculas;
  las referencias salen sin espacios aunque entren con ellos.
- Orden de columnas homogéneo en toda la exportación: Marca, Referencia,
  Descripción, Litros, Familia, Costes, Ventas (donde la plantilla las
  tenga). "PVP (Venta)"/"Netos Bonus" reordenan sus 9 columnas a este
  esquema; "PVP (Skrit)" ya lo cumplía y ahora también muestra Familia en
  pantalla, igual que en el Excel.
- "Netos Bonus" tenía la misma vista rica que "PVP (Venta)" (Estado, margen,
  PVP manual, ganancia) pero su Excel nunca tuvo esas columnas — pasa a
  tener su propia vista mínima, idéntica a su Excel. "PVP (Venta)" sigue
  siendo la única excepción al WYSIWYG (esas columnas de trabajo son ayuda
  de edición, no se exportan).
- Los listados de Neto Factura/Neto-Neto/Triple Neto/Valor Regalo 1+1 dejan
  de mostrar en pantalla una columna "Estado" que su Excel no tiene, y pasan
  a mostrar "Marca", que su Excel sí tiene.
- La leyenda "Mostrando X de Y referencias" pasa a un cuadro propio, con un
  segundo cuadro a su derecha (hasta el borde del botón Exportar) que avisa
  de errores en la tarifa (litros/descripción/precio que falten en alguna
  referencia visible), con fondo amarillo pastel parpadeante mientras haya
  alguno.
- El filtro de formato o de estado, cuando está activo, resalta su fondo en
  verde pastel.

### Arreglado
- La fila de filtros de búsqueda/formato/estado medía 4px menos que la fila
  de Marca/Gama/Tipo/Fecha (un `line-height` distinto entre las dos) — ahora
  miden lo mismo.
- El resaltado verde de filtro activo, en su primera versión, se aplicaba
  también con el tema claro por defecto (`:root:not([data-theme="light"])`
  fuera de un `@media` coincide con el modo claro sin `data-theme`
  explícito) — corregido envolviéndolo en `@media (prefers-color-scheme:
  dark)` junto con reglas explícitas para `data-theme="dark"`/`"light"`.

Ver [ADR 0034](docs/decisiones/0034-homogeneizacion-exportacion.md).

## [v0.9.20] — 2026-08-13

### Añadido
- "PVP (Imprimir)" usa el color real de cada marca en la cabecera del PDF:
  azul AD, naranja Repsol, amarillo Shell, azul claro Eni Live, gris medio
  Racing Oil.

### Arreglado
- La previsualización en pantalla de "PVP (Skrit)" no mostraba la columna
  Familia (sí salía en el Excel) — ahora se ve igual en los dos sitios y en
  el mismo orden: Marca, Referencia, Producto, Litros, Familia, Coste
  compra, PVP.
- "PVP (Venta)" y "PVP (Skrit)" generaban nombres de fichero casi idénticos
  — ahora `tarifa-skrit-{marca}-venta-{fecha}.xlsx` y
  `tarifa-skrit-{marca}-pvp-{fecha}.xlsx` respectivamente. Ver
  [ADR 0033](docs/decisiones/0033-colores-pdf-columna-familia-nombres-fichero.md).

## [v0.9.19] — 2026-08-12

### Añadido
- Los Excel exportados llevan la fila de cabecera en negrita y centrada (se
  cambia el motor de escritura a ExcelJS — la librería anterior, gratuita,
  no soporta escribir estilos).
- "PVP (Skrit)" incluye también la columna Familia.

### Cambiado
- Se quita la columna "MARCA+REFERENCIA" de todas las exportaciones que la
  tenían (era redundante con Marca + Referencia por separado).
- En los listados de Neto Factura/Neto-Neto/Triple Neto/Valor Regalo 1+1, la
  columna Litros pasa a ir después de Descripción.
- El botón "Exportar" se mueve a la fila de Marca/Gama/Tipo de
  exportación/Fecha tarifa, repartiendo el ancho a partes iguales entre los
  5 — antes podía quedar fuera de la pantalla en listados largos. Ver
  [ADR 0032](docs/decisiones/0032-excel-negrita-columnas-boton-exportar.md).

## [v0.9.18] — 2026-08-12

### Añadido
- Exportación: dos salidas nuevas para el nivel PVP — "PVP (Skrit)" (Excel
  mínimo listo para subir: Marca, Referencia, Descripción, Litros, Coste de
  compra y PVP) y "PVP (Imprimir)" (PDF sin coste, para entregar a un cliente
  o comercial: Referencia, Producto, Litros y PVP).
- Comparación: el desplegable de Referencia muestra también los litros de
  cada una.
- Botón de Ayuda: manual con una pestaña por pantalla (Importación, Tarifas,
  Reglas, Comparación, Exportación) explicando qué se puede hacer y el flujo
  de trabajo esperado en cada una.

### Arreglado
- Exportación: los filtros de búsqueda/formato/estado solo afectaban a la
  previsualización — el Excel exportado siempre llevaba todas las filas de
  la marca/gama, sin filtrar. Ahora se exporta exactamente lo que se ve
  filtrado en pantalla, en todos los tipos de exportación. Ver
  [ADR 0031](docs/decisiones/0031-skrit-imprimir-litros-filtros-ayuda.md).

## [v0.9.17] — 2026-08-11

### Añadido
- AD Parts: soporte para el fichero dedicado de Triple-Neto que envían aparte
  de la tarifa normal (`Triple-neto DD-MM-AAAA.xlsx`) — se detecta al
  soltarlo en la tarjeta de AD Parts, elige automáticamente el mes más
  reciente de las dos columnas que trae, y cruza cada referencia contra las
  ya importadas con su tarifa de factura (el fichero no indica gama). Las
  referencias que todavía no se hayan importado se reportan como "sin
  emparejar" en vez de crear datos a medias. Ver
  [ADR 0030](docs/decisiones/0030-triple-neto-ad-parts.md).

### Arreglado
- `MasterDB.putRows` podía borrar el coste de factura ya guardado si una
  importación no traía ese coste en la fila (el caso del fichero anterior) —
  ahora solo lo toca cuando la fila trae un valor numérico válido.

## [v0.9.16] — 2026-08-11

### Arreglado
- Repsol: los costes Neto-Neto y Triple Neto salían varias veces más caros
  que el de Factura en cualquier envase con más de 1 unidad por caja (ej.
  "5x5L") — esas columnas vienen por caja en el Excel de Repsol, igual que
  Factura, pero no se estaban dividiendo entre las unidades por caja. Ver
  [ADR 0029](docs/decisiones/0029-fix-neto-repsol-y-quitar-kb-duplicada.md).

### Cambiado
- Comparación ya no tiene su propia zona para cargar los 5 Excel de
  equivalencias entre marcas — estaba duplicada con la de Importación (ADR
  0025), que alimenta el mismo índice. El aviso de "sin base de conocimiento"
  ahora indica que se carga desde Importación.

## [v0.9.15] — 2026-08-10

### Arreglado
- El título de la pantalla activa y los iconos de tema/ayuda/ajustes/login
  también se desplazaban con el contenido en Reglas — ahora se quedan fijos
  arriba, igual que la barra lateral. Ver
  [ADR 0028](docs/decisiones/0028-scroll-interno-en-app-main.md).

## [v0.9.14] — 2026-08-10

### Arreglado
- La barra lateral se desplazaba junto con el contenido en Reglas (la única
  pantalla que puede necesitar más scroll que un viewport) — el `position:
  sticky` que la fijaba solo aguanta pegada mientras el scroll total no supere
  la propia altura de la barra, casi un viewport completo. Ahora el scroll
  vive dentro del área de contenido en vez de en la página entera, así que la
  barra nunca se mueve, sea lo larga que sea la pantalla activa. Ver
  [ADR 0028](docs/decisiones/0028-scroll-interno-en-app-main.md).

## [v0.9.13] — 2026-08-10

### Cambiado
- Reglas: "1+2" y "PVP Neto" (antes "Bidones y Cubas Neto") dejan de ser niveles
  que había que añadir/quitar aparte — ahora son un interruptor por formato
  dentro de la propia tabla de margen de PVP (encendido/apagado, apagado por
  defecto), mutuamente excluyentes entre sí y con el margen normal de ese
  formato. "Añadir nivel" desaparece: ya no hace falta.
- Reglas: Netos Bonus pasa a ser una tarjeta fija (como PVP) en vez de un nivel
  opcional — nunca va a Skrit (se corrige un dato que llevaba mal desde que se
  introdujo), y en vez de limitarse a bidones/cubas tiene su propia fila de
  interruptor "Salida impresa" por formato, que decide qué formatos entran en
  la hoja impresa/exportada.
- Exportación: "Valor Regalo 1+1" y el propio listado de Netos Bonus se
  adaptan al cambio anterior (formatos con "1+2" activado / con "Salida
  impresa" activada, respectivamente). Ver
  [ADR 0027](docs/decisiones/0027-pvp-modos-por-formato-y-netos-bonus-fijo.md).

### Arreglado
- Reglas: el desplegable "Base de coste" pegaba el texto contra la flecha, y
  "Margen por defecto" partía su etiqueta en dos líneas — se ensancharon las
  columnas y "Redondeo"/"¿Va a Skrit?" pasan a la misma fila que los otros 3
  campos (ya no caían debajo de la tabla de margen por formato). El campo de
  margen por defecto ahora muestra el símbolo "%".
- Exportación "Todas las gamas" con Netos Bonus o con formatos en modo "1+2"/
  "PVP Neto": el nivel se resolvía mal fila a fila (se le pasaba una función
  pensada para recibir una gama, no una fila) y el PVP exportado salía
  incorrecto — introducido por este mismo cambio, corregido antes de publicar.

## [v0.9.12] — 2026-08-10

### Añadido
- Reglas: nuevo preset de nivel "1+2" (venta especial: caja + 2 cajas sin
  cargo, equivalente a un descuento del 66,6% sobre las tres) — margen fijo
  del 83,33% sobre venta y solo aplicable a formatos de hasta 5 litros.
- Exportación: cuando la marca/gama activa tiene el nivel "1+2" añadido en
  Reglas, aparece un nuevo listado "Valor Regalo 1+1 (Compra)" con el coste
  de la caja adicional que se regala en cada referencia — pensado para
  "1+1+regalo" (una sola caja adicional, valorada en dinero en vez de en
  producto). Ver [ADR 0026](docs/decisiones/0026-promocion-1x2-y-listado-regalo.md).

## [v0.9.11] — 2026-08-06

### Añadido
- Importación: nueva zona de carga "Cruces de referencias entre marcas"
  (los 5 Excel de equivalencias) debajo de la de rebranding — antes solo se
  podían cargar desde Comparación, un problema al actualizarlos o al abrir
  la app en otro ordenador. Ambas puertas de entrada dejan el mismo estado.
- Reglas → "Añadir nivel": nueva opción "Ningún nivel añadido" por defecto
  — antes el primer preset real ya estaba preseleccionado y se podía añadir
  un nivel sin querer.

### Arreglado
- Tarifas: la columna "Estado" salía siempre vacía en la vista "Todas" — el
  diff se calculaba sobre una copia de las filas distinta a la que se
  pintaba en pantalla. Ver
  [ADR 0025](docs/decisiones/0025-cruces-de-referencias-en-importacion.md).
- Reglas: los campos de margen por formato se atropellaban con las
  descripciones cuando había muchos formatos (Castrol tiene 10) — rediseño
  a "chapas" verticales en vez de un grid horizontal rígido.

### Cambiado
- El cuadro de rebranding en Importación ya solo explica el rebranding
  (se quita la mención a cargar tarifas de proveedor); el nuevo cuadro de
  cruces de referencias explica qué son y para qué se usan.

## [v0.9.10] — 2026-08-06

### Añadido
- Comparación: casilla de búsqueda libre de referencia, con o sin el
  prefijo de marca (`ADP32005` o `32005`) — busca en todo el maestro antes
  de la cascada de selects Marca/Gama/Referencia (que se mantiene como
  alternativa).
- Comparación: se muestran todos los costes disponibles de cada marca
  miembro (factura, neto-neto, triple neto) y todos los niveles de precio
  con `goesToSkrit` (PVP, Bidones y Cubas Neto, Netos Bonus…), no solo un
  coste y un PVP.
- Comparación: "EN OTROS FORMATOS" (marcado así en el Excel de
  equivalencias) ya no se descarta en silencio — se muestra como aviso
  explícito en vez de dar la impresión de que la marca no tiene nada.

### Arreglado
- Comparación daba "sin tarifa importada" para marcas que sí estaban
  importadas: el emparejamiento fijaba una gama por marca
  (`EQUIV_BRAND_ALIASES`) que solo es real para AD Parts — para el resto,
  la ref de un grupo podía vivir en cualquier gama de esa marca. Ahora se
  busca en todas las gamas antes de concluir que falta. Ver
  [ADR 0024](docs/decisiones/0024-comparacion-busqueda-libre-y-multi-nivel.md).

## [v0.9.9] — 2026-08-04

### Añadido
- Exportación: tabla de previsualización en pantalla con el listado final
  calculado (Ref, Estado, Producto, Litros, Coste, % Margen, PVP, PVP
  manual, Ganancia, Margen real para tipos "de Venta"; versión simplificada
  para "de Compra") — antes solo se generaba el Excel directamente sin ver
  nada en pantalla. El PVP manual editado aquí se guarda en el mismo nivel
  que edita Reglas. Exportar usa exactamente las filas mostradas (WYSIWYG,
  sin volver a consultar el maestro). Ver
  [ADR 0023](docs/decisiones/0023-listado-calculado-en-exportacion.md).
- Exportación: nuevo listado "Triple Neto" (antes solo Neto Factura y
  Neto-Neto) — Castrol, por ejemplo, solo audita triple neto.

## [v0.9.8] — 2026-08-04

### Añadido
- Reglas: cada nivel de precio gana un desglose de "Margen por formato (%)"
  con los litrajes reales de esa marca/gama (consultados del maestro, con
  contador de referencias) — antes solo había un margen por defecto único
  para todos los formatos.
- Tarifas: el selector de marca gana "Ninguna" para dejar la pantalla
  limpia.

### Cambiado
- Tarifas pierde las columnas calculadas (% Margen, PVP envase, PVP manual,
  Ganancia €, Margen real) — vuelve a ser solo la tarifa entrante tal cual
  llega del proveedor (Ref, Estado, Producto, Litros, Coste de envase). El
  listado calculado según el "Tipo de Exportación" elegido se verá en
  Exportación. Ver [ADR 0022](docs/decisiones/0022-tarifas-en-crudo-y-margen-por-formato.md).

## [v0.9.7] — 2026-08-04

### Añadido
- Reglas: el selector de "Base de coste" de cada nivel solo ofrece las
  opciones (factura / neto-neto / triple neto) que esa marca/gama tenga
  realmente auditadas en el maestro — Racing Oil o Eni Live, por ejemplo,
  solo tienen factura; las demás aparecen deshabilitadas con "(sin datos)"
  en vez de dejar elegir una base que daría "sin coste" en todas las filas.

### Cambiado
- Reglas: el selector de Gama gana "Todas las gamas", primera y por
  defecto (igual que Tarifas/Exportación) — es lo más habitual, casi
  siempre se quiere la misma política de margen para toda la marca. A
  diferencia de Tarifas/Exportación (solo lectura), aquí "Todas" también
  aplica al guardar: cualquier edición se difunde a la config de cada gama
  real de la marca, sobrescribiendo cualquier diferencia previa entre ellas.
  Ver [ADR 0021](docs/decisiones/0021-reglas-todas-las-gamas-y-coste-disponible.md).

## [v0.9.6] — 2026-08-04

### Arreglado
- **Tarifas dependía solo de la tarifa recién importada** (`LoadedTariff`, en
  memoria) — al visitarla sin acabar de soltar un fichero, o tras recargar la
  página, decía "no has cargado ninguna tarifa" aunque las tarjetas de
  Importación mostraran datos reales. Corregido: Tarifas ahora tiene su
  propio selector de marca/gama y lee siempre de `MasterDB` (igual que
  Reglas/Comparación/Exportación); `LoadedTariff` queda solo como atajo que
  salta a la marca recién importada la primera vez que se visita la
  pantalla, sin forzar volver ahí si ya se eligió ver otra marca a mano. Ver
  [ADR 0020](docs/decisiones/0020-pantalla-tarifas.md).

## [v0.9.5] — 2026-08-04

### Añadido
- **Pantalla nueva: Tarifas.** Entre Importación y Reglas. Muestra la tarifa
  recién cargada (tabla, filtros, KPIs, PVP manual por fila) — Importación se
  queda solo con las tarjetas de marca y la carga. Nuevo módulo puente
  `LoadedTariff`. Ver [ADR 0020](docs/decisiones/0020-pantalla-tarifas.md).
- Pestaña de gama **"Todas"** en Tarifas, y opción **"Todas"** (primera y por
  defecto) en el selector de gama de Exportación — el PVP de cada fila se
  calcula con el nivel de su propia gama real, no uno compartido.

### Cambiado
- El margen (base de coste, modo, % por defecto, redondeo) se configura
  **solo en Reglas** — se retira el panel duplicado de Importación (arreglaba
  de paso un bug real: editar margen desde Importación podía dejar de tener
  efecto en cuanto esa marca/gama se visitaba una vez en Reglas, sin aviso,
  por dos copias de la misma config desincronizadas). El PVP manual por fila
  sigue editándose en la tabla (ahora en Tarifas).
- Exportación: "Tipo de exportación" y "Nivel de precio" (dos selects) se
  fusionan en un único selector plano — cada nivel de Reglas (PVP, Bidones y
  Cubas Neto, Netos Bonus…) aparece como opción "(Venta)" junto a los
  listados fijos "Neto Factura / Neto-Neto (Compra)".
- Reglas → "Añadir nivel": se retira el preset obsoleto "Precio Neto de
  Venta" (confundía con PVP, nunca se llegó a usar) y se añade una nota
  aclarando que el nivel PVP ya existe por defecto.
- Tarjetas de marca (Importación): fecha acortada (`04/08/26`) y texto más
  compacto — no cabía en una línea con fechas largas.

### Arreglado
- Buscador de Importación/Tarifas: el icono de lupa se solapaba con el texto
  — movido al lado derecho del campo.

### Retirado
- "Exportar a Skrit" y "Guardar/Cargar perfil de margen" (panel legacy de
  Importación) — superados por la pantalla Exportación y por la persistencia
  ya duradera de Reglas por marca/gama.

## [v0.9.4] — 2026-08-04

### Arreglado
- Castrol: el envase de grasa de 25kg (`CAT15EEF3`/`CAT15A3DA`, "CLS Grease")
  ya no se descarta del import — Yako confirmó que equivale a 25L, añadido a
  la tabla kg→L del perfil.

### Cambiado
- Pulido visual de las zonas de arrastre por tarjeta de marca (Importación):
  ahora quedan siempre ancladas al borde inferior de la tarjeta (antes
  quedaban a distinta altura según cuántas líneas de gama tuviera cada
  tarjeta encima) y con un estilo más marcado (fondo e icono) para que se
  lean como zona interactiva. La cuadrícula de tarjetas pasa de `auto-fill`
  a `auto-fit` para que ocupe exactamente el mismo ancho que la zona central
  de rebranding, sin dejar columnas fantasma vacías.

## [v0.9.3] — 2026-08-04

### Cambiado
- **Carga de tarifas por tarjeta de marca.** Cada tarjeta de Importación tiene
  ahora su propia zona de arrastre/selección en la parte inferior — soltar un
  fichero ahí lo carga directamente para esa marca, sin pasar por la zona
  central. La zona central se repurpone en exclusiva para el Excel de cruce
  de rebranding (SIRDI antigua ↔ nueva): ya no intenta detectar tarifas de
  proveedor como fallback.
- Salvaguarda de marca equivocada: si el fichero soltado en la tarjeta de una
  marca se detecta como perteneciente a otra (por columnas, no por la
  tarjeta), se pide confirmación antes de continuar — se carga bajo el
  proveedor realmente detectado, no bajo el de la tarjeta.

## [v0.9.2] — 2026-08-03

### Añadido
- **Sexto y último proveedor del roadmap inicial: Castrol.** Perfil nuevo
  (`profile-castrol.js`), 9 gamas (Other, CRB, EDGE, GTX, GTX 5W, Magnatec,
  Castrol ON, Transmax, Vecton), `refPrefix: 'CAT'`. Ver
  [ADR 0019](docs/decisiones/0019-perfil-castrol.md).

### Arreglado
- Colisión de auto-detección de proveedor: el fichero de Castrol se clasificaba
  primero como Repsol (ambos usan una hoja `DATOS` creada a mano por Yako) y
  luego como Shell (ambos comparten columnas `Material`/`Gama`) antes de llegar
  a Castrol. `detect()` de Repsol ahora exige la cabecera real ("PRECIO
  FACTURA" + ref + nombre), y `detect()` de Shell descarta cabeceras con
  "PRONTO PAGO" (exclusiva de Castrol).

### Nota
- La columna de precio de Castrol también es **€/litro**, no por envase, igual
  que Shell (ADR 0018) — `costFactura = precioUnitarioLitro × liters`.
- Fila `CAT15EEF3` ("CLS Grease, 25K B5") se descarta silenciosamente del
  import: 25kg no tiene equivalencia en la tabla kg→L de Castrol — pendiente
  de confirmar con Yako.
- "Sustituye a" duplica la fila bajo la ref antigua salvo cuando el valor es
  literalmente "NUEVO" (placeholder de producto nuevo, no de sustitución).

## [v0.9.1] — 2026-08-03

### Cambiado
- Tarjetas de marca en Importación: los proveedores cuyas gamas siempre llegan
  juntas en el mismo Excel (Repsol, Eni Live, Racing Oil, Shell) ahora muestran
  una sola línea "Tarifa general" en vez de una línea por gama — las tarjetas
  se habían vuelto enormes (Shell con 23 gamas). AD Parts mantiene el desglose
  por gama (Normal/Standard/Sport Car/Químicos) porque esas sí llegan en
  ficheros sueltos y en fechas distintas. Nuevo flag `separateFiles` en
  `BRANDS` controla cuál de los dos comportamientos aplica.

## [v0.9.0] — 2026-07-31

### Añadido
- **Cuarto proveedor: Shell.** Perfil nuevo (`profile-shell.js`), 23 gamas (Advance,
  Helix, Rimula, Spirax, Omala, Gadus, Tellus, Corena…), una sola hoja, sin
  secciones. Ver [ADR 0018](docs/decisiones/0018-perfil-shell.md).

### Nota
- La columna de precio de Shell es **€/litro**, no por envase (a pesar de la
  descripción inicial) — confirmado cruzando los números reales contra la
  cabecera de la columna ("Precio €/lt"). `costPerPack` se calcula
  multiplicando por los litros del envase.
- Descripción de producto de Shell (código SAP interno, ej. "Adv4TUlt10W40
  SPMA2") sigue pendiente de una tabla de referencias que Yako va a aportar
  para reconstruirla correctamente — solución provisional documentada en la
  ficha de proveedor.
- Fórmula de PVP histórica de Yako para Shell (margen por formato 60-70%
  según envase) documentada como referencia para configurar en Reglas —
  equivalente exacto al modelo de margen sobre venta que ya usa la app.

## [v0.8.9] — 2026-07-31

### Arreglado
- Racing Oil: el cartucho de grasa de 400g se mostraba como "400ML" — Yako confirmó
  que debe mostrarse como "400GR" (es un cartucho, no un líquido). El valor de
  litros usado para el cálculo (0,4) no cambia.

## [v0.8.8] — 2026-07-31

### Añadido
- **Tercer proveedor: Racing Oil.** Perfil nuevo (`profile-racing-oil.js`), 12 gamas
  (V.Ligero, V.Pesado, Agrícola, Transmisión, Hidráulicos, Industria, Grasa, Moto,
  Classic, Marina, Anticongelante, Aditivos), una hoja por gama igual que Eni Live.
  Cabecera repartida en 2 filas (fusionadas dinámicamente), precio ya por envase
  (sin dividir por unidades por caja), y override de precios especiales para AD
  Ibiza aplicado por referencia sobre cualquier gama. Ver
  [ADR 0017](docs/decisiones/0017-perfil-racing-oil.md).
- Envases en kg (Grasa) convertidos a la escala de litros propia de Racing Oil
  (5/20/45/185kg → 5/20/50/200L), confirmado por Yako.

### Nota
- 18 referencias de la hoja HIDRÁULICOS están duplicadas entre la línea "Premier" y
  la normal del mismo producto — confirmado como error de la propia tarifa de
  Racing Oil, no se corrige en código.

## [v0.8.7] — 2026-07-31

### Añadido
- **Nivel de precio "Netos Bonus"**: coste más bajo disponible (triple-neto si existe,
  si no neto-neto, si no factura) + "precio del premio" fijo (50€ bidones / 100€ cubas) +
  el mismo 20%/15% sobre venta de Bidones y Cubas Neto. Exportable a Skrit. Ver
  [ADR 0016](docs/decisiones/0016-nivel-netos-bonus.md).
- `Pricing.compute` acepta `costCascade` (coste en cascada por varios campos, el primero
  que exista) y `premiumByFormat` (importe fijo sumado al coste antes del margen).

### Quitado
- Preset "Precios para Bonus" (10% sobre compra, nunca a Skrit) — era una suposición
  provisional anterior a conocer la fórmula real de Netos Bonus, sustituida por él.
- Nivel "Netos Especiales": descartado por Yako, se cubre con un nivel personalizado en
  Reglas sin necesidad de código nuevo.

## [v0.8.6] — 2026-07-31

### Añadido
- **Nivel de precio "Bidones y Cubas Neto"**: nuevo preset en Reglas — coste factura,
  20% de margen sobre venta para envases ~200L (185/200/205/208/209L según proveedor) y
  15% para cubas de 1000L. Fuera de esos dos formatos no genera precio (los formatos
  pequeños siguen con el PVP normal). Exportable a Skrit igual que cualquier otro nivel.
  Ver [ADR 0015](docs/decisiones/0015-nivel-bidones-cubas-neto.md).
- `Pricing.compute` acepta `onlyFormats` en un nivel — restringe el nivel a formatos
  concretos sin inventar un precio a 0% de margen para el resto.

## [v0.8.5] — 2026-07-31

### Añadido
- **Exportación: nuevo selector "Tipo de exportación"** — además de PVP (formato Skrit,
  igual que antes), dos listados simples nuevos: **Neto Factura** y **Neto-Neto**. Son
  para imprimir un listado de precios netos, no para Skrit: MARCA, REFERENCIA,
  MARCA+REFERENCIA, LITROS, DESCRIPCION y el coste tal cual, sin ningún cálculo de
  margen. El selector de "Nivel de precio" se oculta para estos dos tipos.
- Pendientes de definir por Yako (no implementados todavía): Bidones y Cubas Neto,
  Netos Bonus, Netos Especiales.

### Cambiado
- La limpieza de descripción de Repsol (ADR 0013) ahora se aplica a **cualquier tarifa
  de salida** (Skrit o los nuevos listados), no solo al export a Skrit — y la descripción
  original queda intacta en Importación, Comparación y el maestro (`descriptionExport`
  como campo aparte). Ver [ADR 0014](docs/decisiones/0014-exports-neto-y-descripcion-separada.md).

## [v0.8.4] — 2026-07-31

### Arreglado
- Repsol: filas con `SIRDI NUEVO` = `"-"` (guion suelto) se trataban como si tuvieran
  rebranding real, colisionando entre sí en el maestro (13 filas de la subcategoría MOTO
  se pisaban unas a otras: 864 filas leídas → 851 en el maestro). Un guion es un string
  no vacío, así que un check `truthy` simple lo confundía con una referencia nueva válida.
  Ahora se exige un valor real (no vacío, no solo un guion) para considerarlo rebranding.

### Añadido
- Repsol: descripción limpia para la salida a Skrit — quita la unidad de compra
  (`12x1L`→`1L`, `1xBiB-20L`→`BIB 20L`, `12xT-150`→`150ML`, `6xPT-500`→`500ML`…), el
  guion de la viscosidad (`5W-40`→`5W40`) y colapsa espacios múltiples. Los formatos en
  kg/gr se convierten a litros/ml solo en el texto (18KG=20L, 45KG=50L, 180KG=208L,
  400GR=400ML, 2KG=2L) — el cálculo de litros/margen sigue usando el peso real de
  origen, sin cambios. Ver [ADR 0013](docs/decisiones/0013-limpieza-descripcion-repsol.md).

### Nota
- Dos pesos vistos en la tarifa real no tienen equivalencia en litros confirmada: 5kg (8
  refs de Grasas) y 16kg (1 ref). Se dejan sin convertir hasta confirmarlo.

## [v0.8.3] — 2026-07-31

### Añadido
- **Gamas de Repsol reflejadas en Importación**, igual que AD Parts o Eni Live: Automoción,
  Industria, Productos de Mantenimiento, Marinos, Grasas, Alimentarios. Repsol mete todo el
  catálogo en una sola hoja dividida verticalmente por filas de sección — se detectan por
  **color de relleno** de celda (naranja = gama, rojo = subcategoría), no por texto, porque
  el texto solo no permite distinguir una gama de una subcategoría. Ver
  [ADR 0012](docs/decisiones/0012-gamas-repsol-por-color.md).
- La subcategoría (ej. "ENGRANAJES" dentro de Industria) se guarda como FAMILIA en el
  export, igual que ya hacía Eni Live.

### Nota
- Verificación encontró 13 filas de la tarifa de Repsol con SIRDI = "-" (literal) en vez de
  una referencia real — colisionan entre sí en el maestro (864 filas leídas → 851
  persistidas). No es un bug de la app; pendiente de aclarar con Repsol qué referencia
  llevan realmente esos 13 productos.

## [v0.8.2] — 2026-07-31

### Cambiado
- **Orden de las tarjetas de marca** en Importación: AD Parts, Repsol, Castrol, Shell,
  Eni Live, Racing Oil.
- **Mapa de rebranding integrado en el mismo dropzone de la tarifa**: se quita el botón
  "Cargar mapa de rebranding…" — ahora se arrastra al mismo sitio que cualquier tarifa y
  la app detecta sola si el Excel es un mapa de rebranding o una tarifa de proveedor (ver
  [ADR 0009](docs/decisiones/0009-rebrand-map.md)).
- **Exportación**: el selector de marca añade una opción "Ninguna", seleccionada por
  defecto — ya no se auto-selecciona la primera marca al entrar en la pantalla.

## [v0.8.1] — 2026-07-31

### Quitado
- Krafft eliminado del catálogo de marcas (`BRANDS`) — desaparece de Importación,
  Reglas, Comparación y Exportación.

### Cambiado
- **AD Parts Aceite y AD Parts Producto Químico se fusionan en una sola tarjeta
  "AD Parts"**, con 4 gamas (Normal / Standard / Sport Car / Químicos) en vez de dos
  marcas separadas. El perfil de químico (`profile-ad-parts-quimico.js`) sigue leyendo
  el mismo tipo de fichero, pero ahora registra sus filas bajo la gama `quimico` del
  mismo brand id `ad_parts_aceite` — una sola tarjeta en las 4 pantallas, historial y
  configuración de margen independientes por gama como ya ocurría entre Normal/Standard.

## [v0.8.0] — 2026-07-30

### Añadido
- **Segundo proveedor: Eni Live.** Perfil nuevo (`profile-eni.js`) que consolida las 9
  hojas de gama de la tarifa (i-Sint, i-Sigma, Rotra, Industria, i-Ride, Food-Line,
  Grasas, Forestal, Anticongelantes) en un solo import. Usa `TARIFA 2` como coste final
  por envase, con fallback a `TARIFA 1` fila a fila cuando no existe (ver ADR 0011).
- **Conversión kg→L por rango de peso** para las gamas que dan el formato en kg
  (Food-Line, Grasas, Forestal, Industria, Anticongelantes): el mismo envase nominal
  pesa distinto según el producto, así que se resuelve por rango en vez de por igualdad
  exacta. Detalle en [ADR 0011](docs/decisiones/0011-perfil-eni-live.md).
- Descripción de producto reconstruida con litros añadidos (Eni no los incluye en el
  nombre, a diferencia del resto de proveedores auditados).

### Cambiado
- `BRANDS.eni` pasa de "próximamente" a activo, con sus 9 gamas reales.

## [v0.7.2] — 2026-07-30

### Cambiado
- Botones del header más grandes (36px → 44px) y sus iconos bastante más grandes
  (16px → 22px) — apenas se distinguían antes.
- Revertido el color amarillo/azul del icono de tema que se había añadido en v0.7.1:
  todos los iconos del header se quedan en gris neutro, sin excepción.

## [v0.7.1] — 2026-07-30

### Arreglado
- Sidebar demasiado estrecho tras el v0.7.0: "Gestor de Tarifas" se cortaba y "Krafted by
  Yakoba Moreno" se partía en dos líneas dentro de su propia línea. Ensanchado
  (208px → 244px), padding interno ajustado y añadido `overflow-x: hidden` para que un
  desbordamiento puntual no muestre scrollbar horizontal en el sidebar.
- Botones del header (tema/ayuda/ajustes/login) se perdían contra el fondo gris de página
  al ser todos del mismo gris — ahora con fondo blanco/tarjeta y sombra, igual que el
  resto de superficies "elevadas" de la app (KPIs, tarjetas de marca). El botón de tema
  además colorea su icono (sol ámbar en claro, luna azul en oscuro) para distinguirlo.

### Cambiado
- El logo del sidebar pasa del wordmark "AD" a la gota de aceite con "€" que ya se usaba
  como favicon — mismo icono, dos sitios.

## [v0.7.0] — 2026-07-30

### Cambiado — pulido del sidebar y header compartido
- **Sidebar flotante estilo Finder de macOS**: esquinas redondeadas en las 4, sombra
  propia, separado del borde de la ventana en vez de pegado con línea recta.
- Reducido el padding interno del sidebar y quitado el `max-width` centrado del shell
  (creaba un hueco vacío a la izquierda en pantallas anchas); ahora ocupa el ancho real
  con un margen pequeño y deliberado alrededor.
- "Gestor de Tarifas" ya cabe en una sola línea (antes se partía en dos).
- **Header compartido en la zona de contenido**: título de la pantalla activa a la
  izquierda (se actualiza solo al navegar), y a la derecha botones de tema claro/oscuro
  (funcional), ayuda, ajustes y login (estos tres últimos son placeholders visuales —
  "que se lo pondremos" más adelante).
- **Toggle de tema manual**: además del automático por `prefers-color-scheme`, un botón
  en el header fija `data-theme` en `<html>` y lo recuerda entre sesiones (`js/core/theme.js`).
- **Logotipo real de AD / Recambios Ibiza** en el sidebar (mismo SVG que ya usa
  "Gestor de Rapels y Puntos", el proyecto hermano) + subtítulo "RECAMBIOS IBIZA",
  en vez del emoji genérico de bidón.
- **Crédito en el pie del sidebar** en dos líneas — "Krafted by **Yakoba Moreno**" /
  "Designed in **Claude Code**" — con la versión debajo, mismo texto que ya usa el
  proyecto hermano.

## [v0.6.0] — 2026-07-30

### Cambiado — sidebar de navegación y color por marca
- **Navegación pasa de pestañas arriba a sidebar lateral**, con un icono de color propio
  por sección (Importación azul, Reglas morado, Comparación verde azulado, Exportación
  naranja) — inspirado en referencias de dashboards que pidió Yako. En pantallas
  estrechas (<860px) el sidebar colapsa a una barra horizontal arriba, icono+texto.
- **Tarjetas de marca con icono de color** (abreviatura sobre un cuadrado de color propio
  por marca — `BRANDS[].color` en `js/core/brands.js`) en vez de tarjetas blancas lisas,
  para el efecto "visualmente llamativo" pedido sin perder limpieza.
- Iconos de navegación como SVG inline minimalistas (sin librería externa, siguiendo el
  principio de cero dependencias del ADR 0001).

### Verificación
- Confirmado en claro y oscuro, en escritorio ancho (sidebar vertical) y estrecho
  (barra horizontal), y navegando las 4 pantallas — sin errores de consola.

## [v0.5.1] — 2026-07-30

### Cambiado — rediseño visual
- **Pantalla Reglas ya no necesita scroll** para un caso típico: cada nivel de precio
  pasa de 5 filas apiladas (label a la izquierda, campo a la derecha) a una sola fila
  compacta con los 5 campos en columnas (label arriba, campo abajo).
- Mismo patrón compacto en las filas de filtro de Comparación y Exportación (Marca /
  Gama / Referencia / Nivel / Fecha en horizontal, no una fila entera por campo).
- Navegación entre pantallas rediseñada como control segmentado tipo pill (fondo con
  pestaña activa resaltada) en vez de pestañas subrayadas.
- Tarjetas (marca, KPI, nivel de precio, resultado de comparación) con esquinas más
  redondeadas y sombra suave consistente en toda la app.
- Tipografía y espaciados más densos en general (tamaño base, padding de tarjetas,
  márgenes) para una app más funcional a igual limpieza visual.
- Verificado que el modo oscuro automático (`prefers-color-scheme`) sigue funcionando
  correctamente con la nueva paleta.

### Arreglado
- Varios elementos (botón "Cargar mapa de rebranding", fórmula de margen, chips, toggle
  de modo, botones secundarios) usaban `--pico-secondary-background` asumiendo que era
  un gris claro sutil; en Pico v2 esa variable es en realidad un azul-gris sólido
  (`#525f7a`) pensado para botones, y daba mal contraste como fondo de superficie.
  Sustituido por tokens propios (`--surface-muted`, `--border-muted`, `--text-strong`)
  con sus propios valores para modo claro y oscuro.

## [v0.5.0] — 2026-07-29

### Añadido
- **Tres niveles de coste conviviendo**: `costFactura`, `costNetoNeto` (tras rappels) y
  `costTripleNeto` (tras rappels + soporte marketing) en el maestro multi-marca. La
  tarifa Repsol "con aportaciones" rellena los tres de una sola importación — auditadas y
  verificadas las fórmulas reales de las columnas P a Z (rappel incondicional, variable,
  volumen de grupo por densidad del producto, soporte marketing, descuento acumulado).
- `priceLevels.baseCost` gana un tercer valor, `'tripleNeto'` — seleccionable en la
  pantalla Reglas para cualquier marca/gama.
- `exportSkritV2` añade la columna `COSTE TRIPLE NETO` (10 columnas en total).
- El mismo perfil de Repsol detecta ambas variantes de tarifa (normal / con aportaciones)
  por texto de cabecera, sin que el usuario tenga que elegir dónde soltar cada una — se
  pueden arrastrar las dos a la misma zona de importación.

### Documentado
- ADR 0010 con el desglose columna a columna verificado numéricamente.

## [v0.4.1] — 2026-07-29

### Añadido
- **Soporte de rebranding Repsol**: la tarifa de agosto 2026 introdujo columnas `SIRDI
  NUEVO`/`NOMBRE NUEVO` — productos con nueva imagen, mismo producto por dentro. El perfil
  de Repsol ahora usa la ref/nombre nuevos cuando existen (fila a fila, 101 de 895
  productos ya rebrandeados en esa tarifa), descartando la referencia antigua tal como
  se pidió.
- **`RebrandMap`** (`js/core/rebrand-map.js`): mapa persistente ref antigua↔nueva por
  proveedor, cargado desde un Excel dedicado (botón "Cargar mapa de rebranding…" en
  Importación). Se generó `BASE DE CONOCIMIENTO/Equivalencias Rebranding Repsol.xlsx`
  con los 101 pares extraídos automáticamente de la tarifa de agosto.
- `History.diff()` acepta un tercer parámetro opcional `rebrandPairs`: una ref nueva sin
  match directo en el histórico, pero cuya ref antigua sí estaba, se trata como "estable"
  (chip "REBRAND" con tooltip del código anterior) en vez de nueva+desaparecida.

### Arreglado
- Sin el mapa de rebranding, comparar la tarifa Repsol de mayo vs. agosto mostraba 113
  falsas "nuevas" y 92 falsas "desaparecidas" por los productos rebrandeados. Con el mapa
  cargado: 35 nuevas / 14 desaparecidas / 816 estables (verificado con las tarifas reales).

### Documentado
- ADR 0009 sobre el mapa de rebranding.

## [v0.4.0] — 2026-07-29

### Añadido
- **Rediseño a 4 pantallas**: Importación / Reglas / Comparación / Exportación, navegación
  por hash (`#import`/`#rules`/`#compare`/`#export`), reflejando el workflow real de crear
  precios. Importación es el flujo de v0.1-v0.3.0 (drop zone, tabla, pestañas de gama)
  movido tal cual, más una cuadrícula de tarjetas con el estado de la última tarifa
  importada por marca.
- **Maestro persistente multi-marca** (`MasterDB`, IndexedDB): cada importación guarda
  sus filas fusionadas por ref, con dos niveles de coste posibles — `costFactura`
  (siempre) y `costNetoNeto` (nullable, se rellenará proveedor a proveedor conforme se
  audite su lógica de descuentos/rappels en próximas sesiones).
- **Niveles de precio configurables por marca/gama** (`priceLevels`, pantalla Reglas):
  PVP (siempre existe, migrado sin cambios desde la config previa), Precio Neto de Venta,
  y Precios para Bonus (uso interno de Yako para ventas especiales — nunca se exporta a
  Skrit, flag `goesToSkrit`).
- **Pantalla Comparación**: carga los 5 Excel de equivalencias de `BASE DE CONOCIMIENTO/`
  (dos formatos reales distintos, con carry-forward de especificaciones compartidas) y
  compara en vivo el precio de una referencia entre las marcas equivalentes que ya tengan
  tarifa en el maestro.
- **Pantalla Exportación**: layout unificado de 9 columnas (MARCA, REFERENCIA,
  MARCA+REFERENCIA, coste factura, coste neto-neto, precio del nivel elegido, familia,
  litros, descripción) leído directamente del maestro, para cualquier marca/gama/nivel.
- Catálogo `BRANDS` data-driven (abreviatura, gamas, prefijo de referencia) — añadir un
  proveedor nuevo a la cuadrícula de Importación es una entrada de array.

### Cambiado
- **Extracción de `app/index.html`** (~1557 líneas) a ficheros separados bajo `app/js/` y
  `app/css/` — scripts clásicos (no ES modules: fallan por CORS bajo `file://`), sin
  bundler. Regresión cero verificada contra los 4 ficheros reales ya usados en v0.3.0.
- `Pricing.compute()` generaliza su segundo argumento de "config plana" a "nivel de
  precio", con `baseCostField` configurable; sigue aceptando la config legacy tal cual.

### Arreglado
- Los niveles de precio calculados sobre el maestro (Comparación, Exportación) devolvían
  PVP vacío porque heredaban `baseCostField: 'costPerPack'` de la config legacy en vez de
  `costFactura`/`costNetoNeto` (los nombres de campo reales de las filas del maestro).
  Corregido remapeando `baseCostField` a partir de `baseCost` antes de calcular.

### Documentado
- ADR 0008 sobre el rediseño de 4 pantallas, el maestro multi-marca y `priceLevels`.
- `docs/arquitectura.md` actualizado con la nueva estructura de ficheros.

## [v0.3.0] — 2026-07-28

### Añadido
- **Soporte AD Parts Aceite** (marca propia, prioridad alta — hito que el roadmap marcaba
  como v0.2 y que había quedado pendiente). Dos gamas, **Normal** y **Standard**, mostradas
  en pestañas independientes (cada una con su propia configuración de margen, historial y
  export). Soporta los **dos formatos de entrada** que llegan según el mes:
  - "ENTRADA" crudo del proveedor: hojas `AD NORMAL` / `AD STANDARD` + `Tarifa` (join por
    `REF PROVEEDOR` sin el punto).
  - "de trabajo": hojas `Coste` / `ADStandard` / `CosteSC` (esta última añade una 3ª línea,
    **Sport Car**, que se muestra como pestaña adicional cuando está presente).
  - Prefijo `ADP` y columna `FAM` (`06` = Aceite Motor) en la salida Skrit.
- **Regla de litros por sufijo de referencia**: los últimos 3 dígitos de la referencia
  (sin puntos) son los litros del envase, con el caso especial `000` → 1000 L. Descubierta
  cruzando los Excel reales — es la única fuente fiable en la gama Standard, cuya
  descripción no varía entre formatos ("AD STANDARD SC 5W30" para 5L, 20L, 50L, 208L…).
  Ver ADR 0007.
- **Soporte AD Parts Producto Químico**: hoja `Coste` (+ `Coste-SC`) organizada en
  secciones por familia (AD Estándar, AD Plus, Líquido limpiaparabrisas…), litros
  extraídos de la descripción. Los precios escalonados por cantidad de la hoja `PVP`
  quedan fuera de alcance (solo interesa el coste base para el cálculo de margen).
- **PVP manual editable por fila**: cualquier referencia admite un PVP fijado a mano que
  sustituye al cálculo por margen (persistido junto a la config del proveedor/gama). Caso
  real: Albert fija a mano el PVP del formato 5L en AD Parts, y a veces también en
  formatos grandes.
- Parser: reconoce el apóstrofe como separador decimal (`"0'5L"`), visto en las
  referencias de Líquido de Frenos de AD Parts Químico.

### Cambiado
- **Refactor a "Supplier Profiles"** (cierre del ADR 0005, pendiente desde v0.1): `ExcelReader`
  pasa de llamar siempre a `readRepsol` a iterar un registro de perfiles (`RepsolProfile`,
  `ADPartsAceiteProfile`, `ADPartsQuimicoProfile`), cada uno con su propio `detect()`/`read()`.
  Sin cambios de comportamiento para Repsol.
- Config e historial pasan de una clave fija (`config_repsol`) a una clave por
  proveedor+gama. Repsol conserva su clave histórica (`config_repsol`, `history_repsol`)
  para no perder los márgenes ya guardados en v0.2.x.

### Nota sobre la numeración de versión
El roadmap marcaba AD Parts como el hito v0.2 (prioridad alta), pero el trabajo real de
v0.2/v0.2.1/v0.2.2 se dedicó a la comparativa histórica (ADR 0006) y a un fix de coste en
Repsol — AD Parts quedó pendiente hasta esta versión. Ver `docs/roadmap.md`.

## [v0.2.2] — 2026-07-21

### Arreglado (bug crítico)
- **Coste por envase en Repsol**: `PRECIO FACTURA` en Repsol es el precio de la
  unidad de compra (la caja completa), no del envase individual. La app tratábalo
  como coste por envase, inflando el PVP de todas las refs con más de una unidad
  por caja. Ahora divide `PRECIO FACTURA / UDS X CAJA` para obtener el coste real.
  Impacto: **295 refs de 830 (36%)** con UDS X CAJA > 1. Ejemplos:
  - `12X1L`, PRECIO FACTURA=102,17 € → coste real = **8,51 €** por botella (no 102,17).
  - `5X4L`, PRECIO FACTURA=154,77 € → coste real = **30,95 €** por garrafa (no 154,77).
  - `1X208L` y `1X1000L`: sin cambio (UDS=1).

### Cambiado
- **Event delegation** para los inputs de margen por formato: los cambios ahora
  disparan recálculo instantáneo aunque el panel se re-renderice. Se escuchan
  `input` (tecla a tecla) y `change` (blur/enter) para máxima robustez.

### Añadido
- Trazabilidad: cada fila conserva `costPerBox` (precio factura original de Repsol)
  y `costPerPack` (calculado). Actualmente solo se usa el segundo para todo, pero
  el primero queda disponible por si en el futuro se muestra en tabla o export.

## [v0.2.1] — 2026-07-21

### Arreglado
- Botones de modo (Sobre venta / Sobre compra) ahora en gris visible por defecto
  (antes solo se veían al pasar el ratón por encima). El activo se sigue mostrando
  en azul primario.
- Layout centrado y aprovechamiento del ancho de pantalla: `max-width` ampliado a
  1800px, `min-width: 0` en el `<main>` para evitar overflow, `overflow-x: hidden`
  en `body` como red de seguridad.
- Barra de filtros más compacta (padding 0,3rem, fuente 0,82rem).

### Cambiado
- Los KPIs se renombran a "Referencias Totales / Estables / Nuevas / Desaparecidas"
  para claridad.
- Se elimina la columna "Uds/caja" de la tabla — no es información útil para el
  usuario (Skrit solo quiere precio por envase). La app la usa internamente para
  calcular el coste correcto (ver v0.2.2).
- Input de litros en la tabla reducido a 68px, fuente 0,8rem — libera espacio.
- Subtítulo actualizado a v0.2.1.

## [v0.2] — 2026-07-21

### Añadido
- **Comparativa histórica entre tarifas del mismo proveedor.** Al cargar una nueva tarifa,
  la app la compara contra la última "vigente" guardada y muestra referencias:
  - **Totales** — nº de refs en la tarifa cargada.
  - **Estables** — refs que ya estaban en la vigente anterior. Se muestra tooltip con
    el coste anterior al pasar el ratón por la celda de coste.
  - **Nuevas** — refs que no aparecían en la anterior (badge azul "NUEVA" en la tabla,
    borde izquierdo de la fila).
  - **Desaparecidas** — refs que estaban en la anterior y ya no. Link "ver lista →"
    abre modal con las refs perdidas.
- **Módulo `History`** en `app/index.html`: guarda por proveedor en localStorage
  (`history_<supplier>`) las refs {ref, cost, liters, description} de la tarifa vigente.
- **Auto-guardado** de la tarifa vigente al pulsar "Exportar a Skrit".
- **Botón "Establecer como vigente"** para guardar sin exportar (útil para verificar
  antes de comprometer).
- **Filtro por estado** en la barra de filtros: "Todos / Solo nuevas / Solo estables".
- **Toggle Margen sobre Venta / sobre Compra.**
  - Sobre venta: `PVP = Coste / (1 − %/100)`. Por defecto.
  - Sobre compra: `PVP = Coste × (1 + %/100)`.
  - La fórmula visible en el panel se adapta al modo elegido.
- **Banner de contexto histórico** que indica "Comparando con la tarifa vigente
  del YYYY-MM-DD" o avisa si no hay tarifa previa.

### Cambiado
- **Dashboard reescrito**: los KPIs agregados de coste/PVP/margen medio se
  reemplazan por los 4 KPIs comparativos (Total, Estables, Nuevas, Desaparecidas).
- **Tabla preview**: nueva columna "Estado" con chip visual para refs nuevas.
- **Anchos de inputs**:
  - Buscador y filtro de formato con ancho suficiente para el placeholder.
  - Fecha de tarifa en fila ancha propia.
  - Input de litros en la tabla ampliado a 88px para "1000".
- **Botones secundarios** (`Guardar perfil`, `Cargar perfil`, `Establecer como vigente`,
  `Cargar otra tarifa`) ahora en gris claro visible por defecto, gris más oscuro al hover.
- **Panel de configuración** ampliado de 320px a 340px de ancho.

### Documentado
- ADR 0005 sobre "un workflow por proveedor" (supplier profiles).
- Actualización en `docs/arquitectura.md` con módulo History y notas sobre KPIs.

## [v0.1.1] — 2026-07-21

### Arreglado
- La tarifa Repsol de mayo 2026 (`Tarifa Repsol Lubricants - 06 mayo 2026.xlsx`) usa
  el nombre de columna **`SIRDI`** en lugar de `REF PROVEDOR`. La detección ahora
  reconoce ambos alias además de `REFERENCIA`, `REF` y `CODIGO`.
- La detección de la columna de nombre también acepta `PRODUCTO` y `DESCRIP*` como
  alias de `NOMBRE`.
- Mensaje de error de cabecera ausente ahora incluye la cabecera detectada para
  facilitar diagnóstico.

## [v0.1] — 2026-07-20

### Añadido
- MVP tarifador con importación de tarifa Repsol vía drag & drop.
- Parser de litros con reconocimiento de L, ML, GR, KG y patrón NxM (99,8% acierto vs. Skrit real).
- Configuración de margen sobre venta por formato con preview en vivo.
- Redondeo psicológico configurable (2 dec / ,99 / ,95 / múltiplo 0,05 / entero).
- Exportación a formato Skrit (5 columnas + fecha).
- Persistencia en localStorage + perfiles guardables por nombre.
- Filtros por texto libre y por formato en la tabla preview.
- Edición manual inline de litros en filas con detección fallida.
- KPIs agregados: nº refs, coste total, PVP total, margen medio real.

### Arquitectura
- Single-file HTML + SheetJS + Pico.css vía CDN.
- Módulos internos: Storage, Parser, ExcelReader, Pricing, ExcelWriter, UI.

### Documentado
- Reglas de negocio (heterogeneidad tarifas, litros/envase, casuística AD Parts, tasas).
- Roadmap por fases (Fase 0 → 4).
- ADR: single-file HTML.
- ADR: margen sobre venta vs. markup sobre coste.
- ADR: parser de litros con 5 patrones.

## [v0.0] — 2026-05-14

### Añadido
- Spec técnica en `BASE DE CONOCIMIENTO/tarifador-aceites-spec.md`.
- Ejemplos reales de entrada/salida Skrit para Repsol, AD Parts, Eni Live, Castrol, Racing Oil.
- Documento `CONSIDERACIONES/Consideraciones.docx` con casuísticas de negocio.
- Plan por fases acordado.
