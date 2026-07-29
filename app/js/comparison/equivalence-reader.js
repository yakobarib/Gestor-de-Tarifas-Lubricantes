/* ============================================================================
   MÓDULO: EquivalenceReader  (lectura de los Excel de equivalencias entre
   marcas — BASE DE CONOCIMIENTO/Equivalencias *.xlsx, ver ADR 0008)
   ============================================================================
   Dos formatos reales distintos:
   - "spec": 1 fila = 1 grupo de equivalencia directo. Columnas de spec técnica
     (VISCO/ACEA/ILSAC/AD/LITROS) + 1 columna de referencia por marca. Valores
     especiales SIN EQUIVALENCIA / SIN ACTUALIZAR / EN OTROS FORMATOS se ignoran.
     (Fichero real: "Equivalencias Aceites por Marcas.xlsx".)
   - "block": fila 1 = nombre de marca cada bloque de columnas (con huecos de
     separador), fila 2 = REFERENCIA/DESCRIPCCIÓN/LITROS|KG por bloque, filas
     de datos con carry-forward en las columnas de spec compartida cuando
     vienen vacías (confirmado en los ficheros reales: SAE/DIN/COMP/NLGI se
     mantienen a través de varias filas de tamaños distintos del mismo
     producto). (Ficheros reales: Grasas, Hidraulicos, Motor Vehículo
     Industrial, Transmisión Manual y Ejes.)
   Ambos devuelven el mismo shape: { groups: [{ groupId, specs, members }] }
   con members: [{ brandKey, ref, description?, size? }].
*/
const EquivalenceReader = (() => {
  const IGNORED_VALUES = new Set(['SIN EQUIVALENCIA', 'SIN ACTUALIZAR', 'EN OTROS FORMATOS', '']);

  function sheetRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  }

  /** Formato "spec" — ej. Equivalencias Aceites por Marcas.xlsx. */
  function readSpecFormat(workbook, sheetName, categoryPrefix) {
    const raw = sheetRows(workbook, sheetName);
    if (!raw || !raw.length) return { groups: [] };
    const header = raw[0].map(h => (h == null ? null : String(h).trim()));

    let specEnd = header.findIndex(h => h == null);
    if (specEnd < 0) specEnd = header.length;
    const specCols = [];
    for (let c = 0; c < specEnd; c++) specCols.push({ idx: c, name: header[c] });
    const brandCols = [];
    for (let c = specEnd; c < header.length; c++) {
      if (header[c]) brandCols.push({ idx: c, name: header[c] });
    }

    const groups = [];
    for (let r = 1; r < raw.length; r++) {
      const row = raw[r];
      if (!row) continue;
      const specs = {};
      specCols.forEach(sc => { specs[sc.name] = row[sc.idx]; });
      const members = [];
      for (const bc of brandCols) {
        const val = row[bc.idx];
        if (val == null) continue;
        const s = String(val).trim();
        if (IGNORED_VALUES.has(s.toUpperCase())) continue;
        members.push({ brandKey: bc.name, ref: s });
      }
      if (members.length) groups.push({ groupId: `${categoryPrefix}_spec_${r}`, specs, members });
    }
    return { groups };
  }

  /** Formato "block" — ej. Equivalencias Grasas/Hidraulicos/Motor VI/Transmisión. */
  function readBlockFormat(workbook, sheetName, categoryPrefix) {
    const raw = sheetRows(workbook, sheetName);
    if (!raw || raw.length < 3) return { groups: [] };
    const blockRow = raw[0].map(x => (x == null ? null : String(x).trim()));
    const fieldRow = raw[1].map(x => (x == null ? null : String(x).trim()));

    const blockStarts = [];
    for (let c = 0; c < blockRow.length; c++) {
      if (blockRow[c]) blockStarts.push({ col: c, label: blockRow[c] });
    }
    const blocks = blockStarts.map((b, i) => ({
      ...b,
      end: i + 1 < blockStarts.length ? blockStarts[i + 1].col : fieldRow.length
    }));
    const propBlock = blocks.find(b => /PROPIEDADES/i.test(b.label));
    const brandBlocks = blocks.filter(b => b !== propBlock);

    const propFields = propBlock
      ? Array.from({ length: propBlock.end - propBlock.col }, (_, i) => propBlock.col + i)
          .map(c => ({ idx: c, name: fieldRow[c] }))
          .filter(f => f.name)
      : [];

    const groups = [];
    const lastSpec = {};
    for (let r = 2; r < raw.length; r++) {
      const row = raw[r];
      if (!row) continue;
      const specs = {};
      for (const f of propFields) {
        const v = row[f.idx];
        if (v != null) lastSpec[f.name] = v;
        specs[f.name] = v != null ? v : lastSpec[f.name];
      }
      const members = [];
      for (const b of brandBlocks) {
        const cols = {};
        for (let c = b.col; c < b.end; c++) {
          const name = (fieldRow[c] || '').toUpperCase();
          if (name.includes('REFERENCIA')) cols.ref = c;
          else if (name.includes('DESCRIP')) cols.desc = c;
          else if (name.includes('LITROS') || name.includes('KG')) cols.size = c;
        }
        if (cols.ref == null) continue;
        const refVal = row[cols.ref];
        if (refVal == null || refVal === '') continue;
        members.push({
          brandKey: b.label,
          ref: String(refVal).trim(),
          description: cols.desc != null ? row[cols.desc] : null,
          size: cols.size != null ? row[cols.size] : null
        });
      }
      if (members.length) groups.push({ groupId: `${categoryPrefix}_block_${r}`, specs, members });
    }
    return { groups };
  }

  /**
   * Lee uno de los 5 ficheros conocidos de BASE DE CONOCIMIENTO por su nombre
   * de fichero, detectando cuál de los dos formatos usa.
   */
  function readKnownFile(filename, workbook) {
    const f = (filename || '').toLowerCase();
    if (f.includes('aceites por marcas')) {
      return { category: 'aceites', ...readSpecFormat(workbook, 'EQUIVALENCIAS', 'aceites') };
    }
    if (f.includes('grasas')) {
      return { category: 'grasas', ...readBlockFormat(workbook, workbook.SheetNames[0], 'grasas') };
    }
    if (f.includes('hidraulicos') || f.includes('hidráulicos')) {
      return { category: 'hidraulicos', ...readBlockFormat(workbook, workbook.SheetNames[0], 'hidraulicos') };
    }
    if (f.includes('vehiculo industrial') || f.includes('vehículo industrial')) {
      return { category: 'motor_industrial', ...readBlockFormat(workbook, workbook.SheetNames[0], 'motor_industrial') };
    }
    if (f.includes('transmisi')) {
      return { category: 'transmision_ejes', ...readBlockFormat(workbook, workbook.SheetNames[0], 'transmision_ejes') };
    }
    // Fallback: intenta formato spec si tiene una hoja EQUIVALENCIAS, si no, block sobre la primera hoja.
    if (workbook.SheetNames.includes('EQUIVALENCIAS')) {
      return { category: 'desconocida', ...readSpecFormat(workbook, 'EQUIVALENCIAS', 'desconocida') };
    }
    return { category: 'desconocida', ...readBlockFormat(workbook, workbook.SheetNames[0], 'desconocida') };
  }

  return { readSpecFormat, readBlockFormat, readKnownFile };
})();
