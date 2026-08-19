# ADR 0051 — Mayúsculas siempre en Tarifas (pantalla y validación)

**Fecha:** 2026-08-19
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

En Castrol (y en cualquier marca) la tabla de Tarifas mostraba descripciones en dos
estilos distintos según el origen del dato: las referencias ya verificadas (descripción
tomada del maestro, `master-descriptions.js`, siempre en mayúsculas) salían en mayúsculas,
mientras que las no verificadas (texto crudo tal cual lo trae el Excel del proveedor,
normalmente mixto) salían con la capitalización original del proveedor. El resultado era
una tabla con aspecto inconsistente ("Brake Fluid DOT 4 1L" junto a "BREAK FLUID DOT 4
208L") que Yako interpretó, correctamente, como una pista visual de qué estaba validado —
pero sin que la app lo comunicara de forma explícita, y sin que el propio look-and-feel
fuera homogéneo.

Exportación ya resolvía esto (ADR 0034: mayúsculas solo en el límite de salida, nunca
mutando el dato guardado) pero la pantalla de Tarifas y el panel de validación de
descripciones nunca aplicaban esa misma regla — de ahí el bug.

Yako, agotado tras una sesión larga arreglando casos puntuales, pide una solución
definitiva ("que lo solucione de una vez por todas"), no otro parche más.

## Decisión

Extender el principio de ADR 0034 ("mayúsculas solo al mostrar/exportar, nunca al
guardar") a los dos sitios de Tarifas que faltaban:

1. **Tabla principal** (`renderTable()`): la celda de descripción envuelve el valor en
   `Parser.upperOut()` tanto en el texto visible como en el `title` (tooltip).
2. **Panel de validación** (`descValidationRowHtml()`): la columna de solo-lectura
   ("Descripción actual") y el valor precargado del input editable usan
   `Parser.upperOut()` — así Yako ve y edita siempre en mayúsculas, sin depender de si la
   ref ya estaba verificada o no.
3. **Guardado manual** (`saveDescValidation()`): antes de aplicar el sufijo de litros
   (ADR 0044), el texto que Yako haya escrito se pasa por `Parser.upperOut()` — así una
   corrección tecleada en minúscula queda igual de en mayúsculas que el resto del maestro,
   de forma permanente (se persiste ya en mayúsculas vía `DescriptionOverrides`/`MasterDB`).
4. **Modal "Referencias desaparecidas"** (`window.__openObsoleteModal`): mismo tratamiento
   por consistencia, aunque sea una vista de solo lectura.

Con esto, el estado de verificación (verde/pendiente) sigue comunicándose por el banner y
las pestañas del panel de validación — no por la capitalización, que ahora es uniforme
siempre, para cualquier marca, se haya validado o no la referencia.

## Verificación

Sembrando dos referencias de prueba en `MasterDB` (Castrol, gama "other") con
descripciones mixtas ("Brake Fluid DOT 4 1L", "radicool nf premix 20l"):
- Tabla principal: ambas se muestran en mayúsculas ("BRAKE FLUID DOT 4 1L", "RADICOOL NF
  PREMIX 20L").
- Panel de validación: la columna de solo lectura y el input editable muestran ambas en
  mayúsculas.
- Guardado manual con texto tecleado en minúscula: el valor persistido en `MasterDB` queda
  en mayúsculas.
- Consola sin errores en ningún paso.

## Referencias

- ADR 0034 (mayúsculas solo en el límite de salida).
- ADR 0044 (sufijo de litros canónico al guardar validación).
- `js/screens/screen-tarifas.js`.
