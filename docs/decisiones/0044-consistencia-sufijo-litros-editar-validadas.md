# ADR 0044 — Sufijo de litros homogéneo y editar validaciones ya guardadas

**Fecha:** 2026-08-17
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Al validar `ADP33005` en el panel del ADR 0043, Yako notó que su descripción quedó sin
litros en el texto ("SHT 0W30 High Tech"), mientras que el resto del maestro de AD Parts
sí los lleva ("DS3 SAE 30 5L"). Le da igual el formato exacto siempre que los cálculos
sean correctos, pero **no quiere inconsistencias entre referencias** — quiere que sea
siempre igual. También pide poder corregir una referencia que ya validó (hoy el panel
solo lista las pendientes).

Al construir la corrección se encontró además un bug real: guardar una validación no
persistía en el maestro (IndexedDB) — solo quedaba en memoria (se perdía al recargar) y
en `DescriptionOverrides`, que solo se aplica en la siguiente importación real. Yako
podía validar algo, recargar la página, y verlo como si nunca se hubiera guardado.

## Decisión

### Sufijo de litros siempre igual

`saveDescValidation()` (`screen-tarifas.js`) ya no guarda el texto tal cual lo escriba
Yako: quita cualquier tamaño que ya lleve al final (`stripTrailingSizeToken`, mismo
patrón de unidades que `Parser.extractLiters`) y añade siempre el mismo sufijo
canónico — `"5L"`/`"1000L"` (sin espacio, mayúscula) o `"230ML"` por debajo de 1L — igual
para cualquier marca. Esto iguala el criterio que ya seguía la mayoría del maestro de
fábrica (AD Parts, AD Standard, Castrol, Eni Live, Repsol, Shell); solo Racing Oil no
lleva el tamaño en el texto en las entradas que ya venían validadas en su Excel original
— esas no se toca (no se reescribe el maestro de fábrica sin que Yako lo pida), pero
cualquier corrección NUEVA de Racing Oil desde ahora sí llevará el sufijo, como el resto.

### Editar referencias ya validadas

El modal de validación gana dos pestañas — "Pendientes (N)" / "Ya validadas (M)" — y un
buscador (solo en la de validadas, para no tener que desplazarse entre cientos de filas).
Editar una fila ya validada escribe en `DescriptionOverrides` igual que una pendiente
(nunca toca `MasterDescriptions`, el maestro de fábrica) — así que sigue siendo
reversible y sigue el mismo camino de "hay que pedir que se incorpore" del ADR 0043.

### Bug real corregido: la validación no persistía

`saveDescValidation()` solo actualizaba la fila en memoria (`rows`) y
`DescriptionOverrides` — nunca el registro de IndexedDB. Ahora, tras guardar, se llama a
`MasterDB.putRows(brandId, row.gama, [{ref}], null)` (mismo camino que usa la migración
de una vez del ADR 0043) para que la corrección quede en el maestro al instante, no solo
la próxima vez que se reimporte esa tarifa.

## Verificación

Validar `ADP99998` sin escribir el sufijo ("SHT 0W30 HIGH TECH") queda guardado como
"SHT 0W30 HIGH TECH 5L". Pestaña "Ya validadas" muestra `ADP10005` (verificada de
fábrica); buscar "ADP10005" filtra a esa única fila; editarla (con un guion suelto en
medio, sin sufijo) escribe un override — `MasterDescriptions` sigue devolviendo el
original de fábrica sin tocar, confirmando que la edición no reescribe el maestro. Antes
del fix de persistencia: recargar la página después de validar `ADP99998` la devolvía a
"pendiente" (la descripción volvía a la del proveedor). Después del fix: recargar
conserva `descVerified: true` y la descripción corregida, leído directamente de
IndexedDB. Consola sin errores en ninguna prueba.

## Consecuencias

- `js/screens/screen-tarifas.js`: `stripTrailingSizeToken`/`canonicalLitersSuffix`,
  pestañas + buscador en el modal, `saveDescValidation` ahora asíncrona y persiste en
  `MasterDB`.
- `app/index.html`/`app/css/styles.css`: pestañas y buscador del modal (reusa
  `.mode-toggle`/`.mode-btn`, ya existentes).

## Referencias

- `js/screens/screen-tarifas.js`, `js/core/db.js`, `js/core/migration.js`.
- [ADR 0043](0043-maestro-de-descripciones-verificadas.md) (maestro de descripciones,
  base de este ADR).
