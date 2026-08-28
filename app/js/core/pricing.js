/* ============================================================================
   MÓDULO: pricing  (cálculo de PVP y agregados)
   ============================================================================ */
const Pricing = (() => {

  // Modos especiales por formato dentro del nivel PVP (ver ADR 0065 — reemplaza el
  // esquema de ADR 0026 v2, que sustituía el margen por una fórmula fija): "1+2" y
  // "PVP Neto en Bidones y Cubas" YA NO cambian el margen en sí — el margen paso 1
  // sigue siendo siempre el de la casilla (byFormat o, si está vacía, el margen por
  // defecto). Lo que cambia es el paso 2, "hueco para poder descontar al cliente sin
  // bajar del margen mínimo marcado":
  //   - Formato normal (ni "1+2" ni "Bidones y Cubas"): al resultado del paso 1 se le
  //     aplica un segundo paso ÷0,5 (equivale a ×2) — deja hueco para hasta un 50% de
  //     descuento a cliente sin perder el margen mínimo.
  //   - "1+2": el segundo paso es ÷(1/3) (equivale a ×3, hueco para hasta ~66% de
  //     descuento) — el cliente "paga 1 caja y se lleva 3".
  //   - "PVP Neto en Bidones y Cubas": SIN paso 2 — el resultado final es el del paso 1
  //     tal cual (son formatos grandes, sin margen de descuento a cliente por diseño).
  const PROMO_1X2_STEP2_DIVISOR = 1 / 3;
  const NORMAL_STEP2_DIVISOR = 0.5;

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
  /**
   * Coste base de la fila para este nivel. Si el nivel trae `costCascade` (lista de
   * campos en orden de preferencia — ej. Netos Bonus: triple-neto si existe, si no
   * neto-neto, si no factura, "siempre el precio más bajo disponible" según Yako),
   * se usa el primero que la fila tenga; si no, el campo único `baseCostField` de
   * siempre.
   */
  function resolveCost(row, cfg) {
    if (cfg.costCascade && cfg.costCascade.length) {
      for (const field of cfg.costCascade) {
        if (typeof row[field] === 'number' && isFinite(row[field])) return row[field];
      }
      return null;
    }
    return row[cfg.baseCostField || 'costPerPack'];
  }

  function compute(row, levelConfig) {
    const cfg = levelConfig || {};
    const cost = resolveCost(row, cfg);

    const manualMap = cfg.manualOverride || cfg.manualPvp || {};
    const manual = manualMap[row.ref];
    const isManual = typeof manual === 'number' && isFinite(manual) && manual > 0;

    // Niveles restringidos a ciertos formatos (ej. "Bidones y Cubas Neto", solo
    // envases ~200L/1000L) — fuera de esos formatos no hay precio, no un PVP al
    // margen por defecto (0%). Ver ADR 0015.
    if (cfg.onlyFormats && !cfg.onlyFormats.includes(row.formatKey) && !isManual) {
      return { marginPct: null, mode: cfg.marginMode || cfg.mode || 'sale', pvp: null, gain: null, realMarginPct: null, isManual: false, noCost: true };
    }
    // Niveles restringidos por umbral de litros (ej. "1+2", solo envases de hasta 5L —
    // a diferencia de `onlyFormats`, que es una lista fija de formatKeys conocidos, aquí
    // el límite es un número y aplica a cualquier litraje real por debajo, ver ADR 0026).
    // Sin litros detectados no se puede confirmar que cumpla el umbral — se excluye.
    if (cfg.maxLiters != null && !isManual) {
      if (row.liters == null || row.liters > cfg.maxLiters) {
        return { marginPct: null, mode: cfg.marginMode || cfg.mode || 'sale', pvp: null, gain: null, realMarginPct: null, isManual: false, noCost: true };
      }
    }

    if (cost == null && !isManual) {
      return { marginPct: null, mode: cfg.marginMode || cfg.mode || 'sale', pvp: null, gain: null, realMarginPct: null, isManual: false, noCost: true };
    }

    // Modo especial por formato (nivel PVP, mutuamente excluyente — ver ADR 0026 v2):
    // el margen paso 1 es SIEMPRE el de la casilla (byFormat o, si no hay, el margen por
    // defecto) — "1+2"/"PVP Neto en Bidones y Cubas" ya no lo sustituyen (ver ADR 0065),
    // solo deciden el paso 2 más abajo.
    const formatMode = cfg.formatModes && cfg.formatModes[row.formatKey];
    const marginPct = (cfg.byFormat && cfg.byFormat[row.formatKey] != null)
      ? cfg.byFormat[row.formatKey]
      : cfg.defaultMargin;
    const mode = cfg.marginMode || cfg.mode || 'sale';

    // "Precio del premio" (ej. Netos Bonus: 50€ bidones / 100€ cubas) — un importe
    // fijo que se suma al coste ANTES de aplicar el margen, no un coste real de la
    // fila. Ver ADR 0016.
    const premium = (cfg.premiumByFormat && cfg.premiumByFormat[row.formatKey]) || 0;
    const costWithPremium = cost != null ? cost + premium : cost;

    let pvp;
    if (isManual) {
      pvp = manual;
    } else {
      // Paso 1: margen sobre el coste (+obsequio), fórmula de siempre.
      const step1 = pvpFromMargin(costWithPremium, marginPct, mode);
      // Paso 2 (ver ADR 0065): hueco para poder descontar al cliente sin bajar del
      // margen mínimo marcado — SOLO aplica al nivel PVP (`cfg.id === 'pvp'`). Netos
      // Bonus no es un precio de venta con descuento a cliente (son hojas internas para
      // comerciales, nunca va a Skrit) — se queda con el resultado del paso 1 tal cual,
      // igual que antes de ADR 0065. Dentro de PVP, se salta el paso 2 entero si el
      // formato es "PVP Neto en Bidones y Cubas" (formatos grandes, sin ese margen de
      // descuento por diseño).
      const pvpRaw = (cfg.id !== 'pvp' || formatMode === 'pvp_neto')
        ? step1
        : step1 / (formatMode === '1x2' ? PROMO_1X2_STEP2_DIVISOR : NORMAL_STEP2_DIVISOR);
      pvp = round(pvpRaw, cfg.rounding);
    }
    const gain = costWithPremium != null ? pvp - costWithPremium : null;
    return {
      marginPct,
      mode,
      pvp,
      gain,
      realMarginPct: costWithPremium != null ? realMargin(costWithPremium, pvp) : null,
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

  return { pvpFromMargin, realMargin, round, compute, formulaText, resolveCost };
})();
