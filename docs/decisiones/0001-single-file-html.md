# ADR 0001 — Single-file HTML sobre framework SPA

**Fecha:** 2026-05-14
**Estado:** Aceptada
**Decidido por:** Yako + Claude

## Contexto

Necesitamos una app de escritorio ligera para transformar tarifas Excel de proveedores. El uso es diario, por una sola persona, y el ciclo de iteración debe ser rápido. No hay backend ni multi-usuario en el horizonte.

Las opciones evaluadas:

1. **Single-file HTML + JavaScript vanilla + librerías CDN.**
2. **React/Vue SPA con build (Vite, Next).**
3. **Electron desde el día uno.**
4. **App Python con GUI (Tkinter, PyQt) o web (Streamlit, Flask).**

## Decisión

**Opción 1: Single-file HTML.**

## Motivación

- **Cero fricción de despliegue**: doble click al `.html` en Chrome y funciona. Sin `npm install`, sin build, sin servidor.
- **Portable**: cabe en un pendrive, se hostea gratis en GitHub Pages, se comparte por email.
- **Preparado para Electron**: cuando la app crezca lo suficiente, envolver `index.html` en un `BrowserWindow` es trivial. La lógica no cambia.
- **Ciclo de iteración instantáneo**: guardas el archivo, refrescas navegador, ves el cambio. Sin espera de bundler.
- **Sin dependencia de toolchain**: no hay riesgo de que Node/npm/Vite se rompa entre versiones.

## Consecuencias

### Positivas
- Menor tiempo hasta primera versión funcional (conseguido: v0.1 en un día).
- Barrera de entrada baja para futuras iteraciones.
- Distribución trivial via GitHub Pages.

### Negativas / trade-offs aceptados
- Sin TypeScript, sin tests automáticos out-of-the-box.
- Un solo archivo grande (hoy ~700 líneas). A partir de ~1500 líneas se plantea la extracción a módulos separados.
- Sin componentes reutilizables al estilo React. Se usa creación manual de DOM con `document.createElement`, lo cual es más verboso.

### Mitigaciones
- El código interno **ya está modularizado** en objetos (Storage, Parser, ExcelReader, Pricing, ExcelWriter, UI). Extraerlos a archivos separados es un `split` mecánico sin cambiar la lógica.
- Se pueden añadir tests con Vitest o Jest en el futuro sin cambiar el runtime.

## Alternativas descartadas y por qué

- **React SPA (Vite)**: overkill para el uso; obliga a build step y `node_modules` de cientos de MB.
- **Electron desde v0**: prematuro. Añade complejidad de empaquetado antes de saber si la app tiene tracción.
- **Python + Streamlit**: obliga a que Yako tenga Python instalado y a arrancar un servidor local; peor UX que doble click al HTML.

## Reversibilidad

Alta. Si en Fase 3 o 4 la app se vuelve demasiado grande para un solo archivo, la migración a Vite + Vue/React es incremental: primero se extraen los módulos a archivos separados, luego se añade el build tooling.

## Referencias

- [Spec técnica original](../../BASE%20DE%20CONOCIMIENTO/tarifador-aceites-spec.md)
- [docs/arquitectura.md](../arquitectura.md)
