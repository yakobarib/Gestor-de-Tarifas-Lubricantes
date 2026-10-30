# ADR 0094 — Guardado de reglas por campos, escritura condicional y cola sin conexión

**Fecha:** 2026-10-30
**Estado:** Aceptada
**Decidido por:** Yako ("es importante dejar eso arreglado"), a raíz de ADR 0091/0092

## Problemas que resuelve
1. Dos personas editando a la vez: cada guardado mandaba el config entero y el último borraba lo
   del otro aunque tocaran campos distintos (p. ej. un PVP manual).
2. Una edición sin conexión se perdía al reabrir: la cola vivía en memoria y `refresh()`
   sobrescribía lo local con lo de Neon.

## Decisión
- `RulesStore.save` calcula un **parche** (config local vs. última versión conocida en Neon,
  `RulesAudit.makePatch`), lee la fila actual de Neon, aplica el parche encima
  (`applyPatch`) y escribe. Lo que otra persona cambió en otros campos se conserva.
- La escritura es **condicional** (`NeonRules.writeIfUnchanged`: `update … where updated_at = <leído>`;
  insert si la fila no existe). Si alguien escribió en medio, se relee, se fusiona y se reintenta
  (hasta 5 veces).
- Si ambos tocan el **mismo campo**, gana el último (decisión de Yako) y el historial anota
  "⚠ pisó cambios de otra persona" con el valor anterior.
- **Cola persistente**: los cambios pendientes se guardan en `localStorage` (`rules_pending`:
  marca/gama + punto de partida + autor). Se reintentan cada 60 s, al volver la conexión
  (`online`) y al arrancar, **antes** de que `refresh()` traiga lo de Neon; `refresh()` nunca
  sobrescribe una regla con cambios pendientes. Si falla el envío, se avisa con un aviso.
- Los guardados automáticos (`{auto:true}`) usan el mismo camino, sin nombre ni rastro.
- Si durante un envío la persona sigue editando, esas ediciones nuevas viajan en su propio
  parche (partiendo de lo ya enviado) y no se pisan con la fusión.

## Verificación
Simulación en Node con "Neon" en memoria: dos PCs con cambios simultáneos en campos distintos
(se conservan ambos), mismo campo (gana el último y se anota), carrera entre lectura y escritura
(reintento), caída de conexión y reapertura con/sin conexión. Además, con las 66 configuraciones
reales de Neon (solo lectura): parche vacío contra sí mismo, aplicar el parche reproduce el
resultado exacto y no pierde cambios ajenos. No se probó con la UI real ni con dos navegadores.

## Límites
- Las claves de formato con punto (`0.5`) se tratan por segmentos, no por texto.
- Si un PC no vuelve a abrir la app, sus cambios pendientes no llegan a Neon hasta que lo haga.
- La lista de pendientes está por navegador/ordenador (localStorage), no por usuario.
