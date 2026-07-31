# ADR 0017 — Perfil Racing Oil: cabecera bipartita variable + override de precios especiales

**Fecha:** 2026-07-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Tercer proveedor de la sesión (tras Eni Live y Repsol). Yako lo describió como "fácil":
una hoja por gama, columnas A (ref), C (producto), D (envase) y F (precio), sin
descuentos en cascada. La única particularidad que anticipó: la hoja "Precios Especiales
AD Ibiza" trae un puñado de referencias con precio negociado que prevalece sobre el de
su hoja de gama habitual.

## Decisión 1 — Cabecera en 2 filas, fusionadas dinámicamente

Cada hoja de gama reparte la cabecera en dos filas (`COD. FABRI`/`EAN`/`PRODUCTO` en una,
`ENVASE`/`UDS. POR CAJA`/`PRECIO` en la siguiente). Se detecta la fila que empieza por
"COD" y se fusiona con la siguiente (columna a columna, quedándose con lo que no sea
nulo de cada una) — igual principio que "buscar la fila de cabecera", pero sobre 2 filas
en vez de 1.

Al probarlo contra el fichero real se descubrió que `TRANSMISIÓN` e `INDUSTRIA` **no
rotulan la columna PRECIO** (la celda de cabecera está vacía) aunque el dato sigue en la
misma columna F de siempre — se añadió un fallback posicional (columna 5, 0-indexada)
cuando la búsqueda por texto no encuentra "PRECIO".

## Decisión 2 — Precio ya por envase individual, sin dividir

A diferencia de Repsol, Yako confirmó que `PRECIO` no necesita dividirse por
`UDS. POR CAJA` — verificado cruzando el precio por litro del mismo producto en dos
formatos (1L y 5L de `ACTIVE 0W20 C5 508/509`): sale igual en ambos, confirmando que
`PRECIO` ya es por envase, no por caja completa.

## Decisión 3 — Envase en litros/ml/kg/g, mismo patrón que Repsol/Eni

`ENVASE` da casi siempre el número directo en litros (`"5L"`, `"200L"`) o mililitros/cc,
pero `GRASA` (y algún producto suelto de `ADITIVOS`) lo da en kg/g. Igual que en Repsol
(ADR 0013) y Eni Live (perfil), el peso no es la escala nominal — se convierte a la
escala de litros que el propio Racing Oil usa en el resto de la tarifa (1/5/20/50/200/
1000): 0,4kg→0,4L, 5kg→5L, 20kg→20L, 45kg→50L, 185kg→200L. **Inferido** por Yako no haber
dado la tabla explícita para este proveedor — pendiente de confirmación.

Unos pocos productos de `ADITIVOS` traen el envase en kg o en unidades sueltas (polvo
absorbente, cera en pasta, bolsa de perfumes) donde no hay litros que interpretar — se
dejan con el texto de envase tal cual, sin forzar una conversión.

## Decisión 4 — "Precios Especiales AD Ibiza" como override por ref, no como gama

La hoja no se registra como gama: se lee aparte (`readSpecialPrices`) y se aplica como
override de `costPerPack` sobre las filas ya leídas de las demás gamas, buscando por
`ref` exacto. Confirmado con la ref `1 0018 0204` (HIDRA HLP-46 200L): 257,96€ en
`HIDRÁULICOS`, 243€ en la hoja especial — prevalece el especial, tal como pidió Yako.

## Hallazgo durante la verificación: refs duplicadas en HIDRÁULICOS

18 códigos `COD. FABRI` (36 filas) se usan para dos productos distintos: la variante
"PREMIER" y la variante normal del mismo producto comparten código en la tarifa de
origen. No es un bug del parser — es un dato de origen ambiguo. Documentado en la ficha
de proveedor, pendiente de que Yako confirme cómo distinguirlas (probablemente error de
copiado de Racing Oil al crear la línea Premier).

## Verificación

Probado contra la tarifa real de agosto 2025: 730 filas, 12 gamas, solo 1 fila sin litros
detectados (bolsa de perfumes "40 un.", correcto). Descripción verificada contra el
ejemplo exacto de Yako (`HIDRA HLP 16` → `HIDRA HLP 16 5L`/`20L`/...). Override de precio
especial verificado en navegador. Import → MasterDB → Exportación probado de punta a
punta.

## Referencias

- `js/profiles/profile-racing-oil.js`.
- [docs/proveedores/racing-oil.md](../proveedores/racing-oil.md)
