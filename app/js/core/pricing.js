/* ============================================================================
   MÓDULO: pricing  (cálculo de PVP y agregados)
   ============================================================================ */
const Pricing = (() => {

  /**
   * PVP a partir de coste y % de margen.
   * @param {number} cost       coste por envase.
   * @param {number} marginPct  % introducido por el usuario.
   * @param {string} mode       'sale' (margen sobre venta) o 'cost' (markup sobre compra).
   *
   * Fórmulas:
   *   sale: PVP = Coste / (1 - m/100)     (30% → PVP = 100/0,70 = 142,86)
   *   cost: PVP = Coste × (1 + m/100)     (30% → PVP = 100 × 1,30 = 130,00)
   */
  function pvpFromMargin(cost, marginPct, mode) {
    if (!cost || cost <= 0) return 0;
    const raw = marginPct || 0;
    if (mode === 'cost') {
      const m = Math.max(0, Math.min(500, raw));
      return cost * (1 + m / 100);
    }
    // Modo por defecto: sale
    const m = Math.max(0, Math.min(94.99, raw));
    return cost / (1 - m / 100);
  }

  /** Margen real sobre venta tras redondeo (para columna informativa). */
  function realMargin(cost, pvp) {
    if (!pvp || pvp <= 0) return 0;
    return ((pvp - cost) / pvp) * 100;
  }

  /** Redondeo configurable. */
  function round(value, mode) {
    if (!isFinite(value)) return 0;
    switch (mode) {
      case 'none': return value;
      case '2dec': return Math.round(value * 100) / 100;
      case 'psy99': return Math.floor(value) + 0.99;
      case 'psy95': return Math.floor(value) + 0.95;
      case 'step05': return Math.round(value * 20) / 20;
      case 'int': return Math.round(value);
      default: return Math.round(value * 100) / 100;
    }
  }

  /**
   * Aplica un "nivel de precio" a una fila → devuelve campos calculados.
   *
   * `levelConfig` acepta dos formas:
   *  - la config "legacy" plana (defaultMargin/byFormat/rounding/marginMode/manualPvp),
   *    tal como la usa hoy la pantalla de Importación — se sigue leyendo tal cual.
   *  - un nivel de `priceLevels` (ver ADR 0008): añade `baseCostField` (de qué campo
   *    de la fila sale el coste — 'costPerPack' por defecto, o 'costNetoNeto') y
   *    `manualOverride` (alias de `manualPvp`).
   *
   * Si el coste base de ese nivel no existe todavía en la fila (ej. costNetoNeto
   * aún no auditado para ese proveedor), se devuelve `noCost: true` sin bloquear
   * el resto — el hueco se rellena proveedor a proveedor.
   *
   * Si hay un valor manual fijado para esta ref, manda sobre el cálculo por
   * margen — caso real: Albert fija a mano el PVP de ciertos formatos (5L, y a
   * veces formatos grandes) en AD Parts. Se respeta tal cual lo escribe el
   * usuario, sin redondeo.
   */
  function compute(row, levelConfig) {
    const cfg = levelConfig || {};
    const costField = cfg.baseCostField || 'costPerPack';
    const cost = row[costField];

    const manualMap = cfg.manualOverride || cfg.manualPvp || {};
    const manual = manualMap[row.ref];
    const isManual = typeof manual === 'number' && isFinite(manual) && manual > 0;

    if (cost == null && !isManual) {
      return { marginPct: null, mode: cfg.marginMode || cfg.mode || 'sale', pvp: null, gain: null, realMarginPct: null, isManual: false, noCost: true };
    }

    const marginPct = (cfg.byFormat && cfg.byFormat[row.formatKey] != null)
      ? cfg.byFormat[row.formatKey]
      : cfg.defaultMargin;
    const mode = cfg.marginMode || cfg.mode || 'sale';

    let pvp;
    if (isManual) {
      pvp = manual;
    } else {
      const pvpRaw = pvpFromMargin(cost, marginPct, mode);
      pvp = round(pvpRaw, cfg.rounding);
    }
    const gain = cost != null ? pvp - cost : null;
    return {
      marginPct,
      mode,
      pvp,
      gain,
      realMarginPct: cost != null ? realMargin(cost, pvp) : null,
      isManual,
      noCost: false
    };
  }

  /** Texto de fórmula para mostrar en UI. */
  function formulaText(mode) {
    return mode === 'cost'
      ? 'PVP = Coste × (1 + %/100)'
      : 'PVP = Coste / (1 − %/100)';
  }

  return { pvpFromMargin, realMargin, round, compute, formulaText };
})();
