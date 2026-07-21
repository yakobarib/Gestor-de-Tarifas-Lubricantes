# ADR 0003 — Parser de litros por regex sobre descripción

**Fecha:** 2026-07-20
**Estado:** Aceptada
**Decidido por:** Claude, validado con datos reales de Yako

## Contexto

Casi ninguna tarifa de proveedor incluye una columna dedicada "litros por envase". El dato viene embebido en la descripción del producto:

- `RACING 4T 5W40 1000L`
- `WIZARD ELIMINA ARAÑAZOS 150ML`
- `PROTECTOR CALCIUM R2 V68 180KG`
- `QUALIFIER BRAKE PARTS CONTACT CLEANER 12X300ML`
- `Nx1` / `1x208` / `4x5` (notación de packaging)

El CRM Skrit necesita el número de litros como valor numérico separado. Sin él, no hay salida útil.

## Decisión

Implementar un parser basado en dos patrones regex complementarios que reconocen L, ML, GR/G y KG, más el patrón NxM. Cuando hay varios candidatos, devolver el mayor (el envase suele ser el número grande).

## Detalle de patrones implementados

### Patrón 1 — NxM con unidad opcional

```regex
(\d+)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*(ML|MLS|L|LT|LTR|LTRS|LITROS?|KG|KGS|GR|GRS|G)?\b
```

Captura:
- `12X300ML` → segundo número 300, unidad ML → 0,3 L
- `1x208` → 208 (sin unidad, asume L)
- `4x5L` → 5 L
- `5x4` → 4 L

### Patrón 2 — Número + unidad obligatoria

```regex
(?:^|[\s\-_(/])(\d+(?:[.,]\d+)?)\s*(ML|MLS|L|LT|LTR|LTRS|LITROS?|KG|KGS|GR|GRS|G)\b
```

Captura:
- `5W40 1000L` → 1000 L
- `500 ML` → 0,5 L
- `180KG` → 180 L equivalentes
- `400GR` → 0,4 L equivalentes

Requiere un separador antes del número (espacio, guión, paréntesis, `/`) para no capturar cifras que forman parte de códigos como `5W40`.

## Conversión a litros equivalentes

| Unidad | Multiplicador → L |
|---|---|
| L / LT / LTR / LITROS | ×1 |
| ML / MLS | ÷1000 |
| GR / GRS / G | ÷1000 (densidad ≈ 1) |
| KG / KGS | ×1 (densidad ≈ 1) |

La aproximación de densidad 1 es aceptable para envases de grasa / aditivo, donde no se vende por litros exactos sino por unidades.

## Selección cuando hay varios candidatos

Se elige el **mayor valor**. Motivación: el envase suele ser el número grande (`RACING 4T 5W40 1000L` genera candidatos {5, 40, 1000} y queremos 1000).

Rango de validación: 0,05 L ≤ candidato ≤ 2000 L. Fuera de eso se descarta.

## Sin canonicalización a bucket

En la primera iteración el parser mapeaba a un bucket canónico (1, 5, 20, 60, 208, 1000…) con tolerancia del 15%. Esto rompía formatos legítimos:
- 18L → 20L (¡mal!)
- 18KG → 20L (¡mal!)
- 45KG → 50L (¡mal!)

**Decisión revisada**: no canonicalizar. Devolver el valor real detectado. El agrupamiento por formato en la UI usa el valor tal cual (18 va a un grupo, 20 va a otro).

## Validación empírica

Contra el Excel real de Repsol (entrada) vs. la salida Skrit generada históricamente por Yako:

| Iteración | Acierto | Fallos principales |
|---|---|---|
| v1 (solo L/LTR/LITROS) | 89,9% | 83 refs con ML no reconocidos |
| v2 (añade ML, GR, KG) | 95,5% | 35 refs con formatos 18/45/180 canonicalizados a 20/50/200 |
| v3 (sin canonicalización + NxM con unidad) | **99,8%** | 2 refs con inconsistencia en la salida Skrit original (error humano previo) |

**Muestra**: 827 de 829 referencias validadas correctamente.

## Consecuencias

### Positivas
- 99,8% de precisión sin intervención humana.
- Filas con detección fallida se marcan en amarillo y son editables inline.

### Negativas / limitaciones
- Descripciones con formatos exóticos (por ejemplo `50 KGS = 20L`, doble unidad) pueden generar candidatos erróneos.
- La densidad 1 para grasas es aproximación; para lubricantes es ~0,85. Aceptable para agrupación pero no para conversión exacta L↔kg.

### Mitigaciones
- Todas las filas con litros no detectados se muestran en amarillo y llevan un input editable inline en la tabla.
- Ampliación futura: permitir override por proveedor (regla específica ADP, Repsol, etc.).

## Referencias

- Módulo `Parser` en `app/index.html`.
- Verificación reproducible: script `verify_parser_v3.py` en histórico de la sesión.
