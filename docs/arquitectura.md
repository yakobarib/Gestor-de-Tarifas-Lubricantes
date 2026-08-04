# Arquitectura técnica

## Principio rector

**Portabilidad y simplicidad primero.** La app tiene que abrirse en Chrome haciendo doble click al archivo, sin servidor, sin instalación, sin build. Esto reduce fricción de despliegue y facilita empaquetarla luego en Electron sin reescribir lógica.

## Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| HTML/CSS | HTML5 + [Pico.css](https://picocss.com/) vía CDN | Estilos limpios sin framework pesado |
| Lógica | JavaScript vanilla (ES2020+) | Sin build, sin transpilación, portable |
| Excel I/O | [SheetJS](https://sheetjs.com/) `xlsx` vía CDN | Estándar de facto para leer/escribir XLSX en el navegador |
| Persistencia — config/historial | `localStorage` (abstraída vía `Storage`) | Datos pequeños, sin backend, funciona offline |
| Persistencia — maestro multi-marca | `IndexedDB` (abstraída vía `MasterDB`) | Volumen mayor (7 proveedores × filas completas), necesita lecturas cruzadas en tiempo real (pantalla Comparación) |
| Distribución | `app/index.html` + `app/css/` + `app/js/` (scripts clásicos, sin bundler) | Portable, hosteable en GitHub Pages, abre por doble click con `file://` |

## Estructura de ficheros (desde v0.4.0)

Desde v0.4.0 el código se extrajo de un único HTML a ficheros separados, cargados como
`<script src>` clásicos (NO `type="module"`: los módulos ES nativos fallan por CORS al
abrir el HTML directamente con `file://`, un modo de uso real). Cada fichero declara un
`const NombreModulo = (() => {...})();` de nivel superior — todos los `<script>` clásicos
de una misma página comparten el mismo entorno léxico, así que el orden de carga en
`index.html` es la única "resolución de dependencias" (documentado ahí mismo).

```
app/
  index.html                    shell: markup de las 5 pantallas + <script src> en orden
  css/styles.css                 estilos (antes <style> inline)
  js/core/
    storage.js                   Storage — capa de persistencia localStorage
    parser.js                    Parser — litros desde descripción / sufijo de ref
    pricing.js                   Pricing — cálculo de PVP por "nivel de precio"
    history.js                   History — comparativa entre tarifas del mismo proveedor
    brands.js                    BRANDS — catálogo data-driven de proveedores
    db.js                        MasterDB — maestro persistente multi-marca (IndexedDB)
    migration.js                 Migration — migra config legacy a priceLevels (aditivo)
    store.js                     Store — pub/sub mínimo entre pantallas
    loaded-tariff.js             LoadedTariff — puente en memoria Importación → Tarifas
    router.js                    Router — navegación hash entre las 5 pantallas
  js/profiles/
    excel-reader.js              ExcelReader — registro de perfiles + helpers compartidos
    profile-repsol.js            RepsolProfile
    profile-ad-parts-aceite.js   ADPartsAceiteProfile (2 formatos de entrada + 3 gamas)
    profile-ad-parts-quimico.js  ADPartsQuimicoProfile
    profile-eni.js, profile-racing-oil.js, profile-shell.js, profile-castrol.js
  js/export/excel-writer.js      ExcelWriter — export legacy + exportSkritV2 (unificado)
  js/comparison/
    equivalence-reader.js        EquivalenceReader — parsers de los 2 formatos de equivalencias
    equivalence-index.js         EquivalenceIndex — índice combinado + lookup
  js/screens/
    screen-import.js             pantalla IMPORTACIÓN (solo tarjetas por marca + carga)
    screen-tarifas.js            pantalla TARIFAS (tabla/filtros/KPIs de la tarifa cargada, ver ADR 0020)
    screen-rules.js              pantalla REGLAS (edición de priceLevels — única fuente de margen)
    screen-compare.js            pantalla COMPARACIÓN (equivalencias en vivo)
    screen-export.js             pantalla EXPORTACIÓN (layout de 9 columnas)
  js/app.js                      boot: Migration.run() → init de las 5 pantallas → Router.init()
```

Detalle de la decisión original y su razonamiento en
[decisiones/0008-rediseno-4-pantallas.md](decisiones/0008-rediseno-4-pantallas.md); la
quinta pantalla (Tarifas) y la consolidación del margen en Reglas en
[decisiones/0020-pantalla-tarifas.md](decisiones/0020-pantalla-tarifas.md).

## Flujo de datos (pantalla Importación)

```
[Excel proveedor .xlsx]
        │
        ▼
    ExcelReader.read()
        │  ┌─ workbook (SheetJS)
        │  └─ itera PROFILES hasta encontrar uno cuyo detect() acierte
        ▼
    { supplier, id, gamas[], rows[], sheetUsed }   ← filas normalizadas:
        │                                             { ref, description, liters,
        │                                               formatKey, costPerPack,
        │                                               gama, fam?, litersDetected }
        ▼
   [ScreenImport.state.rows en memoria + Storage.get('config_<id>[_<gama>]')]
        │                                        │
        ▼                                        └─▶ MasterDB.putRows(brandId, gama, rows, 'factura')
   Pricing.compute(row, config)  ← margen + redondeo                (persiste en IndexedDB, ver abajo)
        │
        ├─▶  Preview en tabla (KPIs, filtros, edición inline, pestañas de gama)
        │
        └─▶  ExcelWriter.exportSkrit()  →  [tarifa-skrit-<marca>-YYYY-MM-DD.xlsx]  (export legacy)
```

## Maestro multi-marca y niveles de precio (desde v0.4.0)

Cada importación persiste sus filas en `MasterDB` (IndexedDB), fusionando por ref: el
mismo objeto puede tener `costFactura` (de la tarifa "factura") y `costNetoNeto` (de una
futura tarifa "neto-neto"/"triple neto", nullable hasta que se audite ese proveedor).

La configuración de margen por marca+gama se extiende de forma aditiva con `priceLevels`
(pantalla Reglas): cada nivel define una base de coste (`factura` | `netoNeto`), un modo
de margen, redondeo, y si va o no a Skrit (`goesToSkrit`). Ejemplos: **PVP** (siempre
existe, migrado automáticamente desde la config legacy), **Bidones y Cubas Neto**, y
**Netos Bonus** (ver ADR 0015/0016). `Pricing.compute(row, level)` es la
única función que calcula precios en toda la app — Importación, Reglas, Comparación y
Exportación la comparten.

La pantalla Comparación cruza el maestro con los ficheros de equivalencias de
`BASE DE CONOCIMIENTO/` para mostrar, dada una ref, el precio calculado de la misma
familia de producto en cada marca que ya tenga tarifa importada.

Detalle completo en [decisiones/0008-rediseno-4-pantallas.md](decisiones/0008-rediseno-4-pantallas.md).

## Perfiles por proveedor (Supplier Profiles)

**Cada proveedor tiene su workflow dedicado**, no hay importador genérico. Un perfil es un módulo con: función `detect()` (¿este Excel es mío?) y función `read()` (extraer filas normalizadas), registrado vía `ExcelReader.registerProfile()`.

Cuando el usuario arrastra un archivo, la app itera los perfiles hasta encontrar uno que encaje. Si ninguno lo hace, lanza un error explícito (sin fallback silencioso).

Perfiles:

```
RepsolProfile           ← v0.1 (implementado)
ADPartsAceiteProfile    ← v0.3.0 (implementado — 2 formatos de entrada, 3 gamas posibles)
ADPartsQuimicoProfile   ← v0.3.0 (implementado)
CastrolProfile          ← próximo
EniLiveProfile          ← pendiente
RacingOilProfile        ← pendiente
KrafftProfile           ← pendiente
ShellProfile            ← pendiente
```

Detalle en [decisiones/0005-un-workflow-por-proveedor.md](decisiones/0005-un-workflow-por-proveedor.md) y [decisiones/0007-ad-parts-supplier-profiles.md](decisiones/0007-ad-parts-supplier-profiles.md).

## Decisiones arquitectónicas clave

Están en [decisiones/](decisiones/) como ADRs (Architecture Decision Records). Cada decisión tiene contexto, alternativas consideradas y consecuencias:

- [0001 · Single-file HTML sobre framework SPA](decisiones/0001-single-file-html.md)
- [0002 · Margen sobre venta como modelo por defecto](decisiones/0002-margen-sobre-venta.md)
- [0003 · Parser de litros por regex sobre descripción](decisiones/0003-parser-litros.md)
- [0004 · GitHub Pages para publicación](decisiones/0004-github-pages.md)
- [0005 · Un workflow por proveedor (Supplier Profiles)](decisiones/0005-un-workflow-por-proveedor.md)
- [0006 · Comparativa histórica entre tarifas](decisiones/0006-comparativa-historica.md)
- [0007 · Formalización de Supplier Profiles y soporte AD Parts](decisiones/0007-ad-parts-supplier-profiles.md)
- [0008 · Rediseño a 4 pantallas y maestro multi-marca](decisiones/0008-rediseno-4-pantallas.md)
- [0020 · Pantalla Tarifas + margen consolidado en Reglas](decisiones/0020-pantalla-tarifas.md)

## Preparación para Electron (fase futura)

La extracción a ficheros separados prevista en el ADR 0001 ya se hizo en v0.4.0. Cuando la app crezca lo suficiente para justificar un ejecutable de escritorio, la migración a Electron requiere solo:

1. ~~Separar los módulos en archivos JS individuales~~ — hecho en v0.4.0.
2. Sustituir `Storage.get/set` (localStorage) por su equivalente en `fs` + JSON, y `MasterDB` (IndexedDB) por SQLite o `fs`. La interfaz pública de ambos módulos no cambia.
3. Envolver `index.html` en un `BrowserWindow` de Electron.
4. Añadir un `package.json` mínimo y `electron-builder` para generar `.exe` / `.dmg` / `.AppImage`.

El resto del código (parser, pricing, writer) es agnóstico del entorno.

## No usado deliberadamente

Se evitaron a propósito estas tecnologías para no romper portabilidad:

- **React / Vue / Svelte / Next**: obligan a build step y `node_modules`.
- **TypeScript**: idem (aunque futuro razonable).
- **Tailwind con compilador**: idem. Se usaría solo la versión CDN si se necesitara.
- **Backend / API propia**: ninguna operación requiere servidor; añadirlo sería complicar.
- **ES Modules nativos (`type="module"`)**: fallan por CORS al abrir el HTML directamente
  con `file://`. Se usan scripts clásicos con un único entorno léxico compartido.

`IndexedDB` (que hasta v0.3.0 se evitaba deliberadamente) se incorporó en v0.4.0 para el
maestro multi-marca — ver [ADR 0008](decisiones/0008-rediseno-4-pantallas.md) para el
razonamiento. `localStorage` se mantiene para configuración/historial, que siguen siendo
pequeños.

Si en el futuro alguna de estas decisiones se revierte, tiene que documentarse como nuevo ADR.
