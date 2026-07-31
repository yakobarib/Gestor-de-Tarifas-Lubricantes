# Racing Oil

## Estado
- **Versión de app:** v0.8.8 (2026-07-31) — implementado
- **Última tarifa procesada:** `Tarifa Racing Oil - Lubricantes - Agosto 2025.xlsx`
- **Última actualización de este documento:** 2026-07-31

## Formato de la tarifa entrante

Excel con **una hoja por gama** (como Eni Live), 12 gamas de producto + 1 hoja de
precios especiales que no es una gama:

| Hoja | Gama |
|---|---|
| `V.LIGERO` | Turismos |
| `V.PESADO` | Camión |
| `AGRÍCOLA` | Tractores |
| `TRANSMISIÓN` | Cajas de cambios / diferenciales |
| `HIDRÁULICOS` | Hidráulicos |
| `INDUSTRIA` | Industrial |
| `GRASA` | Grasas |
| `MOTO` | Motocicletas |
| `CLASSIC` | Vehículos clásicos |
| `MARINA` | Náutica |
| `ANTICOGELANTE` (sic, falta la N en el nombre de la hoja) | Anticongelantes |
| `ADITIVOS` | Aditivos |
| `PRECIOS ESPECIALES AD IBIZA` | No es gama — precios override, ver más abajo |

**Cabecera repartida en 2 filas**, y no siempre en las mismas dos filas: en las hojas de
gama normales, `COD. FABRI`/`EAN`/`PRODUCTO` van en una fila y `ENVASE`/`UDS. POR CAJA`/
`PRECIO` en la siguiente; en la hoja de precios especiales, `PRECIO`/`P. NORMAL`/`BAJADA`
van en la primera fila y `ENVASE` en la segunda. El perfil no asume una fila fija: busca
la fila que empieza por "COD" y fusiona esa fila con la siguiente, columna a columna.

**`TRANSMISIÓN` e `INDUSTRIA` no rotulan la columna `PRECIO`** (la celda de cabecera
queda en blanco) aunque el dato está en la misma columna F que en el resto de hojas — se
cae a esa posición fija cuando el texto no aparece.

## Columnas relevantes

| Columna Excel | Campo interno | Notas |
|---|---|---|
| `COD. FABRI` | `ref` | Con espacios internos tal cual («1 0018 0204») — se mantiene igual, es el formato real del fabricante. |
| `PRODUCTO` | `description` (base) | No incluye el envase — se le añade a partir de `ENVASE` (igual que Eni Live). Ejemplo real: `HIDRA HLP 16` + `5L`/`20L`/... → `HIDRA HLP 16 5L`, `HIDRA HLP 16 20L`. |
| `ENVASE` | `liters` | Casi siempre en litros (`1L`/`5L`/`200L`/`1000L`), a veces en ml/cc, y en Grasa/Aditivos en kg/g (ver tabla abajo). `EAN` y `UDS. POR CAJA` no se usan — confirmado que `PRECIO` ya es por envase individual, no por caja (el precio por litro cuadra igual entre el formato 1L y el 5L del mismo producto). |
| `PRECIO` | `costPerPack` | Precio neto factura, sin descuentos ni aportaciones adicionales — se usa tal cual. |

## Envases en kg/g (Grasa y algunos Aditivos)

Igual patrón que Repsol/Eni Live: el peso real no es la escala nominal de litros que usa
Racing Oil en el resto de la tarifa (1/5/20/50/200/1000). Inferido cruzando los propios
valores de Racing Oil (que ya usa esa escala en sus hojas en litros) — **pendiente de
confirmación explícita de Yako**:

| Peso | Envase (L) |
|---|---|
| 0,400 g | 0,4 L |
| 5 kg | 5 L |
| 20 kg | 20 L |
| 45 kg | 50 L |
| 185 kg | 200 L |

`ADITIVOS` tiene además unos pocos productos realmente sólidos/en unidades (polvo
absorbente, ceras en pasta, bolsas de perfume — `"20KG"`, `"5KG"`, `"40 un."`) donde no
tiene sentido forzar una equivalencia en litros — se dejan con el texto de envase tal
cual (`litersDetected: false`).

## Precios especiales AD Ibiza

La hoja `PRECIOS ESPECIALES AD IBIZA` no es una gama: son un puñado de referencias
(6 en la tarifa de agosto 2025) repartidas por el resto de hojas de gama, con un precio
negociado específico para AD Ibiza que **prevalece** sobre el precio de su hoja de gama.
Se lee aparte y se aplica como override por `ref` después de leer todas las gamas —
confirmado con la referencia `1 0018 0204` (HIDRA HLP-46 200L): 257,96€ en la hoja
`HIDRÁULICOS`, 243€ en la hoja de precios especiales — se usa 243€.

## Hallazgo pendiente de confirmar: referencias duplicadas

18 códigos `COD. FABRI` de la hoja `HIDRÁULICOS` están usados dos veces para **productos
distintos** (36 filas en total): la línea "PREMIER" y la línea normal del mismo producto
comparten código. Ejemplos: `1 0017` (HIDRA HLP-32 PREMIER *y* HIDRA HLP-32), `1 0018`
(HLP-46 PREMIER y HLP-46), `1 0019` (HLP-68 PREMIER y HLP-68), `1 0020/0021/0022` (HV-32/
46/68 PREMIER y sus versiones normales). Como el maestro persiste por `marca::gama::ref`,
solo sobrevive la última fila leída de cada par — **pendiente de que Yako confirme cómo
distinguirlas** (parece un error de copiado en la propia tarifa de Racing Oil al crear la
línea Premier a partir de la normal).

## Estado en la app

**Implementado en v0.8.8.** `js/profiles/profile-racing-oil.js`, perfil `racing_oil`,
12 gamas activas en `BRANDS`. Probado contra la tarifa real de agosto 2025: 730 filas,
solo 1 sin litros detectados (el bote de "40 un." de aditivos, correcto), override de
precios especiales verificado, import → MasterDB → Exportación probado en navegador.

## Referencias

- Tarifa actualizada: `TARIFAS ACTUALIZADAS/Racing Oil/Tarifa Racing Oil - Lubricantes - Agosto 2025.xlsx`
- Decisión de diseño: [ADR 0017](../decisiones/0017-perfil-racing-oil.md)
