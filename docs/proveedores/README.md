# Proveedores

Documentación por proveedor. Cada archivo cubre: formato de entrada, casuísticas específicas y estado de implementación en la app.

## Estado

| Proveedor | Archivo | Estado |
|---|---|---|
| Repsol | [repsol.md](repsol.md) | ✅ Implementado (v0.1) |
| AD Parts | [ad-parts.md](ad-parts.md) | ⏳ Planificado (v0.2) — prioridad alta (marca propia) |
| Castrol | [castrol.md](castrol.md) | ⏳ Planificado (v0.3) |
| Eni Live | [eni-live.md](eni-live.md) | ✅ Implementado (v0.8.0) |
| Racing Oil | [racing-oil.md](racing-oil.md) | ⏳ Planificado (v0.5) |
| Krafft | [krafft.md](krafft.md) | ⏳ Pendiente auditar |
| Shell | [shell.md](shell.md) | ⏳ Pendiente auditar |

## Estructura común

Cada `.md` de proveedor sigue esta plantilla:

```markdown
# <Proveedor>

## Estado
- Versión: (v0.X)
- Última tarifa: <YYYY-MM-DD>
- Última actualización de este documento: <YYYY-MM-DD>

## Formato de la tarifa entrante
- Extensión, hojas relevantes, cabeceras.
- Fila de cabecera, filas de datos, filas espurias (subtotales, secciones).

## Columnas relevantes
- Mapping columna del proveedor → campo interno de la app.

## Casuísticas
- Descuentos en cascada, familias, PVPs manuales, refs especiales.

## Notas de negocio
- Márgenes típicos aplicados, formatos especiales, etc.

## Estado en la app
- Qué está implementado y qué no.
```
