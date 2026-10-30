# ADR 0092 — Rastro de cambios de reglas (nombre obligatorio + historial)

**Fecha:** 2026-10-30
**Estado:** Aceptada
**Decidido por:** Yako ("mantenemos 'el último que guarda gana', pero con un diálogo obligatorio
para escribir el nombre de quien hace el cambio y que deje rastro")

## Decisión

La sincronización de reglas sigue siendo "último que guarda gana" (sobre el config entero de
cada marca/gama). Se añade **rastro**: cada cambio de una persona queda anotado en
`pricing_rules_log` con nombre, email de sesión, fecha y la lista exacta de campos cambiados
(antes → después).

## Cómo funciona

- `RulesStore.save` sigue escribiendo en local al instante (las pantallas guardan en cada tecla).
  El envío a Neon y la anotación se hacen **una vez, 1,5 s después de dejar de teclear**.
- En ese momento `RulesAuthor.ensure()` pide el nombre en un diálogo **sin botón de cerrar**.
  Se recuerda mientras se siga trabajando (caduca a los 60 min sin cambios); se puede corregir
  en pasados 60 min.
- `RulesAudit.diff` compara contra el último estado conocido en Neon (`baselines`, rellenado en
  `refresh()` y tras cada envío). Ignora los campos heredados del formato antiguo y el orden de
  los niveles. "Todas las gamas" genera una sola línea de rastro.
- Los guardados automáticos (migración/arranque en Exportación) usan `{auto:true}`: no son
  decisión de nadie, no piden nombre ni dejan rastro.
- Ajustes → "Historial de cambios" muestra las últimas 300 entradas.
- `pricing_rules_log` es de solo añadir (select + insert; sin update/delete) con RLS por lista
  blanca. SQL en `docs/sql/0092-pricing-rules-log.sql` (ya aplicado en Neon).

## Limitaciones conocidas

- Si un PC cierra la página dentro del 1,5 s previo al envío, ese cambio queda solo en local.
- El nombre es declarativo (no autentica); el email de sesión queda anotado junto a él.
- Si el Data API no tiene refrescada su caché de esquema, el historial no se lee ni se escribe
  (el cambio de reglas se guarda igual y se avisa). Refrescar desde la consola de Neon
  (Data API) o `npx neon@latest data-api refresh-schema --project-id silent-field-02039340`.
- Edición simultánea y cola sin conexión: resueltas en ADR 0094.
