/* ==========================================================================
   PERFIL: AD Parts — Producto Químico
   Estructura distinta a la de aceites: hoja "Coste" (+ opcional "Coste-SC")
   organizada en secciones por familia (fila con descripción y ref vacía =
   cabecera de sección) seguidas de filas de producto. Sin columna de
   litros — se extraen de la descripción con el parser genérico. Hoja "PVP"
   trae precios escalonados por cantidad (1 ud / cajas…); solo interesa el
   precio base, que no se necesita para el cálculo de margen en la app
   (se recalcula desde el coste), así que no se lee.
   ========================================================================== */
(() => {
  const sheetRows = ExcelReader.sheetRows;
  const findRefHeader = ExcelReader.findRefHeader;

  function readADPartsQuimicoSheet(workbook, sheetName) {
    const raw = sheetRows(workbook, sheetName);
    if (!raw) return [];
    const h = findRefHeader(raw);
    if (!h) return [];
    const colLabel = h.colProd >= 0 ? h.colProd : 0;
    const rows = [];
    let familia = null;
    for (let i = h.headerIdx + 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const label = r[colLabel];
      const refRaw = r[h.colRef];
      if (refRaw == null) {
        // Fila sin ref: cabecera de sección (familia) si trae texto.
        if (label) familia = String(label).trim();
        continue;
      }
      const cost = r[h.colCost];
      if (typeof cost !== 'number' || !isFinite(cost)) continue;
      const ref = String(refRaw).replace(/\./g, '').trim();
      const description = Parser.cleanDescription(label);
      const liters = Parser.extractLiters(description);
      rows.push({
        ref: 'ADP' + ref,
        description,
        liters,
        formatKey: Parser.formatKey(liters),
        costPerPack: cost,
        familia,
        gama: 'default',
        litersDetected: liters != null
      });
    }
    return rows;
  }

  ExcelReader.registerProfile({
    id: 'ad_parts_quimico',
    name: 'AD Parts Producto Químico',
    detect(filename, workbook) {
      const f = (filename || '').toLowerCase();
      if (f.includes('quimico') || f.includes('químico')) return true;
      const names = workbook.SheetNames;
      return names.includes('Coste') && names.includes('PVP') && !names.includes('ADStandard');
    },
    read(workbook) {
      const rows = [
        ...readADPartsQuimicoSheet(workbook, 'Coste'),
        ...readADPartsQuimicoSheet(workbook, 'Coste-SC')
      ];
      return { supplier: 'AD Parts Producto Químico', gamas: ['default'], rows, sheetUsed: 'Coste / Coste-SC' };
    }
  });
})();
