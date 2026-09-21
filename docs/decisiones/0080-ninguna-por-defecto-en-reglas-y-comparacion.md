# ADR 0080 — "Ninguna" por defecto en Reglas y Comparación al entrar desde otra pestaña

**Fecha:** 2026-09-21
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Siguiendo la revisión de ADR 0079 (Comparación reinicia por completo al volver a la
pantalla), Yako pidió lo mismo para Reglas, y de paso una pieza que faltaba en ambas: el
selector de Marca no tenía opción **"Ninguna"** — siempre caía en la primera marca de la
lista, con el riesgo real en Reglas de editar el margen de una marca sin darse cuenta de
cuál era, justo al volver de otra pestaña.

Al investigar Reglas se encontró un problema más serio que el cosmético: con
`currentBrandId` vacío, `renderLevels()` seguía adelante igual que con una marca real —
`loadConfig`/`migrateLevels` podían llegar a **guardar un `pricing_rules` con `brand_id:
''` en Neon**, no solo mostrar un dato raro en pantalla.

## Decisión

**Reglas** (`screen-rules.js`):
- `renderBrandSelect()` añade `<option value="">Ninguna</option>` como primera opción;
  ya no se auto-selecciona la primera marca real si `currentBrandId` está vacío.
- `renderGamaSelect()` corta explícito antes de nada si no hay marca elegida: gama a
  "—" deshabilitada, y `renderNoLevelsState()` (nueva) limpia el selector de nivel, la
  leyenda y las tarjetas sin llamar a `loadConfig`/`migrateLevels`/`saveConfig` — así no
  hay ninguna vía para que se guarde nada con `brand_id` vacío.
- `renderLevelSelect()` se asegura de reactivar el `<select>` (`disabled = false`) al
  volver a una marca real, por si se quedó deshabilitado del estado "sin marca".
- Nuevo listener `Store.on('screen:changed', ...)` para `'rules'`: resetea
  `currentBrandId` a `null` y repinta — mismo criterio que Comparación (ADR 0079).

**Comparación** (`screen-compare.js`): mismo patrón — `renderBrandSelect()` añade
"Ninguna", y `renderGamaSelect()` corta explícito a un estado vacío (gama "—"
deshabilitada, referencia "Elige una marca primero" deshabilitada) en vez de seguir
adelante con un `currentBrandId` vacío hasta `renderRefOptions()` (que antes habría
consultado `MasterDB.getByBrand('', ...)` sin sentido, aunque sin llegar a romper nada).
El reinicio en `screen:changed` de ADR 0079 ya dejaba `currentBrandId = null` — ahora esa
reconstrucción del `<select>` sí tiene un "Ninguna" real al que caer, en vez de recaer en
la primera marca de la lista por no haber otra opción.

## Verificación

- `node --check` sobre `screen-rules.js` y `screen-compare.js`.
- Revisados `saveAsTemplate`/`resetToTemplate` (botones de Plantillas) — ya cortaban con
  `if (!brand) return`, seguros sin marca elegida, sin cambios ahí.

## Referencias

- ADR 0079 (mismo espíritu — reinicio completo en vez de estado a medias).
- `js/screens/screen-rules.js`, `js/screens/screen-compare.js`.
