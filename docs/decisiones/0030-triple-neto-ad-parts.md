# ADR 0030 — Triple-neto de AD Parts: fichero dedicado sin gama, cruzado contra el maestro

**Fecha:** 2026-08-11
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

AD Parts no mostraba ningún coste triple-neto en Comparación — a diferencia de Repsol y
Castrol, `profile-ad-parts-aceite.js` nunca ha leído esa información. Yako confirmó que sí
existe: llega en un fichero aparte (`Triple-neto DD-MM-AAAA.xlsx`), "regularmente pero no
siempre junto a una tarifa normal", con dos columnas de importe (mes en curso y mes
anterior) — "lo que interesa es el en curso, que es el más actual".

Inspeccionando el fichero real (`TARIFAS ACTUALIZADAS/AD Parts/Triple-neto
08-04-2026.xlsx`): hojas `Hoja1`/`DATOS` (mismo contenido), cabecera con una columna `ref`
y dos columnas con el mes como texto (`Abril 2026` / `Febrero 2026`) — nada de gama,
litros ni familia explícitos. La `ref` usa el mismo esquema `familia.formato` que ya
decodifica `readADPartsAceiteWorking` para la tarifa de coste normal (ej. `33.1000` →
familia 33, formato 1000L) — confirmado cruzando contra la hoja `Coste` de la tarifa
normal, que trae la misma ref literal en su columna `ref.`.

## Problema: sin gama, no encaja en el patrón `profile.read()` síncrono

Todo perfil de `ExcelReader` devuelve filas ya asignadas a una gama (normal/standard/
sportcar), leída del propio fichero. Este fichero mezcla productos de las tres sin
indicarlo fila a fila — la única forma de saber a qué gama pertenece una ref es
buscarla en el maestro ya importado, y esa consulta a IndexedDB es async, algo que el
patrón `detect(workbook)`/`read(workbook)` síncrono (usado por los demás 6 proveedores)
no admite.

## Decisión

Se mantiene **fuera** del registro de perfiles de `ExcelReader`. `AdPartsTripleNeto`
(`js/profiles/profile-ad-parts-triple-neto.js`) solo sabe `detect()`/`parse()` un
workbook y devolver `{ref, description, liters, formatKey, costTripleNeto}` — sin gama.
`ScreenImport.handleBrandFiles`, al recibir un fichero en la tarjeta de AD Parts,
comprueba `AdPartsTripleNeto.detect()` **antes** de entrar al pipeline normal de
perfiles; si coincide, se desvía a `handleAdPartsTripleNeto()`, que:

1. Parsea el fichero (elige la columna de mes más reciente comparando año×12+mes de las
   cabeceras — genérico, no depende de qué dos meses concretos traiga cada envío).
2. Consulta `MasterDB.getByBrand('ad_parts_aceite', null)` (todas las gamas) para saber en
   qué gama vive cada ref ya importada.
3. Agrupa por gama y llama a `MasterDB.putRows(brandId, gama, filas, 'factura')` — las
   refs sin gama conocida (nunca importadas con su tarifa de factura) se cuentan como
   "sin emparejar" y no se escriben.
4. No navega a Tarifas ni toca los metadatos de "última tarifa importada" de la tarjeta
   (esos datan de la tarifa de FACTURA, no de esta actualización de coste en segundo
   plano) — solo actualiza el estado en pantalla con el recuento.

### Guardia en `MasterDB.putRows`: no pisar `costFactura` sin coste

Estas filas no traen `costPerPack` (no son un coste de factura). `putRows` asignaba
`merged.costFactura = r.costPerPack` sin comprobar que ese valor existiera — con
`tariffType: 'factura'` (el único que se usa hoy) habría puesto `costFactura` a `null`
para cualquier fila sin `costPerPack`, borrando el que ya hubiera. Se añade la guardia:
solo se toca el coste del `tariffType` en curso si `r.costPerPack` es un número finito.

## Verificación

Importando primero `Tarifa AD Aceite - 24 abril 2026.xlsx` (302 refs) y después
`Triple-neto 08-04-2026.xlsx` sobre la misma tarjeta: detecta "Abril 2026" como mes en
curso (descartando "Febrero 2026"), 282 referencias actualizadas y 236 sin emparejar
(productos del fichero de triple-neto que esa tarifa de factura concreta no traía). Una
de las emparejadas, `ADP10005`: `costFactura=9,02€` sin tocar, `costTripleNeto=8,08€`
añadido. La tarjeta de AD Parts sigue mostrando la fecha de la tarifa de factura, sin
cambios. El propio fichero real trae 6 refs duplicadas (mismo código familia.formato dos
veces) — se resuelve quedándose con la última aparición, para que el recuento de
"actualizadas" no cuente de más.

## Consecuencias

- `js/profiles/profile-ad-parts-triple-neto.js` (nuevo): `detect`/`parse`, sin registrar
  en `ExcelReader`.
- `js/screens/screen-import.js`: `handleAdPartsTripleNeto()`; `handleBrandFiles` desvía a
  ella antes del pipeline normal cuando `brandId === 'ad_parts_aceite'` y el fichero
  coincide.
- `js/core/db.js`: guardia en `putRows` (no pisar el coste del `tariffType` en curso sin
  `costPerPack` válido) — generalizable a cualquier futuro fichero de "solo un coste
  aparte" de cualquier marca.
- `app/index.html`: nuevo `<script>` para el fichero del perfil.

## Referencias

- `js/profiles/profile-ad-parts-triple-neto.js`, `js/profiles/profile-ad-parts-aceite.js`,
  `js/screens/screen-import.js`, `js/core/db.js`.
- [ADR 0010](0010-triple-neto-repsol.md) (mismo concepto de coste, mecanismo distinto
  porque Repsol sí trae la fila completa con gama).
