# Arquitectura técnica

## Principio rector

**Portabilidad y simplicidad primero.** La app tiene que abrirse en Chrome haciendo doble click al archivo, sin servidor, sin instalación, sin build. Esto reduce fricción de despliegue y facilita empaquetarla luego en Electron sin reescribir lógica.

## Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| HTML/CSS | HTML5 + [Pico.css](https://picocss.com/) vía CDN | Estilos limpios sin framework pesado |
| Lógica | JavaScript vanilla (ES2020+) | Sin build, sin transpilación, portable |
| Excel I/O | [SheetJS](https://sheetjs.com/) `xlsx` vía CDN | Estándar de facto para leer/escribir XLSX en el navegador |
| Persistencia | `localStorage` (abstraída) | Sin backend, funciona offline |
| Distribución | Archivo único `app/index.html` | Portable, hosteable en GitHub Pages |

## Estructura de módulos internos

Aunque hoy es un solo HTML, el código está organizado en módulos-objeto que se pueden extraer a archivos separados sin cambiar la lógica:

```
Storage      ← capa de persistencia (get/set/list/delete). Hoy localStorage,
               mañana `fs` en Electron sin tocar el resto del código.

Parser       ← extracción de litros desde descripción libre. Reconoce
               L / ML / GR / KG y patrón NxM. Devuelve valor real (sin
               canonicalizar) para no perder formatos como 18L o 45KG.

ExcelReader  ← lectura específica por proveedor. Hoy solo `readRepsol()`.
               Se añade un método por proveedor (`readCastrol`, `readEni`…)
               con detección automática por nombre de archivo o firma de
               columnas.

Pricing      ← cálculo de PVP a partir de coste + margen sobre venta y
               redondeo configurable. Fórmula: PVP = Coste / (1 − %/100).

ExcelWriter  ← generación del Excel de salida en formato Skrit
               (5 columnas invariantes + fecha).

UI           ← estado global, listeners, renderizado. Orquesta a los
               otros módulos.
```

## Flujo de datos

```
[Excel proveedor .xlsx]
        │
        ▼
    ExcelReader.read()
        │  ┌─ workbook (SheetJS)
        │  └─ detecta proveedor por nombre archivo / firma columnas
        ▼
    { supplier, rows[], sheetUsed }   ← filas normalizadas:
        │                                { ref, description, liters,
        │                                  formatKey, unitsPerBox,
        │                                  costPerPack, litersDetected }
        ▼
   [State.rows en memoria + Storage.get('config')]
        │
        ▼
   Pricing.compute(row, config)  ← margen + redondeo
        │
        ├─▶  Preview en tabla (KPIs, filtros, edición inline)
        │
        └─▶  ExcelWriter.exportSkrit()  →  [tarifa-skrit-repsol-YYYY-MM-DD.xlsx]
```

## Decisiones arquitectónicas clave

Están en [decisiones/](decisiones/) como ADRs (Architecture Decision Records). Cada decisión tiene contexto, alternativas consideradas y consecuencias:

- [0001 · Single-file HTML sobre framework SPA](decisiones/0001-single-file-html.md)
- [0002 · Margen sobre venta como modelo por defecto](decisiones/0002-margen-sobre-venta.md)
- [0003 · Parser de litros por regex sobre descripción](decisiones/0003-parser-litros.md)
- [0004 · GitHub Pages para publicación](decisiones/0004-github-pages.md)

## Preparación para Electron (fase futura)

Cuando la app crezca lo suficiente para justificar un ejecutable de escritorio, la migración a Electron requiere solo:

1. Separar los módulos en archivos JS individuales (5 minutos, ya están escritos así).
2. Sustituir `Storage.get/set` (localStorage) por `Storage.get/set` (fs + JSON files). La interfaz pública no cambia.
3. Envolver `index.html` en un `BrowserWindow` de Electron.
4. Añadir un `package.json` mínimo y `electron-builder` para generar `.exe` / `.dmg` / `.AppImage`.

El resto del código (parser, pricing, writer) es agnóstico del entorno.

## No usado deliberadamente

Se evitaron a propósito estas tecnologías para no romper portabilidad:

- **React / Vue / Svelte / Next**: obligan a build step y `node_modules`.
- **TypeScript**: idem (aunque futuro razonable).
- **Tailwind con compilador**: idem. Se usaría solo la versión CDN si se necesitara.
- **Backend / API propia**: ninguna operación requiere servidor; añadirlo sería complicar.
- **IndexedDB**: `localStorage` es suficiente para los volúmenes esperados (< 100 KB de configuración).

Si en el futuro alguna de estas decisiones se revierte, tiene que documentarse como nuevo ADR.
