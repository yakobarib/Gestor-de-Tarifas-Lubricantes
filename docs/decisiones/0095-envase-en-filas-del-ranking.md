# ADR 0095 — El envase en las filas del Ranking completo

**Fecha:** 2026-10-30
**Estado:** Aceptada
**Decidido por:** Yako (varias filas "GLMO" del mismo producto en distintos envases no se distinguían)

Las filas del ranking se titulaban con la descripción de la primera marca con dato; en Grasas esa
descripción no lleva envase ("GLMO", "GLEP-2"), así que había una fila por envase con el mismo
nombre. Ahora `withSize` añade el envase del grupo (`specs.LITROS`/`specs.KG` del Excel, o el
tamaño de algún miembro) **solo si la descripción no trae ya ninguna cantidad** ("GLMO 45 kg").
Las descripciones de tarifa que ya dicen "20L" no se tocan, para no contradecirlas.

Pendiente: las grasas de AD siguen "sin tarifa" hasta tener su tarifa actual (solo existe la de
2011, inservible); entonces AD aportará su descripción real.
