/* ============================================================================
   MÓDULO: excelReader  (lectura específica por proveedor — un perfil por
   proveedor, ver ADR 0005 y ADR 0007. Cada perfil sabe detectar su propio
   Excel y devolver filas normalizadas { ref, description, liters, formatKey,
   costPerPack, gama, litersDetected, ... }).

   Los perfiles concretos (RepsolProfile, ADPartsAceiteProfile,
   ADPartsQuimicoProfile) viven en ficheros separados y se registran aquí vía
   ExcelReader.registerProfile() — cargar este fichero ANTES que los perfiles.
   ============================================================================ */
const ExcelReader = (() => {
  const PROFILES = [];

  /** Helper: hoja completa como array de arrays (fila 0 = cabecera cruda). */
  function sheetRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  }

  /**
   * Localiza, en las primeras filas de una hoja "de trabajo" AD Parts
   * (Coste / ADStandard / CosteSC), la fila de cabecera que contiene "ref."
   * y devuelve los índices de columna relevantes. El coste vigente siempre
   * está en la columna inmediatamente a la derecha de "ref." — su cabecera
   * es una fecha variable mes a mes, así que se localiza por posición, no
   * por nombre.
   */
  function findRefHeader(raw) {
    for (let i = 0; i < raw.length; i++) {
      const row = (raw[i] || []).map(x => String(x || '').toLowerCase().trim());
      const colRef = row.findIndex(c => c === 'ref.' || c === 'ref');
      if (colRef >= 0) {
        // CosteSC trae dos columnas "ref." seguidas (numérica + con puntos)
        // antes de la columna de coste — si la siguiente también es "ref.",
        // el coste está una columna más allá.
        const nextIsAlsoRef = row[colRef + 1] === 'ref.' || row[colRef + 1] === 'ref';
        return {
          headerIdx: i,
          colRef,
          colCost: nextIsAlsoRef ? colRef + 2 : colRef + 1,
          colProd: row.findIndex(c => c.includes('producto')),
          colEnvase: row.findIndex(c => c.includes('envase'))
        };
      }
    }
    return null;
  }

  function registerProfile(profile) {
    PROFILES.push(profile);
  }

  /** Punto de entrada: itera los perfiles registrados hasta encontrar uno que detecte el Excel. */
  function read(arrayBuffer, filename) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    for (const profile of PROFILES) {
      if (profile.detect(filename, workbook)) {
        const result = profile.read(workbook);
        result.id = profile.id;
        return result;
      }
    }
    throw new Error('No se reconoce el formato de esta tarifa. Proveedores soportados: Repsol, AD Parts (Normal / Standard / Sport Car / Químicos) y Eni Live.');
  }

  return { read, registerProfile, sheetRows, findRefHeader };
})();
