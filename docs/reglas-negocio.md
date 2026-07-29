# Reglas de negocio

Casuísticas críticas del pricing de lubricantes en el aftermarket. Extraídas de `CONSIDERACIONES/Consideraciones.docx` y afinadas con Yako.

## Heterogeneidad de tarifas de entrada

Cada proveedor tiene su propio formato:

- **Estructura**: filas, columnas y hojas varían por proveedor.
- **Precio**: algunos dan precio neto final directo (Repsol); otros dan precio base con **descuentos en cascada** (Castrol: Pronto Pago + Logístico + Rappel; AD Parts: precio compra → dto compra → neto compra → rappel socio → rappel grupo → neto neto).
- **Multi-hoja**: una misma tarifa puede tener varias hojas por gama — Moto, Ligero, Pesado, Transmisión, Industria, Anticongelantes, Grasas, Aditivos, etc.

**Implicación**: el módulo `ExcelReader` necesita un lector por proveedor. Detección automática por firma de columnas + fallback a mapeo manual.

## Litros y unidades de compra (CRÍTICO)

Este es el punto donde más se rompe si no se implementa bien:

- **No suele venir columna "litros por envase"** — hay que parsearla de la descripción.
- Los proveedores suelen dar **precio por litro** o **por unidad de compra**, no siempre por envase.
- **Unidades de compra** varían con el formato:
  - 1000L → 1 unidad por compra
  - 200/205/208L → 1 unidad
  - 20/50/60L → 1 unidad
  - 5/4L → 3-5 unidades por caja
  - 1L → 12-15 unidades por caja
- **Notación habitual al final de la descripción**:
  - `12x1` → 12 unidades por caja × 1 L por envase
  - `5x4` → 5 unidades × 4 L
  - `4x5` → 4 unidades × 5 L
  - `1x208` → 1 unidad × 208 L (bidón)
  - Primer número = unidades por caja; segundo = litros por envase.
- **El CRM Skrit espera el precio del envase individual**, no por litro ni por caja.

**Regla confirmada por Yako (todos los proveedores auditados hasta ahora, salvo Eni)**:
el precio que trae la tarifa es el de la **unidad de compra**, que casi siempre es la
caja, no el envase individual — hay que dividir siempre. La forma de saber por cuánto
dividir varía por proveedor, de más a menos cómodo:
1. **Repsol**: trae columna explícita `UDS X CAJA` — se divide `PRECIO FACTURA / UDS X CAJA`
   (ver `profile-repsol.js`).
2. **AD Parts**: es la excepción — su `PRECIO COMPRA FACTURA` / coste de las hojas
   `AD NORMAL`/`AD STANDARD`/`Coste`/`ADStandard` **ya viene por envase**, no hace falta dividir
   (confirmado cruzando los datos reales en el ADR 0007).
3. **Resto de proveedores (Castrol, Racing Oil, Krafft, Shell — sin auditar todavía)**:
   previsiblemente **sin columna de unidades por caja**, hay que extraer el multiplicador
   de la propia descripción (patrón `NxM`, ej. `"...12X1L"` → 12 unidades por caja).
   **Pendiente de implementar**: hoy `Parser.extractLiters()` reconoce el patrón `NxM` pero
   solo devuelve `M` (litros por envase) — descarta `N` (unidades por caja). Antes de dar de
   alta un perfil para estos proveedores hay que añadir una función equivalente
   (`Parser.unitsPerBoxFromDescription()` o similar) que sí devuelva `N`, replicando en el
   perfil correspondiente la división que ya hace Repsol.
- **Eni**: según Yako, es el único proveedor que sí da directamente el precio por unidad de
  venta (envase individual) en su tarifa — no necesitará esta división cuando se implemente.

**Implementación actual**: el parser reconoce L, ML, GR, KG y el patrón NxM con unidad opcional. Detalle en [decisiones/0003-parser-litros.md](decisiones/0003-parser-litros.md).

## AD Parts (marca propia, prioritaria)

Reglas específicas de la marca propia, que tiene tratamiento diferenciado:

- **Dos gamas**: Normal y Standard (Standard es la barata / entrada de rango).
- El catálogo de **refrigerantes** se incluye en el "saco" de lubricantes para efectos de pricing (aunque técnicamente sea químico).
- **Dos tarifas de entrada**:
  - **Precio factura** → se mete en Skrit como coste.
  - **Triple neto** → coste real tras todos los descuentos (rappels de socio y grupo). Se usa para otros cálculos internos, no para Skrit.
- **Formato 5L**: PVP marcado manualmente por Albert (jefe). **No automatizar**. La app debe permitir cargar ese PVP a mano, sobreescribiendo el cálculo automático.

## Tasas y aportaciones

Recargos legales/comerciales que se aplican sobre el coste:

- **RD 1055/2022 (Ecoembes)** — tasa por envases. Aplica a lubricantes envasados.
- **GENCI 2026** — tasa sectorial. Repsol la desglosa en su tarifa; otros proveedores no.

**Estado actual**: no incorporadas al MVP (v0.1). Planeadas para **Fase 2** como recargo configurable por marca y por litro.

## Modelo de margen elegido

Se usa **margen sobre venta**, no markup sobre coste. Motivación completa en [decisiones/0002-margen-sobre-venta.md](decisiones/0002-margen-sobre-venta.md).

Fórmula:
```
PVP = Coste / (1 − margen/100)
```

Ejemplo: coste 100 € + 30% margen sobre venta → PVP = 100 / 0,70 = 142,86 €.

Equivalencia con markup sobre coste (por si aparece en documentación antigua o de otros proveedores):
```
markup_sobre_coste = margen_sobre_venta / (1 − margen_sobre_venta)
```
- 25% margen sobre venta ≡ 33,3% markup sobre coste.
- 30% margen ≡ 42,9% markup.
- 40% margen ≡ 66,7% markup.
- 50% margen ≡ 100% markup.

## Formato de salida Skrit

El CRM Skrit consume Excel con **5 columnas invariantes** (más una opcional de fecha y otra de familia):

| Col | Nombre canónico | Alias vistos |
|---|---|---|
| A | REF | REFERENCIA |
| B | PRODUCTO | — |
| C | LITROS | (numérico, no string) |
| D | NETO FACTURA ENVASE | COSTE ENVASE, CST ENV, COSTE FACTURA ENVASE |
| E | P.V.P. ENVASE | PVP ENV, PVP ENVASE |
| F | Fecha | (opcional, `YYYY-MM-DD`) |
| G | FAM | (código de familia 2 dígitos, opcional — usado por ADP y Castrol) |

**Nombre de archivo por convención**: `tarifa-skrit-<proveedor>-<YYYY-MM-DD>.xlsx`

Notas:
- LITROS es siempre numérico (no "5L" como string).
- El nombre del producto se reescribe limpio (sin `\xa0`, sin dobles espacios).
- ADP prefija REF con "ADP" (`10005` → `ADP10005`). Repsol / Castrol / Eni conservan la ref original.

## Redondeo de precios

Opciones que la app debe soportar en Skrit:

- **Sin redondeo** (2 decimales) — por defecto.
- **Psicológico ,99** — `Math.floor(pvp) + 0.99`.
- **Psicológico ,95** — `Math.floor(pvp) + 0.95`.
- **Múltiplo de 0,05 €** — para formatos de PVP bajo.
- **Entero** — para formatos grandes (bidón 208L, cuba 1000L).

Nunca redondear internamente antes de mostrar; solo al exportar / mostrar PVP final.

## Trazabilidad

Cada celda calculada en el Excel de salida idealmente lleva fórmula viva (no valor fijo) para que el usuario pueda ajustar en Excel si lo necesita.

**Estado actual**: v0.1 escribe valores fijos. Fórmulas vivas: mejora prevista.
