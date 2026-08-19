# ADR 0053 — Maestro de descripciones vaciado; nueva fuente de verdad en Excel externo

**Fecha:** 2026-08-19
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Al intentar incorporar un lote de 74 correcciones exportadas desde el panel de validación
(ver ADR 0052), se descubrió que 43 de esas referencias (AD Parts) ya existían en el
maestro de fábrica (`master-descriptions.js`) con un texto distinto — algunas más
detallado en el maestro (química de refrigerantes, colores exactos), otras con una
corrección de una errata solo en la versión local, sin un patrón consistente que permita
decidir automáticamente cuál es la correcta. Al revisarlo caso a caso, Yako confirma que
"algunas son correctas en local y otras en maestro" — no hay un ganador único por grupo.

En vez de seguir reconciliando línea a línea (proceso lento y propenso a error, ya
repetido varias veces esta sesión — ver el caso ADP20005/ADP22005 anterior), Yako decide
cambiar de raíz el flujo de trabajo: el maestro de descripciones se vacía por completo y
se reconstruye desde un Excel por marca, revisado con calma fuera de la app, en vez de
mezclar datos de fuentes distintas (Excel + correcciones sueltas tecleadas en pantalla)
que acaban entrando en conflicto entre sí.

## Decisión

- `master-descriptions.js`: el objeto `DATA` se vacía a `{}` para las 6 marcas
  (`ad_parts_aceite`, `repsol`, `castrol`, `shell`, `eni`, `racing_oil`) — cero
  referencias verificadas. `INVALID_REFS` (referencias confirmadas como inexistentes) se
  mantiene igual, al ser una lista ortogonal a la descripción del producto. `VERSION` sube
  de 5 a 6 para que la migración reaplique el maestro (ahora vacío) a todas las filas ya
  importadas — todas vuelven a "pendiente de validar" salvo que tengan una corrección
  local en `DescriptionOverrides` (esas siguen mandando, sin cambios).
- Nuevos ficheros en blanco, uno por marca, en `Archivo Maestro/` (fuera del repositorio,
  junto a `Descripciones Válidas/` y `Tarifas Actualizadas/`): `Maestro AD Parts.xlsx`,
  `Maestro Repsol.xlsx`, `Maestro Castrol.xlsx`, `Maestro Shell.xlsx`, `Maestro Eni
  Live.xlsx`, `Maestro Racing Oil.xlsx`. Cada uno con una sola hoja y columnas
  `REFERENCIA / DESCRIPCION / LITROS / NOTAS`, cabecera con formato, ancho de columna
  ajustado y fila 1 congelada. Yako los rellena a su ritmo, fuera de la app, mirando el
  catálogo real; cuando estén listos se incorporan al código (mismo mecanismo de siempre:
  editar `DATA` y hacer commit — ver ADR 0043).
- Se guarda como referencia (no vinculante, solo consulta) el export de las 74
  correcciones locales y la comparación de las 43 en conflicto, en
  `Archivo Maestro/_referencia correcciones locales exportadas 2026-08-19.json` y
  `_referencia comparacion maestro antiguo vs local 2026-08-19.md` — por si sirven de
  apunte al rellenar el Excel nuevo, sin obligación de partir de ellos.

No se ha tocado nada más: el resto de la app (tarifas importadas, reglas/márgenes,
histórico, comparación) sigue exactamente igual — solo se vacía la capa de descripciones
verificadas.

## Verificación

Tras el cambio: `MasterDescriptions.VERSION` es 6, `MasterDescriptions.DATA` tiene las 6
marcas con objetos vacíos, `MasterDescriptions.lookup()` devuelve `null` para cualquier
referencia. Cargando la app desde cero, la migración deja `applied_master_version` en 6
sin lanzar ningún error en consola. Una fila de prueba importada vía `MasterDB.putRows()`
queda con `descVerified: false` (antes de este cambio, esa misma referencia habría
quedado verificada si estaba en el maestro). `node --check` confirma que
`master-descriptions.js` sigue siendo JavaScript válido tras el vaciado.

## Referencias

- ADR 0043 (maestro de descripciones, mecanismo de incorporación).
- ADR 0046/0047 (versión del maestro, referencias inválidas).
- ADR 0052 (exportar correcciones locales — el disparador de este cambio).
- `js/data/master-descriptions.js`.
