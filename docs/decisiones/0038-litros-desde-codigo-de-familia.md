# ADR 0038 — Litros de respaldo desde el código de familia ("CG-400" → 0,4 L)

**Fecha:** 2026-08-14
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

En Repsol, la referencia RP610Q48 ("EV-FLUIDS COMPLEX SYNTH GREASE CG-400") salía sin
litros en la previsualización de Exportación. `Parser.extractLiters` solo reconoce
tamaño cuando la descripción trae un patrón "NxM" o "número+unidad" explícito (12X1L,
500ML, 208L…); "CG-400" es un código de familia de producto, sin unidad, así que ningún
patrón existente lo detectaba — comportamiento correcto para lo que el parser sabía
hacer, pero el dato real SÍ existe: Yako confirma que ese sufijo ("-400" y similares) es
el peso en gramos del envase — para la app, equivalente a 400 ML = 0,4 L (misma
equivalencia 1g≈1ml que ya usa `toLiters` con GR/KG).

## Decisión

Nuevo "Patrón 3" en `Parser.extractLiters`, como último respaldo (solo si ningún patrón
anterior encontró nada): busca `[A-Z]{1,6}-(\d{2,4})` al final de la descripción,
precedido de un límite de palabra real (espacio o inicio de cadena, no pegado a otra
letra como en "12xT-150"), y lo interpreta como gramos → litros. Salvaguardas:

- **Excluye viscosidades**: si el código antes del guion es un patrón `\dW` (ej.
  "5W-40", "10W-60"), se descarta — es una viscosidad, no un tamaño de envase.
- **Rango razonable**: el número debe caer entre 50 y 2000 (mismo rango que los otros
  dos patrones), para no colar códigos de catálogo que no sean pesos reales.
- Solo se activa cuando `candidates.length === 0` — nunca sustituye un litraje ya
  detectado por los patrones 1/2 (NxM, número+unidad explícita).

No se generaliza a códigos tipo "T-150"/"T-250" (vistos en productos WIZARD de limpieza,
en la misma tarifa) porque no están precedidos de un límite de palabra real (van pegados
a la "x" del multiplicador, "12xT-150") y, sobre todo, porque Yako no ha confirmado que
sigan la misma convención de gramos — se deja para revisar aparte si aparece de nuevo.

## Verificación

`Parser.extractLiters('EV-FLUIDS COMPLEX SYNTH GREASE CG-400')` → `0.4`,
`Parser.formatLabel(0.4)` → `"400 ml"` (coincide exactamente con lo que Yako esperaba).
Comprobado que no rompe nada existente: `"RACING 4T 5W-40 5X4L"` → 4,
`"RACING 4T 10W-60 12X1L"` → 1, `"RACING 4T 15W-50 1X60L"` → 60 (sin cambios). Casos de
salvaguarda: `"ALGO RARO 10W-60"` (viscosidad sin tamaño real) → `null` (correctamente
excluido), `"PRODUCTO XX-9999"` / `"PRODUCTO XX-30"` (fuera del rango 50-2000) → `null`.
Revisado el fichero de ejemplo real de Repsol (830 referencias): solo esta referencia
tenía este patrón exacto de código-sin-unidad; el resto de casos sin litros detectados
(aerosoles con "AERO300ml" pegado, o "L-18" con la unidad antes del número) quedan fuera
de este ADR, sin tocar.

## Consecuencias

- `js/core/parser.js`: nuevo patrón de respaldo en `extractLiters`, usado por todos los
  perfiles de lectura (hoy solo Repsol tiene casos reales de este tipo, pero el resto de
  marcas se benefician igual si aparece un caso similar).

## Referencias

- `js/core/parser.js`, `js/profiles/profile-repsol.js` (usa `extractLiters` sin cambios).
