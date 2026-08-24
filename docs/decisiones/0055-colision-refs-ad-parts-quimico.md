# ADR 0055 — AD Parts: filtrar en origen las 3 referencias que colisionan entre aceites y químicos

**Fecha:** 2026-08-24
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Yako reporta que, en Tarifas → AD Parts → "Todas las gamas", algunas referencias
aparecen duplicadas: la misma ref con la misma descripción (ya correcta, gracias al
maestro compartido de Neon — ver ADR 0054) pero con **dos costes distintos**. Ejemplo
visto: `ADP22005` sale como "SDI 5W40 5L" tanto a ~16€ como a ~316€.

La causa es un error de la propia AD Parts, ya detectado antes (ADR 0046) para
`ADP20005`/`ADP22005`: esos códigos identifican un aceite real en la tarifa de aceites,
pero el MISMO código aparece también en la tarifa de "Producto Químico" bajo un producto
"C.A.U.+" (anticongelante) completamente distinto. El arreglo de entonces solo corrigió
la **descripción** mostrada (vía el maestro) — nunca tocó la importación real, así que
cada vez que se importa la tarifa de químicos, `profile-ad-parts-quimico.js` sigue
generando una fila con ese ref bajo la gama `quimico`, con el coste del anticongelante,
que `MasterDB` guarda como una fila SEPARADA de la de aceites (`id` incluye la gama) — de
ahí el duplicado con coste distinto.

Cruzando las tarifas reales de abril/mayo 2026 (`Tarifa AD Aceite - 24 abril 2026.xlsx` y
`Tarifa AD Producto Químico Mayo 2026.xlsx`) se confirmó que no son solo esos dos: hay
una tercera, `ADP26005` (aceite "HHM 32" vs químico "C.A.U.+ 600L"), que Yako no había
detectado a mano todavía.

## Decisión

`profile-ad-parts-quimico.js` descarta explícitamente estas 3 referencias
(`ADP20005`, `ADP22005`, `ADP26005`) antes de emitir sus filas — nunca llegan a
`MasterDB`, así no hace falta corregirlo a mano cada vez que se reimporte la tarifa de
químicos. No se marcan como "inválidas" en el maestro compartido (`is_invalid`) porque esa
marca no distingue gama — invalidaría también la fila correcta de aceites, que sí existe
y es real.

Esto NO borra las filas que ya estaban importadas con el coste equivocado antes de este
cambio — hace falta borrarlas a mano una vez (`MasterDB.deleteRow('ad_parts_aceite',
'quimico', ref)` para cada una de las 3, desde la consola del navegador) o simplemente
reimportar la tarifa de químicos, que ya no las volverá a traer.

## Verificación

Cruce de las dos tarifas reales de AD Parts (aceites vs químicos) confirma exactamente 3
colisiones de referencia, ni una más ni una menos. `node --check` sobre
`profile-ad-parts-quimico.js`.

## Referencias

- ADR 0046 (lote refrigerantes/químicos — donde se detectaron las 2 primeras colisiones).
- `js/profiles/profile-ad-parts-quimico.js`.
