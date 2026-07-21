# ADR 0002 — Margen sobre venta como modelo por defecto

**Fecha:** 2026-07-20
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

El precio de venta al público (PVP) se calcula desde el coste aplicando algún tipo de recargo. Existen varias formulaciones equivalentes matemáticamente pero distintas conceptualmente:

- **Markup sobre coste**: `PVP = Coste × (1 + markup/100)`.
  Ejemplo: coste 100 € + 30% markup → PVP = 130 €.
- **Margen sobre venta**: `PVP = Coste / (1 − margen/100)`.
  Ejemplo: coste 100 € + 30% margen → PVP = 142,86 €.
- **Multiplicador directo**: `PVP = Coste × multiplicador`.
  Ejemplo: coste 100 € × 1,5 → PVP = 150 €.
- **Importe fijo**: `PVP = Coste + X €`.

La spec original (`tarifador-aceites-spec.md`) especificaba **markup sobre coste** con nota "Importante: es markup sobre coste, NO margen sobre venta. No confundir." Al construir el MVP Yako revisó y prefirió cambiar a margen sobre venta.

## Decisión

**Usar margen sobre venta como modelo por defecto.**

Fórmula:
```
PVP = Coste / (1 − margen/100)
```

## Motivación

- **Es el modelo que aparece en las políticas oficiales de PVP y Netos 2026** del sector aftermarket. Alineamos la app con el lenguaje que ya usa el equipo comercial y el jefe (Albert).
- **Los comerciales piensan en "margen"**, no en "markup". Cuando dicen "quiero ganar el 30%" se refieren a que el 30% del PVP sea ganancia, no que el PVP sea 130% del coste.
- **Consistencia con proveedores**: cuando un proveedor te dice "tienes un margen del 20%", habla de margen sobre venta.

## Consecuencias

### Positivas
- Alineación con el vocabulario del negocio.
- Cálculos coinciden directamente con `POLITICA PVP Y NETOS 2026.xlsx`.

### Negativas / trade-offs aceptados
- Divergencia con la spec original. Documentado aquí para evitar confusión futura.
- Cifras aparentemente altas para quien viene de markup: 50% margen sobre venta = 100% markup sobre coste. Se mitiga mostrando ambos valores en la UI si es útil.

## Otros modelos que se soportarán (Fase 1+)

Confirmados por Yako en la sesión del 2026-07-20 aunque no todos están implementados en v0.1:

- **% sobre venta (margen)** — implementado en v0.1. Por defecto.
- **% sobre coste (markup)** — a añadir como opción alternativa por formato.
- **Multiplicador directo (×2,3, ×1,8…)** — útil cuando hay una intuición rápida.
- **Importe fijo en € por envase** — útil en formatos grandes (208L, 1000L) donde el % se descontrola.

El objetivo es que Yako pueda elegir el modelo por marca / formato según cómo prefiera pensar en ese caso concreto.

## Referencias

- `BASE DE CONOCIMIENTO/POLITICA PVP Y NETOS 2026.xlsx`
- [docs/reglas-negocio.md](../reglas-negocio.md)
