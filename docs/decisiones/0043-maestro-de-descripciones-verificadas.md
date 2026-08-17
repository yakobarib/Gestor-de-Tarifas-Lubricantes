# ADR 0043 — Maestro de descripciones y litros verificados (autosuficiente)

**Fecha:** 2026-08-17
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako preparó, para las 6 marcas, un Excel por marca con referencia/descripción/litros
que ha contrastado a mano como correctos ("Descripciones Válidas/", 2026-06) — 3.284
referencias en total. Quiere que la app los use para que la misma referencia muestre
siempre la misma descripción y litros verificados (en vez de lo que traiga cada tarifa
de proveedor ese mes), preguntando (con un panel de validación, no un modal por
referencia) por las que no estén todavía en el maestro, y que todo esto sea
**autosuficiente**: nada de depender de subir esos Excel cada vez, ni de un servicio en
la nube (rechazado explícitamente por Yako: no quiere expuestos los datos de la app en
un servicio gratuito).

## Decisión

### Datos de fábrica incrustados en el código

Los 7 Excel se convierten, una sola vez, en `app/js/data/master-descriptions.js` — un
objeto JS `DATA[brandId][ref] = [descripcion, litros]`, cargado con `<script>` clásico
(no `fetch`, que fallaría al abrir la app con `file://` sin servidor — ver ADR 0002/0004)
junto a un `lookup(brandId, ref)`. Ajustes al convertir:

- **Castrol**: se añade el prefijo `CAT` a cada referencia — internamente la app siempre
  lo antepone (`ref: 'CAT' + codigo`, ver `profile-castrol.js`), pero el Excel de Yako
  trae el código "limpio".
- **Racing Oil**: 79 filas duplicadas exactas se descartan (quedan 733 referencias
  únicas); los litros venían como texto ("230ml", "5L") y se convierten a número con la
  misma lógica que ya usa `profile-racing-oil.js::parseEnvase` (ml/1000, g/1000, kg tal
  cual). Un producto sin litraje real (accesorio "BOBINA DE PAPEL") queda con
  `litros: null` — descripción verificada, pero sin litros que verificar.
- **Shell**: 1 fila duplicada exacta se descarta (483 referencias únicas).
- **AD Parts Normal + AD Standard**: se fusionan en un único mapa para `ad_parts_aceite`
  (misma marca, dos gamas — la clave del maestro es solo marca+referencia, sin gama, ver
  conversación previa con Yako).
- Repsol y Eni Live: tal cual, ya venían limpios (0 duplicados).

### Dónde se consulta

`MasterDB.putRows()` (el único punto por el que pasan las filas de CUALQUIER perfil
antes de guardarse) consulta, para cada referencia: primero `DescriptionOverrides` (la
corrección más reciente hecha a mano en este navegador, si la hay), si no
`MasterDescriptions` (el maestro de fábrica). Si hay resultado, sustituye
`description`/`liters`/`formatKey`/`litersDetected` por la versión verificada y marca
`descVerified: true`; si no hay ninguna coincidencia, se queda con la detección
automática de siempre (sin cambio de comportamiento) y `descVerified: false`.

### Panel de validación en Tarifas (no un modal por referencia)

Banner `#descValidationBanner`, debajo del banner de histórico — parpadea en amarillo
pastel (mismo patrón que el aviso de errores de Exportación, ADR 0034) mientras
`pendingDescRows()` (filas de la marca/gama actual con `descVerified: false`) no esté
vacío, y se calma en cuanto todas quedan validadas. Al hacer clic abre un modal ancho
(`.modal-wide`) con una fila por referencia pendiente: ref, descripción detectada
automáticamente (de referencia), e inputs editables de descripción y litros + botón
Guardar. Al guardar: se escribe en `DescriptionOverrides` (localStorage, por marca+ref),
se actualiza la fila en memoria (`rows`) sin recargar de IndexedDB, y desaparece de la
lista pendiente — si era la última, el modal se cierra solo.

### Aviso de que las correcciones no viajan solas entre dispositivos

Decisión explícita de Yako tras valorar las alternativas (escribir directo a GitHub
desde el navegador con una clave de escritura guardada en el dispositivo, o un backend
en la nube): las correcciones se quedan en `localStorage` de ese navegador hasta que
Yako pida expresamente que se incorporen a `master-descriptions.js` y se suban al
repositorio. Para que no se olvide, `#descOverridesNotice` (visible en Tarifas
independientemente de la marca que se esté viendo) muestra siempre cuántas correcciones
hay pendientes de incorporar (`DescriptionOverrides.countAll()`), y el propio modal de
validación repite el aviso al abrirse.

### Migración de filas ya importadas

Sin este paso, cualquier referencia importada ANTES de esta versión se vería como
"pendiente de validar" hasta la próxima vez que se reimporte esa tarifa, aunque
realmente ya esté en el maestro nuevo. `Migration.run()` (ahora asíncrona — `app.js`
espera a que termine antes de inicializar las pantallas) añade un paso de una sola vez
(`migrated_v3_apply_master_descriptions`) que reutiliza `MasterDB.putRows()` sobre todas
las filas ya guardadas, agrupadas por marca+gama — mismo camino que un import real, sin
tocar los costes ya guardados.

## Verificación

Fila con ref en el maestro (`ADP10005`): al guardar, la descripción pasa de la del
import (`"DS3 SAE 30 5L RAW"`) a la verificada (`"DS3 SAE 30 5L"`), `descVerified: true`.
Fila con ref no verificada: aparece en el banner parpadeante ("1 referencia sin
descripción verificada"), se corrige desde el modal, el override queda en
`localStorage`, el banner se calma, y el aviso persistente pasa a "1 corrección... pide
que se incorporen al maestro". Reimportar esa misma referencia con un texto de proveedor
distinto NO sobrescribe la corrección (el override manda). Migración probada con una
fila "vieja" (sin `descVerified`, con texto sin limpiar) ya en IndexedDB: tras vaciar el
flag y recargar, queda actualizada a la descripción del maestro con `descVerified: true`,
sin tocar el coste. Consola sin errores en ninguna prueba.

## Consecuencias

- Nuevo `app/js/data/master-descriptions.js` (~143 KB, 3.284 referencias, generado una
  vez desde los Excel de Yako — para añadir más hay que editar este fichero a mano y
  hacer commit, no hay proceso automático).
- Nuevo `app/js/core/description-overrides.js`.
- `app/js/core/db.js`: `putRows()` aplica la verificación; nuevo campo `descVerified`.
- `app/js/core/migration.js`/`app/js/app.js`: migración asíncrona de filas ya
  importadas.
- `app/js/screens/screen-tarifas.js`, `app/index.html`, `app/css/styles.css`: banner +
  modal de validación, aviso persistente de correcciones sin incorporar.

## Referencias

- `js/data/master-descriptions.js`, `js/core/description-overrides.js`,
  `js/core/db.js`, `js/core/migration.js`, `js/screens/screen-tarifas.js`.
- [ADR 0034](0034-homogeneizacion-exportacion.md) (patrón de aviso parpadeante
  reutilizado aquí), [ADR 0038](0038-litros-desde-codigo-de-familia.md) (detección de
  litros por regex, sigue siendo el respaldo cuando una ref no está en el maestro).
