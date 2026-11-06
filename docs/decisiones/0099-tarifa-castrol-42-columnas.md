# ADR 0099 — Tarifa Castrol en el formato de 42 columnas

**Fecha:** 2026-11-06
**Estado:** Aceptada

## Contexto

Con `tarifa_castrol_3859_5_11_2026.xlsx` Castrol deja su formato antiguo (MATERIAL, PRECIO UNITARIO
por litro, descuentos en cascada) y manda la misma hoja `Tarifa` de 42 columnas que AD Parts (ADR 0098).
Sin cambios, el perfil de AD la habría tomado por una tarifa de AD (registrado antes y detectaba solo
por columnas).

## Decisión

- `profile-castrol.js` lee también el formato nuevo (`readCastrolTarifaMaestra`): referencia =
  REF PROVEEDOR; coste del envase = `PRECIO COMPRA / UD CAJA` (en Castrol el precio es por unidad de
  venta, o sea por caja de 4X5L o 12X1L; en AD ya es por envase); litros del maestro verificado, si no
  los de la descripción; unidades por caja = UD CAJA.
- La gama (línea) sale de la primera palabra de la descripción — edge, magnatec, vecton, crb,
  transmax, ON → castrol-on, GTX → gtx-5w si es 5W-xx y gtx si no — y lo demás, `other`. Comprobado
  con las 366 refs ya guardadas: gama y litros idénticos.
- NETO NETO, si algún día viene, entra como neto-neto del envase. La tarifa nueva no trae triple-neto.
- El perfil de AD ignora ficheros cuya columna MARCA sea CASTROL o cuyo nombre contenga "castrol".
- Castrol sale de las marcas que reescalan el coste al corregir litros (ADR 0097): con el formato nuevo
  el coste no depende de los litros y reescalarlo lo estropearía. Shell conserva ese comportamiento.
- El formato antiguo sigue soportado.
