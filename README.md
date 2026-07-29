# Gestor de Tarifas Lubricantes

Herramienta web para transformar tarifas heterogéneas de proveedores de lubricantes en una tarifa de venta lista para el CRM **Skrit**, con configuración de margen por formato y previsualización en vivo.

**App en vivo (GitHub Pages):** https://yakobarib.github.io/Gestor-de-Tarifas-Lubricantes/app/
**Repositorio:** https://github.com/yakobarib/Gestor-de-Tarifas-Lubricantes

## Estado actual

**Versión:** v0.4.0 — 4 pantallas (Importación / Reglas / Comparación / Exportación) y maestro multi-marca. 2 proveedores funcionales (Repsol y AD Parts).

| Proveedor | Estado | Notas |
|---|---|---|
| Repsol | ✅ Implementado | 99,8% acierto en parser de litros vs. Skrit real |
| AD Parts (Aceite) | ✅ Implementado | Gamas Normal/Standard/Sport Car en pestañas, 2 formatos de entrada soportados |
| AD Parts (Producto Químico) | ✅ Implementado | Litros por descripción, escalones de cantidad fuera de alcance |
| Castrol | ⏳ Pendiente | Descuentos en cascada (Pronto Pago + Logístico + Rappel) |
| Eni Live | ⏳ Pendiente | Multi-hoja por familia (i-Sint, i-Sigma, Rotra, …) |
| Racing Oil | ⏳ Pendiente | Cabecera bipartita, LITROS como string |
| Krafft | ⏳ Pendiente | Auditar tarifa real |
| Shell | ⏳ Pendiente | Auditar tarifa real |

## Qué hace hoy

1. **Importación**: cargas por drag & drop una tarifa Excel (Repsol, AD Parts Aceite o AD Parts Producto Químico). La app detecta el proveedor, extrae litros y agrupa por formato; configuras el margen sobre venta por formato con preview y KPIs en vivo. Cada importación queda también en un maestro persistente multi-marca.
2. **Reglas**: por marca y gama, defines varios "niveles de precio" (PVP, Precio Neto de Venta, Precios para Bonus…), cada uno con su propia base de coste (factura o neto-neto) y si va o no a Skrit.
3. **Comparación**: cruzas el maestro con los ficheros de equivalencias entre marcas para ver, para un mismo producto, el precio calculado en cada proveedor que ya tengas importado.
4. **Exportación**: eliges marca + gama + nivel de precio y generas el Excel Skrit con el layout unificado (MARCA, REFERENCIA, MARCA+REFERENCIA, coste factura, coste neto-neto, precio, familia, litros, descripción).

## Arquitectura corta

- **HTML + JS vanilla sin bundler** (`app/index.html` + `app/css/` + `app/js/`) — abre en Chrome sin servidor ni instalación, scripts clásicos en orden de dependencia.
- **SheetJS** (via CDN) para lectura/escritura Excel.
- **Pico.css** (via CDN) para estilos.
- **localStorage** para configuración/historial; **IndexedDB** para el maestro multi-marca.
- Estructura modular por fichero (core, profiles, comparison, export, screens) preparada para migrar a Electron sin reescribir.

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
