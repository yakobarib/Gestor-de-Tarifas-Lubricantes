/* ============================================================================
   MÓDULO: parser  (extracción de litros, formato canónico)
   ============================================================================ */
const Parser = (() => {

  /** Helper interno: convierte número + unidad a litros equivalentes. */
  function toLiters(value, unit) {
    const u = (unit || '').toUpperCase();
    if (u === 'ML' || u === 'MLS') return value / 1000;
    if (u === 'GR' || u === 'GRS' || u === 'G') return value / 1000; // densidad ≈ 1
    if (u === 'KG' || u === 'KGS') return value;                     // 1 kg ≈ 1 L
    return value; // L / LT / LTR / LITROS / sin unidad
  }

  /**
   * Extrae litros (equivalentes) desde una descripción de producto.
   * Reconoce L/LT/LTR/LITROS, ML, GR/G/KG y patrón NxM (12X300ML, 1X208, 5X4, etc.).
   * Devuelve el MAYOR candidato razonable (el envase suele ser el número grande).
   * El valor devuelto es el REAL extraído (no bucketizado): 18, 45, 180, 18.5… se respetan.
   */
  function extractLiters(description) {
    if (!description || typeof description !== 'string') return null;
    const desc = description.trim();
    const candidates = [];

    // Patrón 1: NxM con unidad opcional al final → 12X300ML, 1X208L, 5X4, 4x5L
    // Separador decimal: coma, punto o apóstrofe ("0'5L" aparece en tarifas AD Parts Químico).
    const reNxM = /(\d+)\s*[xX]\s*(\d+(?:[.,']\d+)?)\s*(ML|MLS|L|LT|LTR|LTRS|LITROS?|KG|KGS|GR|GRS|G)?\b/gi;
    let m;
    while ((m = reNxM.exec(desc)) !== null) {
      const v = parseFloat(m[2].replace(/[,']/, '.'));
      const liters = toLiters(v, m[3]);
      if (liters >= 0.05 && liters <= 2000) candidates.push(liters);
    }

    // Patrón 2: número suelto + unidad obligatoria (ej. "5W40 1000L", "500 ML", "180KG", "0'5L")
    const reUnit = /(?:^|[\s\-_(/])(\d+(?:[.,']\d+)?)\s*(ML|MLS|L|LT|LTR|LTRS|LITROS?|KG|KGS|GR|GRS|G)\b/gi;
    while ((m = reUnit.exec(desc)) !== null) {
      const v = parseFloat(m[1].replace(/[,']/, '.'));
      const liters = toLiters(v, m[2]);
      if (liters >= 0.05 && liters <= 2000) candidates.push(liters);
    }

    // Patrón 3 (respaldo, solo si ningún patrón anterior encontró nada): código de
    // familia terminado en "-NNN" sin unidad explícita — ej. "GREASE CG-400" — Yako
    // confirma que ese sufijo es el peso en gramos del envase (400 → 0,4 L para
    // nosotros, misma equivalencia 1g≈1ml que ya usa `toLiters` con GR/KG). Se excluye
    // si el código es en realidad una viscosidad tipo "5W-40"/"10W-60" (el trozo antes
    // del guion es dígitos+W), que no es un tamaño de envase.
    if (candidates.length === 0) {
      const mCode = /\b([A-Z]{1,6})-(\d{2,4})\s*$/i.exec(desc);
      if (mCode && !/^\d+W$/i.test(mCode[1])) {
        const grams = parseInt(mCode[2], 10);
        if (grams >= 50 && grams <= 2000) candidates.push(grams / 1000);
      }
    }

    if (candidates.length === 0) return null;
    return Math.max(...candidates);
  }

  /**
   * Devuelve la clave de agrupación para configuración de margen.
   * Usa el valor real (no redondea). Solo agrupa con tolerancia muy estrecha
   * para que 1.0 y 1.00 se traten igual, pero 18 y 20 sean distintos.
   */
  function formatKey(liters) {
    if (liters == null) return '?';
    // Redondea a 3 decimales para evitar duplicados por flotantes
    return String(Math.round(liters * 1000) / 1000);
  }

  /** Etiqueta legible del formato (1 L, 500 ml, 18 kg si se infiere…). */
  function formatLabel(liters) {
    if (liters == null) return 'Sin detectar';
    if (liters < 1) return `${Math.round(liters * 1000)} ml`;
    if (Number.isInteger(liters)) return `${liters} L`;
    return `${liters.toFixed(2)} L`;
  }

  /** Limpia la descripción del producto para la salida. */
  function cleanDescription(s) {
    if (!s) return '';
    return String(s).replace(/\s+/g, ' ').replace(/\xa0/g, ' ').trim();
  }

  /**
   * Litros a partir de los últimos 3 dígitos de la referencia (sin puntos).
   * Regla descubierta en las tarifas reales de AD Parts: la referencia codifica
   * el formato (ej. 10005 → 5L, 741208 → 208L), con el caso especial '000' → 1000L.
   * Más fiable que parsear la descripción: en la gama Standard la descripción es
   * siempre igual para todos los formatos ("AD STANDARD SC 5W30"), solo la ref
   * distingue el tamaño del envase.
   */
  function litersFromRefSuffix(ref) {
    if (!ref) return null;
    const digits = String(ref).replace(/[^\d]/g, '');
    if (digits.length < 3) return null;
    const suffix = digits.slice(-3);
    if (suffix === '000') return 1000;
    const n = parseInt(suffix, 10);
    return isFinite(n) ? n : null;
  }

  /** Texto de cualquier tarifa de SALIDA (Excel/PDF/pantalla) en mayúsculas — homogeneiza
   *  entre marcas que entran con distinta capitalización (ver ADR 0034). No toca los
   *  datos del maestro, solo se aplica en el punto de salida. */
  function upperOut(s) {
    return String(s ?? '').toUpperCase();
  }

  /** Referencia de salida: mayúsculas y sin espacios (algunas tarifas de proveedor
   *  traen la ref con espacios sueltos) — ver ADR 0034. */
  function upperRef(s) {
    return String(s ?? '').toUpperCase().replace(/\s+/g, '');
  }

  return { extractLiters, formatKey, formatLabel, cleanDescription, litersFromRefSuffix, upperOut, upperRef };
})();
