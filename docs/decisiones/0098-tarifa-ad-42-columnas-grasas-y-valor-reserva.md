# ADR 0098 — Tarifa AD de 42 columnas (aceites, grasas, químicos) y Valor Reserva Bidones y Cubas

**Fecha:** 2026-11-04
**Estado:** Aceptada
**Decidido por:** Yako

## 1. Importar las tarifas AD de noviembre 2026

AD Parts manda ahora un Excel por línea (`Tarifa AD Aceites|Grasas|Quimicos PTarifa 01-11-2026.xlsx`),
todos con la misma hoja `Tarifa` de 42 columnas. Nuevo perfil `profile-ad-parts-tarifa.js`
(registrado antes que los otros perfiles AD; detecta por la cabecera, no por el nombre del fichero):

- La línea la da `FAMILIA ADGLOBAL`: ACEITE MOTOR → `normal` (o `standard` si la descripción dice
  STANDARD), GRASAS → `grasas` (gama nueva de AD Parts), QUIMICOS Y ADITIVOS → `quimico`.
- Coste de factura = `PRECIO COMPRA`; `NETO NETO`, si viene, entra como neto-neto.
- Litros: aceites por los 3 últimos dígitos de la ref; grasas por `PESO (KG)` (los litros de las
  grasas son kg, como en el resto de la app); químicos por la descripción.
- Químicos 20005, 22005 y 26005 se descartan (colisionan con refs de aceites, ADR 0046).
- El triple-neto sigue entrando por su fichero aparte (ADR 0030), tras la tarifa de factura.
- Los perfiles antiguos (hojas AD NORMAL / Coste…) siguen funcionando.

## 2. Valor Reserva Bidones y Cubas

Nueva exportación de compra, siempre disponible, para cualquier marca: solo filas de 200 L / 180 kg
o más (umbral único `liters >= 180`). Valor = coste de tarifa (factura) − coste triple-neto, o, si no
hay, neto-neto. Si falta la tarifa o ambos netos, queda vacío. Es el margen de compra para vender
esos formatos más baratos o para obsequiar. Independiente de "Valor Regalo 1+1" (que depende del
modo 1+2 del PVP y de las unidades por caja).
