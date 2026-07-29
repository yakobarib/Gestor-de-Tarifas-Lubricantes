# ADR 0007 — Formalización de Supplier Profiles y soporte AD Parts

**Fecha:** 2026-07-28
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

El roadmap (`docs/roadmap.md`) marcaba **AD Parts** como el hito v0.2, prioridad ALTA por
ser marca propia. El trabajo real publicado como v0.2/v0.2.1/v0.2.2 se dedicó a la
comparativa histórica (ADR 0006) y a un fix de coste en Repsol — AD Parts quedó pendiente.
Este ADR documenta las decisiones tomadas al retomarlo, publicado como v0.3.0.

También quedaba pendiente desde el ADR 0005 formalizar la interfaz de "Supplier Profile":
`ExcelReader.read()` llamaba siempre a `readRepsol()` sin detección real, con un
comentario explícito de que había que formalizar el patrón "antes de duplicarlo" a un
segundo proveedor. AD Parts es ese segundo proveedor.

## Decisión 1 — Registro de perfiles

Se introduce `PROFILES` en `ExcelReader`: un array de `{ id, name, detect(filename,
workbook), read(workbook) }`. `ExcelReader.read()` itera el registro y usa el primer
perfil cuyo `detect()` acierte, en vez de asumir siempre Repsol. Repsol se envuelve en
`RepsolProfile` sin cambiar su lógica interna (regresión cero, verificado contra
`Tarifa Repsol Lubricants - 06 mayo 2026.xlsx`: mismas 830 filas, mismos 6 sin litros
detectados).

## Decisión 2 — Litros por sufijo de referencia

Descubierto cruzando los Excel reales de AD Parts (no documentado por el proveedor): los
**últimos 3 dígitos de la referencia** (quitando puntos) codifican los litros del envase,
con el caso especial `'000'` → 1000 L. Verificado en 235/235 refs de `AD NORMAL` cruzando
contra la descripción real de `Tarifa`.

Es la fuente de litros más fiable para AD Parts porque en la **gama Standard** la
descripción es siempre idéntica para todos los formatos ("AD STANDARD SC 5W30" tanto para
5L como para 208L) — solo la referencia distingue el tamaño. Implementado como
`Parser.litersFromRefSuffix(ref)`, usado como fuente primaria con fallback al parser de
descripción existente (`Parser.extractLiters`) cuando la ref no encaja en el patrón (caso
de Producto Químico, cuya numeración de referencia no sigue esta convención).

## Decisión 3 — Dos formatos de entrada para AD Parts Aceite

Confirmado por Yako: la tarifa de Aceite llega en uno de dos formatos según el mes:

1. **"ENTRADA" crudo**: hojas `AD NORMAL` / `AD STANDARD` + `Tarifa` maestro. Join
   `REFERENCIA` == `REF PROVEEDOR` sin el punto.
2. **"de trabajo"**: hojas `Coste` / `ADStandard` / `CosteSC`. El coste vigente está
   siempre en la columna inmediatamente a la derecha de `ref.` (su cabecera es una fecha
   variable mes a mes, se localiza por posición). `CosteSC` añade una 3ª línea de producto,
   **Sport Car**, ausente en el formato "ENTRADA".

`ADPartsAceiteProfile.read()` decide qué sub-lector usar según qué hojas trae el workbook.
Ambos normalizan al mismo shape de fila (`{ ref, description, liters, costPerPack, gama,
fam, ... }`), así que el resto de la app (pricing, tabla, export) no necesita saber cuál
de los dos formatos originó los datos.

## Decisión 4 — Gamas como pestañas independientes

Cada gama (Normal, Standard, y Sport Car cuando el formato "de trabajo" la trae) se
muestra en su propia pestaña, con su propia configuración de margen por formato, su
propio historial de comparación (`history_<supplier>_<gama>`) y su propio botón de
export — igual que si fueran tarifas distintas, porque en la práctica lo son (Yako
exporta un Excel Skrit por gama, con márgenes potencialmente distintos). El número de
pestañas es dinámico según lo que traiga el fichero cargado.

Producto Químico es un **perfil de proveedor separado** (su propia detección, su propio
drag & drop) en vez de una gama más de Aceite, porque su estructura de origen (secciones
por familia en vez de gamas) no tiene nada que ver con la de Aceite.

Config e historial dejan de usar una clave fija (`config_repsol`) y pasan a
`config_<supplierId>_<gama>` / clave de History compuesta por `"<supplier> <gama>"`.
Repsol conserva su clave histórica exacta (`gama = 'default'` no añade sufijo) para no
perder los márgenes ya guardados en v0.2.x.

## Decisión 5 — PVP manual genérico, no solo para 5L

Los docs de AD Parts solo contemplaban el formato 5L como caso de PVP manual (fijado por
Albert). Al auditar `SKRIT SOLO FORMATOS GRANDES` (fichero real de Yako) se encontró
evidencia de que también se fija PVP a mano en formatos grandes en algunos casos. Se
implementa como un campo editable por fila en la tabla de preview
(`config.manualPvp[ref]`), no limitado a ningún formato concreto: cuando tiene valor,
`Pricing.compute()` lo usa directamente en vez de calcular por margen. Se prefirió esto
sobre la alternativa documentada (importar un Excel aparte de PVPs manuales) por ser más
simple de operar día a día.

## Decisión 6 — Producto Químico: solo precio base, sin escalones de cantidad

La hoja `PVP` de Producto Químico trae precios escalonados por cantidad comprada (1 ud /
1 caja / 5 cajas / 10 cajas / 25 cajas). Se decide **no leerla** — el cálculo de margen de
la app ya deriva el PVP desde el coste base (hoja `Coste`), y los escalones de descuento
por volumen son una tabla de referencia para cotizar a clientes grandes, no un dato de
catálogo para Skrit. Queda fuera de alcance salvo que se pida explícitamente más adelante.

## Consecuencias

### Positivas
- El patrón de perfiles queda listo para añadir Castrol/Eni/Racing Oil/Krafft/Shell sin
  tocar el core (según lo previsto en el ADR 0005).
- La regla de litros por sufijo es reutilizable para cualquier proveedor cuya
  referencia codifique el formato de forma similar.

### Negativas / trade-offs aceptados
- FAM en Aceite es un valor fijo (`'06'`) en vez de un lookup completo — la única familia
  observada en los datos reales es "ACEITE MOTOR". Si aparece otra familia, se verá como
  fila normal pero con FAM `'06'` (incorrecto); habría que ampliar el mapa
  `AD_PARTS_FAM_BY_FAMILIA` en `app/index.html`.

## Referencias

- Módulos `ExcelReader`, `Parser.litersFromRefSuffix`, `Pricing.compute` en `app/index.html`.
- Ficha de proveedor: [../proveedores/ad-parts.md](../proveedores/ad-parts.md).
- ADR previo: [0005-un-workflow-por-proveedor.md](0005-un-workflow-por-proveedor.md).
