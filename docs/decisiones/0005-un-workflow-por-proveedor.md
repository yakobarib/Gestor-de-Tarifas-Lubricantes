# ADR 0005 — Un workflow por proveedor (Supplier Profiles)

**Fecha:** 2026-07-21
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Inicialmente se contempló un "importador genérico con mapeo manual de columnas" como fallback para cualquier Excel. La idea: si el proveedor no está catalogado, la app pide al usuario que arrastre columnas al mapping y aprende.

Al probar con la tarifa real de Repsol mayo 2026 emergió una observación clave de Yako:

> "Las tarifas dependiendo del proveedor vienen tal cual las envían y no traen pestaña `DATOS`, esa la hacía yo para exportar a Skrit. Vienen a veces en una sola hoja y otras veces en muchas. Tenemos que crear workflows para cada proveedor."

Lo que Yako hacía manualmente antes:
1. Recibía el Excel del proveedor.
2. Copiaba/limpiaba las filas relevantes a una hoja nueva llamada `DATOS`.
3. Desde `DATOS` transformaba a formato Skrit a mano.

La app tiene que absorber ese paso 1-2 automáticamente para cada proveedor.

## Decisión

**No hay importador genérico. Hay un workflow (perfil) dedicado por proveedor.**

Cada perfil es un módulo autónomo que sabe:
- Cómo detectar si el Excel es suyo (nombre de archivo, hojas presentes, firma de columnas).
- Qué hojas leer y cuáles ignorar.
- Dónde está la fila de cabecera (varía: fila 0 Repsol, fila 1 Castrol, fila 6 Eni, fila 12+13 Racing Oil).
- Cómo se llaman las columnas relevantes (Repsol renombró `REF PROVEDOR` a `SIRDI` en 2026 — cada proveedor tiene sus alias).
- Qué filas descartar (subtotales de sección, encabezados repetidos, refs descatalogadas).
- Qué modelo de coste usa (neto directo Repsol vs. cascada Castrol vs. multi-tarifa Eni).
- Cómo debe salir en Skrit (prefijo `ADP`, columna extra `FAM`, etc.).

Cuando el usuario arrastra un archivo, la app itera los perfiles registrados hasta encontrar uno cuya función `detect()` devuelva true. Si ninguno encaja, muestra un selector manual con los perfiles disponibles.

## Estructura de un perfil

Interfaz común propuesta (a implementar formalmente en v0.2):

```javascript
const RepsolProfile = {
  id: 'repsol',
  name: 'Repsol',

  // ¿Este Excel es Repsol?
  detect(filename, workbook) {
    const f = (filename || '').toLowerCase();
    if (f.includes('repsol')) return true;
    // Firma de columnas: primera hoja con SIRDI + PRECIO FACTURA
    return this._hasSignature(workbook);
  },

  // Devuelve filas normalizadas: { ref, description, liters, cost, ... }
  read(workbook) { /* ... */ },

  // Ajustes de salida Skrit
  output: {
    refPrefix: '',            // sin prefijo
    extraColumns: [],         // sin FAM
    productTransform: null,   // no reescribe el nombre
  }
}
```

Registro:

```javascript
const PROFILES = [
  RepsolProfile,
  ADPartsProfile,     // v0.2
  CastrolProfile,     // v0.3
  EniLiveProfile,     // v0.4
  RacingOilProfile,   // v0.5
  KrafftProfile,      // v0.6
  ShellProfile,       // v0.6
];
```

## Consecuencias

### Positivas
- Cada proveedor se aísla y evoluciona independientemente (Repsol cambia SIRDI → solo se toca ese perfil).
- La lógica específica queda claramente separada. No hay `if (supplier === 'X')` esparcidos por el código.
- Añadir un proveedor nuevo = añadir un archivo + registrarlo. No hay que tocar el core.
- Cada perfil tiene tests contra su ejemplo real de referencia.

### Negativas / trade-offs aceptados
- Más ficheros que mantener (uno por proveedor).
- Ninguna reutilización automática entre perfiles similares — pero mejor: la duplicación explícita evita acoplamientos accidentales.
- No hay soporte para tarifas de proveedores desconocidos "on the fly". El usuario tendría que pedir un perfil nuevo antes de importar. Aceptable dado que los proveedores son estables (~7 y no cambian con frecuencia).

### Mitigaciones
- Utilities compartidas (parser de litros, cleanDescription, detección de cabecera flexible) se factorizan al módulo `Parser` y las usan todos los perfiles.
- Un perfil "genérico" opcional podría existir en Fase 3 si aparece un proveedor puntual (tarifa de oferta, cliente único). No es MVP.

## Referencias

- Módulo `ExcelReader` en `app/index.html` (implementa ya `readRepsol` — falta formalizar la interfaz).
- Fichas por proveedor en [../proveedores/](../proveedores/).
- [Roadmap por fases](../roadmap.md).
