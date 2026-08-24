# ADR 0058 — "Todas" también al saltar de Importación a Tarifas

**Fecha:** 2026-08-24
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

ADR 0050 puso "Todas las gamas" por defecto al cambiar de marca a mano en Tarifas, pero
dejó explícitamente el salto automático desde Importación (`jumpToLoaded()`) abriendo la
gama concreta recién importada — el razonamiento de entonces era que, viniendo de
importar, tiene sentido ver justo lo que se acaba de cargar.

Yako reporta que esto le resulta confuso en la práctica (lo notó con Racing Oil y antes
con Castrol): tras importar, la pantalla no se abre en "Todas" sino en la primera gama de
la lista de esa marca, igual que pasaba con el selector de marca antes de ADR 0050.

## Decisión

Se unifica: **"Todas" también al saltar desde Importación** — una sola regla, sin la
excepción que dejó ADR 0050. `jumpToLoaded()` pone `currentGama = '__all__'` en vez de
`loaded.gamas[0]`.

## Referencias

- ADR 0050 (el comportamiento que esto sustituye).
- `js/screens/screen-tarifas.js`.
