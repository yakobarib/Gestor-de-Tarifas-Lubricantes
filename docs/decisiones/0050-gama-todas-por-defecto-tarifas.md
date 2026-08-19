# ADR 0050 — "Todas las gamas" por defecto al cambiar de marca en Tarifas

**Fecha:** 2026-08-19
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Al cambiar de marca en el selector de Tarifas, la pantalla se abría en la **primera**
gama de esa marca (ej. "Normal" en AD Parts, "Automoción" en Repsol) — distinto según la
marca, y sin ningún indicio visual de que hubiera más gamas hasta fijarse en las
pestañas. Yako pide que el comportamiento sea el mismo para cualquier marca: abrir
siempre en "Todas".

## Decisión

`setupListeners()` (`screen-tarifas.js`), en el cambio del selector de marca: en vez de
`currentGama = brand.gamas[0]`, pasa a `currentGama = '__all__'` para cualquier marca con
gamas. No afecta al salto automático desde Importación (`jumpToLoaded()`), que sigue
abriendo la gama concreta que se acaba de cargar — ahí sí tiene sentido mostrar
justo lo que se importó, no "Todas".

## Verificación

Cambiar el selector de marca a AD Parts y luego a Repsol: en ambos casos la pestaña
activa es "Todas" (`data-gama="__all__"`), confirmado leyendo la pestaña con la clase
`active` tras el cambio. Consola sin errores.

## Referencias

- `js/screens/screen-tarifas.js`.
