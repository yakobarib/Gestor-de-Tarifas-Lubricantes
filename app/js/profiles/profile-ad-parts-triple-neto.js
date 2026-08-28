/* ==========================================================================
   AD Parts — fichero dedicado de Triple-Neto (ver ADR 0030)
   NO se registra como perfil de ExcelReader: mezcla productos de varias gamas
   (normal/standard) sin indicar cuál es cuál fila a fila, así que la gama de
   cada ref solo puede resolverse cruzándola contra el maestro ya importado —
   un paso async que el patrón profile.read() síncrono no admite. ScreenImport
   detecta este fichero por separado (antes de ExcelReader.read()) y hace esa
   resolución de gama él mismo.

   Formato real (llega "regularmente pero no siempre junto a una tarifa
   normal", según Yako): hojas "Hoja1"/"DATOS" (mismo contenido, distinto tipo
   de celda en la ref), cabecera con una columna "ref" y DOS columnas de coste
   con el mes/año como texto ("Abril 2026", "Febrero 2026") — el mes más
   reciente es "el en curso", el otro solo es referencia histórica. La
   descripción del producto viene en carry-forward (solo en la primera fila
   de cada familia). La ref usa el mismo esquema "familia.formato" que ya
   decodifica `readADPartsAceiteWorking` (ej. "33.1000" → familia 33,
   formato 1000L) — mismo `ref sin puntos` de siempre, sin prefijo (ver ADR
   0056: ninguna marca lleva prefijo en el ref interno).
   ========================================================================== */
const AdPartsTripleNeto = (() => {
  const MONTHS = {
    ENERO: 0, FEBRERO: 1, MARZO: 2, ABRIL: 3, MAYO: 4, JUNIO: 5,
    JULIO: 6, AGOSTO: 7, SEPTIEMBRE: 8, OCTUBRE: 9, NOVIEMBRE: 10, DICIEMBRE: 11
  };

  /** "Abril 2026" → 24315 (año×12 + mes), para poder comparar dos cabeceras de
   *  mes/año cualesquiera y saber cuál es la más reciente. null si no parsea. */
  function monthValue(header) {
    // Los nombres de mes en español mayúsculas no llevan tilde (ENERO, ABRIL...),
    // no hace falta normalizar acentos.
    const clean = String(header || '').toUpperCase();
    const m = /([A-Z]+)\s+(\d{4})/.exec(clean);
    if (!m || !(m[1] in MONTHS)) return null;
    return parseInt(m[2], 10) * 12 + MONTHS[m[1]];
  }

  /** Busca, en las primeras filas, una con columna "ref" y al menos una columna de
   *  mes/año a su derecha — esa es la cabecera real (puede no ser la fila 0: la fila
   *  0 suele ser solo el rótulo "Triple-neto" repetido, decorativo). Habitualmente
   *  trae dos columnas (mes actual + uno anterior de referencia), pero Yako a veces
   *  quita la columna antigua antes de soltar el fichero — con una sola basta para
   *  reconocerlo igual, siempre se usa la de mes/año más reciente de las presentes. */
  function findHeader(raw) {
    for (let i = 0; i < Math.min(6, raw.length); i++) {
      const row = raw[i];
      if (!row) continue;
      const idxRef = row.findIndex(c => String(c || '').trim().toLowerCase() === 'ref');
      if (idxRef < 0) continue;
      const monthCols = [];
      for (let c = idxRef + 1; c < row.length; c++) {
        const mv = monthValue(row[c]);
        if (mv != null) monthCols.push({ col: c, monthValue: mv, label: row[c] });
      }
      if (monthCols.length >= 1) {
        monthCols.sort((a, b) => b.monthValue - a.monthValue);
        return { headerIdx: i, idxRef, idxDesc: idxRef - 1, idxCurrent: monthCols[0].col, currentLabel: monthCols[0].label };
      }
    }
    return null;
  }

  function pickSheet(workbook) {
    const order = ['Hoja1', 'DATOS'].filter(n => workbook.SheetNames.includes(n))
      .concat(workbook.SheetNames.filter(n => n !== 'Hoja1' && n !== 'DATOS'));
    for (const name of order) {
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: null, blankrows: false });
      const header = findHeader(raw);
      if (header) return { raw, header, sheetName: name };
    }
    return null;
  }

  function detect(workbook) {
    return !!pickSheet(workbook);
  }

  /** Devuelve `{ rows, monthLabel, sheetUsed }` — `rows` NO llevan `gama` (no está en
   *  el fichero, se resuelve fuera) ni `costPerPack` (no es un coste de factura). */
  function parse(workbook) {
    const found = pickSheet(workbook);
    if (!found) throw new Error('No se reconoce este fichero como Triple-Neto de AD Parts (busco una columna "ref" y al menos dos columnas de mes/año).');
    const { raw, header, sheetName } = found;
    const rows = [];
    let lastDesc = null;
    for (let i = header.headerIdx + 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const refRaw = r[header.idxRef];
      if (refRaw == null || String(refRaw).trim() === '') continue;
      if (header.idxDesc >= 0 && r[header.idxDesc]) lastDesc = Parser.cleanDescription(r[header.idxDesc]);
      const cost = r[header.idxCurrent];
      if (typeof cost !== 'number' || !isFinite(cost)) continue;
      const refDigits = String(refRaw).replace(/\./g, '').trim();
      const liters = Parser.litersFromRefSuffix(refDigits);
      rows.push({
        ref: refDigits,
        description: lastDesc || '',
        liters,
        formatKey: Parser.formatKey(liters),
        costTripleNeto: cost,
        litersDetected: liters != null
      });
    }
    // El propio fichero de AD Parts trae, alguna vez, la misma ref repetida (código de
    // familia.formato duplicado) — se queda con la última aparición, no con la primera.
    const byRef = new Map(rows.map(r => [r.ref, r]));
    return { rows: [...byRef.values()], monthLabel: header.currentLabel, sheetUsed: sheetName };
  }

  return { detect, parse };
})();
