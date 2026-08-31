/* ==========================================================================
   PERFIL: AD Parts — Aceite (Normal + Standard [+ Sport Car])
   Marca propia, prioridad alta. Llega en DOS formatos distintos según el mes:
     (a) "ENTRADA" crudo del proveedor: hojas AD NORMAL / AD STANDARD
         (REFERENCIA + PRECIO COMPRA FACTURA) + hoja Tarifa maestro (42 cols).
     (b) "de trabajo": hojas Coste / ADStandard / CosteSC con costes actual
         y anterior por envase.
   La referencia de salida es el código tal cual lo manda AD Parts, sin
   prefijo (ver ADR 0056 — ninguna marca lleva prefijo interno; la
   diferenciación entre marcas la hace ya la propia exportación); los litros
   se derivan de forma fiable con Parser.litersFromRefSuffix (ver ADR 0007).
   ========================================================================== */
(() => {
  const sheetRows = ExcelReader.sheetRows;
  const findRefHeader = ExcelReader.findRefHeader;
  const AD_PARTS_FAM_BY_FAMILIA = { 'ACEITE MOTOR': '06' };

  /** Resuelve las 3 hojas del formato "de trabajo" (Coste/ADStandard/CosteSC) por
   *  contenido del nombre, no por coincidencia exacta — Yako reorganiza y renombra
   *  estas hojas de vez en cuando (ej. "Coste" → "Coste AD", "CosteSC" → "Coste
   *  Sport Car") y un nombre exacto se rompe con cualquier cambio cosmético. Cada
   *  hoja se consume como mucho una vez, más específica primero (Sport Car, luego
   *  Standard, luego lo que quede de "coste" para Normal). */
  function resolveWorkingSheetNames(names) {
    const remaining = names.slice();
    const takeMatch = (test) => {
      const idx = remaining.findIndex(n => test(n.toLowerCase()));
      if (idx < 0) return null;
      return remaining.splice(idx, 1)[0];
    };
    const scName = takeMatch(n => n === 'costesc' || n.includes('sport'));
    const stdName = takeMatch(n => n === 'adstandard' || n.includes('standard'));
    const costeName = takeMatch(n => n === 'coste' || n.includes('coste'));
    return { costeName, stdName, scName };
  }

  function readADPartsAceiteRaw(workbook) {
    const tarifaRaw = sheetRows(workbook, 'Tarifa');
    const tarifaByRef = new Map();
    if (tarifaRaw && tarifaRaw.length) {
      const tHeaders = tarifaRaw[0].map(x => String(x || '').toUpperCase().trim());
      const idxRefProv = tHeaders.indexOf('REF PROVEEDOR');
      const idxDesc = tHeaders.indexOf('DESCRIPCION ARTICULO');
      const idxFamilia = tHeaders.indexOf('FAMILIA ADGLOBAL');
      for (let i = 1; i < tarifaRaw.length; i++) {
        const r = tarifaRaw[i];
        if (!r) continue;
        const rp = r[idxRefProv];
        if (rp == null) continue;
        // Join clave: REFERENCIA de AD NORMAL/STANDARD == REF PROVEEDOR sin el punto
        // ("11.020" → "11020"). Descubierto cruzando los datos reales, no documentado
        // por el proveedor.
        const key = String(rp).replace(/\./g, '').trim();
        tarifaByRef.set(key, {
          description: Parser.cleanDescription(idxDesc >= 0 ? r[idxDesc] : ''),
          familia: (idxFamilia >= 0 && r[idxFamilia]) ? String(r[idxFamilia]).trim() : null
        });
      }
    }

    function readGamaSheet(sheetName, gama) {
      const raw = sheetRows(workbook, sheetName);
      if (!raw || !raw.length) return [];
      const headers = raw[0].map(x => String(x || '').toUpperCase().trim());
      const idxRef = headers.indexOf('REFERENCIA');
      const idxPrecio = headers.indexOf('PRECIO COMPRA FACTURA');
      if (idxRef < 0 || idxPrecio < 0) return [];
      const out = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (!r || r.length === 0) continue;
        const refRaw = r[idxRef];
        const price = r[idxPrecio];
        if (refRaw == null) continue;
        if (typeof price !== 'number' || !isFinite(price)) continue;
        const ref = String(refRaw).trim();
        const tInfo = tarifaByRef.get(ref) || {};
        const liters = Parser.litersFromRefSuffix(ref) ?? Parser.extractLiters(tInfo.description);
        const fam = AD_PARTS_FAM_BY_FAMILIA[tInfo.familia] || '06';
        out.push({
          ref: ref,
          description: tInfo.description || '',
          liters,
          formatKey: Parser.formatKey(liters),
          costPerPack: price,
          fam,
          gama,
          litersDetected: liters != null
        });
      }
      return out;
    }

    const rows = [
      ...readGamaSheet('AD NORMAL', 'normal'),
      ...readGamaSheet('AD STANDARD', 'standard')
    ];
    const gamas = ['normal', 'standard'].filter(g => rows.some(r => r.gama === g));
    return { supplier: 'AD Parts', gamas, rows, sheetUsed: 'AD NORMAL / AD STANDARD (+ Tarifa)' };
  }

  function readADPartsAceiteWorking(workbook) {
    const rows = [];
    const { costeName, stdName, scName } = resolveWorkingSheetNames(workbook.SheetNames);

    // Hoja "Coste" (o como la haya renombrado Yako) → gama normal. PRODUCTO viene
    // en carry-forward (solo se repite en la primera fila de cada producto),
    // Envase en texto.
    const rawCoste = costeName ? sheetRows(workbook, costeName) : null;
    if (rawCoste) {
      const h = findRefHeader(rawCoste);
      if (h) {
        let lastProduct = null;
        for (let i = h.headerIdx + 1; i < rawCoste.length; i++) {
          const r = rawCoste[i];
          if (!r) continue;
          const refRaw = r[h.colRef];
          if (refRaw == null) continue;
          if (h.colProd >= 0 && r[h.colProd]) lastProduct = Parser.cleanDescription(r[h.colProd]);
          const cost = r[h.colCost];
          if (typeof cost !== 'number' || !isFinite(cost)) continue;
          const ref = String(refRaw).replace(/\./g, '').trim();
          const envaseTxt = h.colEnvase >= 0 ? r[h.colEnvase] : null;
          const liters = Parser.litersFromRefSuffix(ref) ?? Parser.extractLiters(String(envaseTxt || ''));
          rows.push({
            ref: ref, description: lastProduct || '', liters,
            formatKey: Parser.formatKey(liters), costPerPack: cost, fam: '06',
            gama: 'normal', litersDetected: liters != null
          });
        }
      }
    }

    // Hoja "ADStandard" (o renombrada) → gama standard. Producto y Envase
    // (numérico) vienen en todas las filas, sin carry-forward.
    const rawStd = stdName ? sheetRows(workbook, stdName) : null;
    if (rawStd) {
      const h = findRefHeader(rawStd);
      if (h) {
        for (let i = h.headerIdx + 1; i < rawStd.length; i++) {
          const r = rawStd[i];
          if (!r) continue;
          const refRaw = r[h.colRef];
          if (refRaw == null) continue;
          const cost = r[h.colCost];
          if (typeof cost !== 'number' || !isFinite(cost)) continue;
          const ref = String(refRaw).replace(/\./g, '').trim();
          const desc = h.colProd >= 0 ? Parser.cleanDescription(r[h.colProd]) : '';
          const envaseVal = h.colEnvase >= 0 ? r[h.colEnvase] : null;
          const liters = (typeof envaseVal === 'number')
            ? envaseVal
            : (Parser.litersFromRefSuffix(ref) ?? Parser.extractLiters(desc));
          rows.push({
            ref: ref, description: desc, liters,
            formatKey: Parser.formatKey(liters), costPerPack: cost, fam: '06',
            gama: 'standard', litersDetected: liters != null
          });
        }
      }
    }

    // Hoja "CosteSC" (o renombrada) → línea Sport Car (3ª línea, solo presente
    // en el formato "de trabajo"). Misma forma que "Coste" (carry-forward de
    // producto), la ref sin punto de la 1ª columna de ref es la que se usa.
    const rawSc = scName ? sheetRows(workbook, scName) : null;
    if (rawSc) {
      const h = findRefHeader(rawSc);
      if (h) {
        let lastProduct = null;
        for (let i = h.headerIdx + 1; i < rawSc.length; i++) {
          const r = rawSc[i];
          if (!r) continue;
          const refRaw = r[h.colRef];
          if (refRaw == null) continue;
          if (h.colProd >= 0 && r[h.colProd]) lastProduct = Parser.cleanDescription(r[h.colProd]);
          const cost = r[h.colCost];
          if (typeof cost !== 'number' || !isFinite(cost)) continue;
          const ref = String(refRaw).replace(/\./g, '').trim();
          const envaseTxt = h.colEnvase >= 0 ? r[h.colEnvase] : null;
          const liters = Parser.litersFromRefSuffix(ref) ?? Parser.extractLiters(String(envaseTxt || ''));
          rows.push({
            ref: ref, description: lastProduct || '', liters,
            formatKey: Parser.formatKey(liters), costPerPack: cost, fam: '06',
            gama: 'sportcar', litersDetected: liters != null
          });
        }
      }
    }

    const gamas = ['normal', 'standard', 'sportcar'].filter(g => rows.some(r => r.gama === g));
    return { supplier: 'AD Parts', gamas, rows, sheetUsed: 'Coste / ADStandard / CosteSC' };
  }

  ExcelReader.registerProfile({
    id: 'ad_parts_aceite',
    name: 'AD Parts Aceite',
    detect(filename, workbook) {
      const f = (filename || '').toLowerCase();
      if (f.includes('quimico') || f.includes('químico')) return false;
      if (f.includes('ad parts') || f.includes('adp') || f.includes('aceite ad') ||
          f.includes('ad aceite') || f.includes('tarifa ad ')) return true;
      const names = workbook.SheetNames;
      if (names.includes('AD NORMAL') || names.includes('AD STANDARD')) return true;
      const { costeName, stdName } = resolveWorkingSheetNames(names);
      if (costeName && stdName) return true;
      return false;
    },
    read(workbook) {
      const names = workbook.SheetNames;
      if (names.includes('AD NORMAL') || names.includes('AD STANDARD')) return readADPartsAceiteRaw(workbook);
      return readADPartsAceiteWorking(workbook);
    }
  });
})();
