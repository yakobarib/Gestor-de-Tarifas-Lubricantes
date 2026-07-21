# Gestor de Tarifas Lubricantes

Herramienta web para transformar tarifas heterogéneas de proveedores de lubricantes en una tarifa de venta lista para el CRM **Skrit**, con configuración de margen por formato y previsualización en vivo.

**App en vivo (GitHub Pages):** https://yakobarib.github.io/Gestor-de-Tarifas-Lubricantes/app/
**Repositorio:** https://github.com/yakobarib/Gestor-de-Tarifas-Lubricantes

## Estado actual

**Versión:** v0.1 (MVP arrancado, un proveedor funcional)

| Proveedor | Estado | Notas |
|---|---|---|
| Repsol | ✅ Implementado | 99,8% acierto en parser de litros vs. Skrit real |
| AD Parts | ⏳ Pendiente | 2 gamas (Normal + Standard), casuística 5L manual |
| Castrol | ⏳ Pendiente | Descuentos en cascada (Pronto Pago + Logístico + Rappel) |
| Eni Live | ⏳ Pendiente | Multi-hoja por familia (i-Sint, i-Sigma, Rotra, …) |
| Racing Oil | ⏳ Pendiente | Cabecera bipartita, LITROS como string |
| Krafft | ⏳ Pendiente | Auditar tarifa real |
| Shell | ⏳ Pendiente | Auditar tarifa real |

## Qué hace hoy

1. Cargas por drag & drop una tarifa Excel de Repsol.
2. La app detecta columnas, extrae litros de la descripción y agrupa por formato (1L, 5L, 18L, 20L, 60L, 180KG, 208L, 1000L, mililitros varios…).
3. Configuras el margen sobre venta que quieres para cada formato — la tabla de preview y los KPIs se actualizan en vivo.
4. Exportas a Excel en el formato Skrit (REF, PRODUCTO, LITROS, NETO FACTURA ENVASE, P.V.P. ENVASE + fecha).
5. La configuración se guarda automáticamente en el navegador; puedes crear perfiles de margen con nombre.

## Arquitectura corta

- **Single-file HTML** (`app/index.html`) — abre en Chrome sin servidor ni instalación.
- **SheetJS** (via CDN) para lectura/escritura Excel.
- **Pico.css** (via CDN) para estilos.
- **localStorage** para persistencia.
- Estructura interna modular (Storage, Parser, ExcelReader, Pricing, ExcelWriter, UI) preparada para migrar a Electron sin reescribir.

Más detalle en [docs/arquitectura.md](docs/arquitectura.md).

## Documentación

- [Arquitectura técnica](docs/arquitectura.md)
- [Roadmap por fases](docs/roadmap.md)
- [Reglas de negocio](docs/reglas-negocio.md)
- [Decisiones (ADRs)](docs/decisiones/)
- [Proveedores](docs/proveedores/)

## Uso local (sin GitHub Pages)

Clona el repo y abre `app/index.html` con doble click en Chrome. No requiere instalación ni servidor.

```bash
git clone https://github.com/yakobarib/Gestor-de-Tarifas-Lubricantes.git
cd Gestor-de-Tarifas-Lubricantes
# Doble click en app/index.html
```

## Contribuir / iterar

Los cambios de código y de documentación se llevan por PR o commit directo a `main`. GitHub Pages sirve automáticamente desde la rama `main` en cuanto está configurado (ver [docs/decisiones/0004-github-pages.md](docs/decisiones/0004-github-pages.md)).

## Contexto de negocio

Yako es responsable de tarifas en el aftermarket de lubricantes en AD Ibiza. Cada mes recibe tarifas de ~7 proveedores en formatos heterogéneos, y necesita cargarlas al CRM Skrit con márgenes propios por marca y formato. Este proyecto automatiza esa transformación.
