# ADR 0040 — "Margen por defecto" en vivo y resaltado de valores puestos a mano

**Fecha:** 2026-08-14
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

En Reglas, al cambiar "Margen por defecto" las casillas de margen por formato que no
tienen un valor propio deberían seguir ese cambio en vivo — pero no lo hacían. Además,
Yako pide que las casillas SÍ modificadas a mano se distingan visualmente (fondo gris
medio + negrita), tanto en PVP como en Netos Bonus.

Dos causas distintas:

1. **Bug de refresco**: el listener de "change" de `levelsContainer` solo llamaba a
   `renderLevels()` tras cambiar `goesToSkrit`/`baseCost` — no tras `defaultMargin`. El
   `placeholder` de las casillas vacías (que muestra el margen por defecto) se queda
   congelado con el valor con el que se pintó la tabla la última vez, hasta que algo
   fuerce un repintado completo (cambiar de gama, por ejemplo).
2. **Semilla de fábrica indistinguible de un valor manual**: al crear Netos Bonus por
   primera vez, `byFormat`/`premiumByFormat` se rellenaban con un margen/obsequio fijo
   por tamaño (20%/15% de margen, 50€/100€ de obsequio para bidones/cubas, ver ADR 0016)
   — guardado exactamente igual que si Yako lo hubiera escrito a mano. Esas casillas
   nunca estaban realmente "vacías", así que jamás iban a seguir el valor por defecto,
   aunque Yako nunca las tocara.

## Decisión

- `setupListeners()` (`screen-rules.js`): `defaultMargin` se añade a la lista de campos
  que fuerzan `renderLevels()` — el placeholder de las casillas vacías se actualiza al
  instante.
- Las casillas de "Margen (%)" y "Obsequio (€)" añaden la clase `has-value` cuando
  tienen un valor explícito guardado — fondo gris medio (`#e2e4e8` claro / `#3a3f47`
  oscuro) y negrita (ver CSS, mismo patrón de 3 reglas para tema claro/oscuro/explícito
  que el resto de la app). Al escribir o borrar una casilla, la clase se activa/
  desactiva sobre el propio `<input>` (sin `renderLevels()` completo, para no perder el
  foco/tabulación al rellenar varias celdas seguidas — a diferencia de `defaultMargin`,
  que sí necesita repintar toda la fila porque afecta al placeholder de las demás).
- `defaultNetosBonusLevel()` deja de sembrar `byFormat`/`premiumByFormat` con la semilla
  fija — empiezan vacíos (`{}`), cada formato sigue "Margen por defecto" hasta que Yako
  escriba algo a mano.
- **Migración de datos ya guardados** (`migration.js`, flag `migrated_v2_clear_bonus_seed`,
  corre una sola vez): recorre todas las configs guardadas y, en el nivel Netos Bonus de
  cada una, borra las entradas de `byFormat`/`premiumByFormat` que coinciden EXACTAMENTE
  con el valor de semilla original de ese formato — si Yako tocó una casilla a mano
  (aunque el resultado coincida con otro formato), se queda igual; solo se limpia lo que
  nunca se tocó desde que se creó el nivel. Decisión explícita de Yako tras preguntarle.

## Verificación

Con una config de prueba que mezcla semilla sin tocar (185/200/205/208/209/1000) y un
valor realmente puesto a mano (600 → 42% margen, 77€ obsequio): tras la migración, solo
sobrevive `{600: 42}`/`{600: 77}` — el resto vuelve a estar vacío y sigue "Margen por
defecto" en vivo. Comprobado con la tabla de Netos Bonus renderizada: el formato 208
(semilla borrada) sale sin valor y sin resaltar; el 600 (manual) sale con su valor y con
`has-value` (fondo gris, negrita). Cambiar "Margen por defecto" de un nivel actualiza al
instante el placeholder de las casillas vacías, sin tocar las que ya tienen valor.
Confirmado que editar una casilla concreta no dispara un repintado completo de la tabla
(el nodo del input sigue siendo el mismo tras el cambio) — no se pierde el foco al
rellenar varias celdas con Tab. Consola sin errores en todas las pruebas.

## Consecuencias

- `js/screens/screen-rules.js`: `defaultNetosBonusLevel()` sin semilla; clase
  `has-value` en los inputs de margen/obsequio; `defaultMargin` fuerza `renderLevels()`.
- `js/core/migration.js`: nueva migración de una vez, `clearUntouchedBonusSeed()`.
- `css/styles.css`: `.format-table td input[type="number"].has-value`.

## Referencias

- `js/screens/screen-rules.js`, `js/core/migration.js`, `css/styles.css`.
- ADR 0016 (semilla original de Netos Bonus), [ADR 0037](0037-obsequio-por-formato-netos-bonus.md)
  (fila de Obsequio, mismo `data-index` que este ADR reutiliza para el resaltado).
