# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [v0.1] — 2026-07-20

### Añadido
- MVP tarifador con importación de tarifa Repsol vía drag & drop.
- Parser de litros con reconocimiento de L, ML, GR, KG y patrón NxM (99,8% acierto vs. Skrit real).
- Configuración de margen sobre venta por formato con preview en vivo.
- Redondeo psicológico configurable (2 dec / ,99 / ,95 / múltiplo 0,05 / entero).
- Exportación a formato Skrit (5 columnas + fecha).
- Persistencia en localStorage + perfiles guardables por nombre.
- Filtros por texto libre y por formato en la tabla preview.
- Edición manual inline de litros en filas con detección fallida.
- KPIs agregados: nº refs, coste total, PVP total, margen medio real.

### Arquitectura
- Single-file HTML + SheetJS + Pico.css vía CDN.
- Módulos internos: Storage, Parser, ExcelReader, Pricing, ExcelWriter, UI.

### Documentado
- Reglas de negocio (heterogeneidad tarifas, litros/envase, casuística AD Parts, tasas).
- Roadmap por fases (Fase 0 → 4).
- ADR: single-file HTML.
- ADR: margen sobre venta vs. markup sobre coste.
- ADR: parser de litros con 5 patrones.

## [v0.0] — 2026-05-14

### Añadido
- Spec técnica en `BASE DE CONOCIMIENTO/tarifador-aceites-spec.md`.
- Ejemplos reales de entrada/salida Skrit para Repsol, AD Parts, Eni Live, Castrol, Racing Oil.
- Documento `CONSIDERACIONES/Consideraciones.docx` con casuísticas de negocio.
- Plan por fases acordado.
