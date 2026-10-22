# ADR 0086 — Nota aclaratoria de la columna "Beneficio" en el PDF de políticas de precio

**Fecha:** 2026-10-22
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

En el PDF de políticas de precio (ADR 0041/0064), las tablas PVP y Netos Bonus tienen
dos columnas que se confunden: **Margen** (el % configurado en Reglas) y **Beneficio**.
"Beneficio" NO es un importe en € — es el margen real final sobre el PVP de lista
(`(PVP − coste) / PVP`, ver `Pricing.realMargin`), calculado tras el paso 2 de
`Pricing.compute` (ADR 0065: PVP ×2, o ×3 con "1+2", como hueco para descontar al cliente
sin bajar del margen mínimo) y tras el redondeo. Por eso en el nivel PVP "Beneficio" sale
bastante mayor que "Margen" (ej. 500 ml con 1+2: margen 60 % → beneficio 86,7 %), salvo en
PVP Neto y Netos Bonus, donde no hay paso 2 y coinciden (salvo décimas por redondeo y por
el obsequio que se suma al coste en Netos Bonus).

Yako pidió NO renombrar la columna, sino aclararlo con una nota breve bajo las tablas.

## Decisión

Nota de 3 líneas (cursiva, 8 pt, gris) justo debajo de la tabla Netos Bonus y antes de la
sección "Diferencia con la plantilla por defecto", en `renderBrandPolicyPage`
(`pdf-writer.js`). Contenido: Beneficio = margen real final sobre el PVP de lista, antes
de descuentos a cliente; supera al Margen porque el PVP incluye el hueco previsto para
descuentos (×2, o ×3 con 1+2; en PVP Neto y Netos Bonus no hay hueco y coinciden); si al
facturar se aplican descuentos, el margen real se reducirá.

**Verificado que cabe en el A4**: renderizando con jsPDF + autotable el caso más ancho (11
formatos, como la captura de Yako), las dos tablas terminan en y = 224 mm, la nota ocupa
11,4 mm (3 líneas) y quedan 47 mm libres antes del pie para la sección de diferencias. Si
alguna marca tuviera tantas filas que no cupiera, la nota salta a una página nueva en vez
de solaparse con el pie.

## Referencias

- ADR 0041 / 0064 (PDF de políticas de precio), ADR 0065 (paso 2: hueco de descuento).
- `app/js/export/pdf-writer.js`, `app/js/core/pricing.js`.
