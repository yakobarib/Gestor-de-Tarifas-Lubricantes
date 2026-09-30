/* ============================================================================
   MÓDULO: EquivalenceReader  (lectura de los Excel de equivalencias entre
   marcas — BASE DE CONOCIMIENTO/Equivalencias *.xlsx, ver ADR 0008, ADR 0085)
   ============================================================================
   Dos formatos reales distintos:
   - "gama-spec": 1 fila = 1 grupo de equivalencia directo. Columna GAMA (nombre
     de la categoría, informativa — la categoría real la decide el nombre de
     fichero) + columnas de spec técnica (VISCO/ACEA/ILSAC/AD/LITROS) + 1
     columna de referencia por marca, sin descripción. Es el formato que usa
     Yako desde el ADR 0085 para los 7 ficheros de vehículos/hidráulicos —
     mismo espíritu que el antiguo formato "spec" (ADR 0008), con GAMA añadida.
   - "block": fila 1 = nombre de marca cada bloque de columnas (con huecos de
     separador), fila 2 = REFERENCIA/DESCRIPCCIÓN/LITROS|KG por bloque, filas
     de datos con carry-forward en las columnas de spec compartida cuando
     vienen vacías. (Fichero real: Grasas — el único que se queda en este
     formato tras el ADR 0085; antes también lo usaban Hidráulicos/Motor
     Vehículo Industrial/Transmisión, sustituidos por el formato gama-spec.)
   Ambos devuelven el mismo shape: { groups: [{ groupId, specs, members }] }
   con members: [{ brandKey, ref, description?, size?, note? }].

   Tres marcadores de texto libre en las celdas de referencia, ninguno es una
   ref real:
   - "sin equivalencia" (SIN EQUIVALENCIA / SIN ACTUALIZAR / FUERA DE TARIFA):
     esa marca no tiene el producto, punto. Se descarta sin más.
   - "en otros formatos" (EN OTROS FORMATOS / SOLO EN ... LITRO(S)): la marca
     SÍ tiene el producto, pero no en este tamaño — se conserva como miembro
     sin ref, `note: 'otros_formatos'` (Comparación avisa en vez de omitirlo).
   - "pendiente de cruce" (PENDIENTE DE CRUCE): a diferencia de "sin
     equivalencia", NO significa que no exista — significa que Yako todavía no
     ha buscado/confirmado el cruce para esa marca. Se conserva como miembro
     sin ref, `note: 'pendiente_de_cruce'`, para que la UI lo distinga de un
     "no hay nada" real (ver conversación 2026-09-30).
*/
const EquivalenceReader = (() => {
  const NO_EQUIVALENCE_VALUES = new Set(['SIN EQUIVALENCIA', 'SIN ACTUALIZAR', 'FUERA DE TARIFA', '']);
  // Regex en vez de Set exacto para "en otros formatos" — ya han aparecido variantes de
  // texto libre ("SOLO EN 1 LITRO") con el mismo significado que la frase fija.
  const OTHER_FORMATS_RE = /^(EN OTROS FORMATOS|SOLO EN .*LITROS?)$/i;
  const PENDING_CROSS_RE = /^PENDIENTE DE CRUCE$/i;

  /** Clasifica el texto de una celda de referencia: 'ref' (referencia real, se procesa
   *  fuera de esta función), o uno de los tres marcadores sin ref real. */
  function markerFor(upperTrimmed) {
    if (NO_EQUIVALENCE_VALUES.has(upperTrimmed)) return 'sin_equivalencia';
    if (OTHER_FORMATS_RE.test(upperTrimmed)) return 'otros_formatos';
    if (PENDING_CROSS_RE.test(upperTrimmed)) return 'pendiente_de_cruce';
    return null;
  }

  function sheetRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  }

  /** Formato "gama-spec" — los 7 ficheros de vehículos/hidráulicos (ver ADR 0085). La
   *  columna GAMA es solo informativa (para que Yako filtre a mano en el propio Excel);
   *  la categoría real de cada grupo la decide `readKnownFile` por nombre de fichero. */
  function readGamaSpecFormat(workbook, sheetName, categoryPrefix) {
    const raw = sheetRows(workbook, sheetName);
    if (!raw || !raw.length) return { groups: [] };
    const header = raw[0].map(h => (h == null ? null : String(h).trim()));

    const gamaCol = header.findIndex(h => h && h.toUpperCase() === 'GAMA');
    const specStart = gamaCol >= 0 ? gamaCol + 1 : 0;
    let specEnd = header.findIndex((h, i) => i > specStart - 1 && h == null);
    if (specEnd < 0) specEnd = header.length;
    const specCols = [];
    for (let c = specStart; c < specEnd; c++) specCols.push({ idx: c, name: header[c] });
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
        const marker = markerFor(s.toUpperCase());
        if (marker === 'sin_equivalencia') continue;
        if (marker) { members.push({ brandKey: bc.name, ref: null, note: marker }); continue; }
        members.push({ brandKey: bc.name, ref: s });
      }
      if (members.length) groups.push({ groupId: `${categoryPrefix}_spec_${r}`, specs, members });
    }
    return { groups };
  }

  /** Formato "block" — ej. Equivalencias Grasas.xlsx. */
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
        const refUpper = String(refVal).trim().toUpperCase();
        const marker = markerFor(refUpper);
        if (marker === 'sin_equivalencia') continue;
        if (marker) { members.push({ brandKey: b.label, ref: null, note: marker }); continue; }
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
   * Lee uno de los ficheros conocidos de BASE DE CONOCIMIENTO/Equivalencias por su
   * nombre de fichero. Transmisión Automática y Transmisión Manual y Ejes son dos
   * ficheros a propósito (Yako: "mantenerlos separados ayuda a mantenerlos actualizados
   * y limpios") pero comparten la misma categoría ('transmision') — la app los junta
   * sola, sin que haga falta fusionar los ficheros.
   */
  function readKnownFile(filename, workbook) {
    const f = (filename || '').toLowerCase();
    if (f.includes('vehiculo ligero') || f.includes('vehículo ligero')) {
      return { category: 'vehiculo_ligero', ...readGamaSpecFormat(workbook, workbook.SheetNames[0], 'vehiculo_ligero') };
    }
    if (f.includes('vehiculo pesado') || f.includes('vehículo pesado')) {
      return { category: 'vehiculo_pesado', ...readGamaSpecFormat(workbook, workbook.SheetNames[0], 'vehiculo_pesado') };
    }
    if (f.includes('vehiculo agricola') || f.includes('vehículo agrícola')) {
      return { category: 'vehiculo_agricola', ...readGamaSpecFormat(workbook, workbook.SheetNames[0], 'vehiculo_agricola') };
    }
    if (f.includes('vehiculo electrico') || f.includes('vehículo eléctrico')) {
      return { category: 'vehiculo_electrico', ...readGamaSpecFormat(workbook, workbook.SheetNames[0], 'vehiculo_electrico') };
    }
    if (f.includes('transmision') || f.includes('transmisión')) {
      return { category: 'transmision', ...readGamaSpecFormat(workbook, workbook.SheetNames[0], 'transmision') };
    }
    if (f.includes('hidraulicos') || f.includes('hidráulicos')) {
      return { category: 'hidraulicos', ...readGamaSpecFormat(workbook, workbook.SheetNames[0], 'hidraulicos') };
    }
    if (f.includes('grasas')) {
      return { category: 'grasas', ...readBlockFormat(workbook, workbook.SheetNames[0], 'grasas') };
    }
    // Fallback: intenta formato gama-spec si tiene una hoja EQUIVALENCIAS ENTRE MARCAS o
    // EQUIVALENCIAS, si no, block sobre la primera hoja.
    if (workbook.SheetNames.some(s => /EQUIVALENCIAS/i.test(s))) {
      const sheetName = workbook.SheetNames.find(s => /EQUIVALENCIAS/i.test(s));
      return { category: 'desconocida', ...readGamaSpecFormat(workbook, sheetName, 'desconocida') };
    }
    return { category: 'desconocida', ...readBlockFormat(workbook, workbook.SheetNames[0], 'desconocida') };
  }

  return { readGamaSpecFormat, readBlockFormat, readKnownFile };
})();
