# ADR 0018 — Perfil Shell: precio por litro, no por envase

**Fecha:** 2026-07-31
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Cuarto proveedor de la sesión. Yako lo describió como "sencilla también": una sola hoja,
columnas A (ref), B (descripción), C (litros), D (gama), E ("nuestro precio de factura,
sin más descuentos ni aportaciones").

## Decisión: la columna de precio es €/litro

Al abrir el fichero real, la cabecera de la columna E dice literalmente **"Precio
€/lt"** — contradice la descripción de Yako de que ya seria el precio de factura por
envase. Se verificó con los números reales: un bidón de 209L con un "precio de factura"
de 5,16€ sería absurdo (esencialmente gratis); 5,16€/L × 209L ≈ 1.078€ es un precio de
bidón industrial realista. También se verificó que el precio/litro es coherente entre
distintos formatos del mismo producto (1L y 4L de la misma referencia dan precios por
litro similares, como cabe esperar de un precio unitario real).

**Se implementa multiplicando `costPerPack = Precio €/lt × Litros envase`.** Este es el
único de los 4 proveedores auditados hasta ahora donde la columna de precio no viene ya
por envase — todos los demás (Repsol tras dividir por UDS X CAJA, AD Parts, Eni Live,
Racing Oil) dan directamente el coste por envase individual.

## Descripción: pendiente de tabla de referencias

`Descripción de Material` es un código SAP interno, no siempre legible (`"Adv4TUlt10W40
SPMA2_12*1L_EURO"`, donde "Advance 4T Ultra" queda abreviado a "Adv4TUlt"). Yako avisó
que iba a pasar una tabla con descripciones antiguas + referencias para reconstruirlas
correctamente — **no se ha recibido todavía**. Solución provisional: se toma el texto
antes del primer `_` (que en gran parte de los casos ya es legible, ej. "Corena S2 P
100") y se le añade el sufijo de litros propio de la app, descartando el resto del
código de origen (unidades×envase + especificación, ya disponibles en columnas
separadas). Los códigos realmente mashed-together sin espacios seguirán crípticos hasta
recibir la tabla de Yako — pendiente, documentado en la ficha de proveedor.

## Litros ya reales, sin bucketizar

A diferencia de Repsol/Eni/Racing Oil, la columna `Litros envase` de Shell ya da el
número exacto real (209, 170, 180, 0.25, 0.38…), no una escala nominal redondeada — no
hace falta ninguna tabla de conversión kg→L ni bucket de rango. Esto simplifica el
perfil, pero implica que al configurar márgenes por formato en Reglas hay que usar la
clave del litraje real (`"209"`), no una versión redondeada (`"200"`).

## Fórmula de PVP histórica de Yako → margen por formato en Reglas

Yako aportó la fórmula que usaba manualmente: `PVP = PRECIO FACTURA / X / 0,50`, con `X`
variable por formato (0,60 para 1L/5L, 0,70 para 20L, 0,74 para 50L/200L, 0,80 para
1000L). Esto es algebraicamente idéntico al modelo "margen sobre venta" que ya usa la
app (`PVP = Coste / (1 - margen/100)`, con `margen = (1 - X × 0,50) × 100`) — se traduce
a un margen por formato (`byFormat`) configurable en Reglas, sin necesidad de código
nuevo ni de un modo de cálculo especial para Shell. Documentado en la ficha de proveedor
como referencia para que Yako los introduzca.

## Consecuencias

- `js/profiles/profile-shell.js`: perfil nuevo, único caso que multiplica precio ×
  litros para obtener el coste por envase.
- `BRANDS.shell` pasa de `pending: true` a `false` con sus 23 gamas reales.
- Probado contra la tarifa real de abril 2026: 491 filas (492 menos 1 duplicado exacto),
  0 sin litros detectados, import → MasterDB → Exportación verificado en navegador.

## Referencias

- `js/profiles/profile-shell.js`.
- [docs/proveedores/shell.md](../proveedores/shell.md)
