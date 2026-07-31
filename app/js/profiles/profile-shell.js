/* ============================================================================
   PERFIL: Shell
   ============================================================================
   La más simple de las auditadas hasta ahora: una sola hoja, cabecera en la
   fila 1, sin secciones ni familias intercaladas.

   Columnas: A Material (ref), B Descripción de Material, C Litros envase,
   D Gama (familia — se usa tal cual como gama de la app), E "Precio €/lt".

   CRÍTICO: la columna E es precio POR LITRO, no por envase — a pesar de que
   Yako la describió como "nuestro precio de factura" (sin más descuentos), la
   cabecera real de la columna dice "Precio €/lt" y los números solo cuadran
   como precio por litro: un bidón de 209L a un supuesto "precio de factura"
   de 5,16€ sería absurdo; 5,16€/L × 209L ≈ 1.078€ sí es un precio de bidón
   industrial realista. costPerPack = columna E × columna C (litros envase).

   Descripción: el campo de origen es un código SAP interno, no un nombre
   comercial limpio (ej. "Adv4TUlt10W40SPMA2_12*1L_EURO") — Yako avisó que
   está "algo de locos" y va a pasar una tabla de referencias con las
   descripciones antiguas para reconstruirlas bien. Mientras tanto se usa la
   parte antes del primer "_" (que ya es legible en la mayoría de los casos,
   ej. "Corena S2 P 100_1*209L_A246" → "Corena S2 P 100") + litros propios,
   descartando el resto del código (unidades×envase y sufijo de spec, que ya
   tenemos de columnas separadas).
   ============================================================================ */
(() => {
  const sheetRows = ExcelReader.sheetRows;

  function normalizeHeader(h) {
    return String(h || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function formatLitersSuffix(liters) {
    if (liters < 1) return `${Math.round(liters * 1000)}ML`;
    return `${liters}L`;
  }

  function readShell(workbook) {
    const raw = sheetRows(workbook, workbook.SheetNames[0]);
    if (!raw || !raw.length) return { supplier: 'Shell', gamas: [], rows: [], sheetUsed: '' };

    const headers = raw[0].map(normalizeHeader);
    const idxRef = headers.findIndex(h => h.includes('MATERIAL'));
    const idxName = headers.findIndex(h => h.includes('DESCRIP'));
    const idxLiters = headers.findIndex(h => h.includes('LITROS'));
    const idxGama = headers.findIndex(h => h === 'GAMA' || h.includes('GAMA'));
    const idxPrecio = headers.findIndex(h => h.includes('PRECIO'));
    if (idxRef < 0 || idxName < 0 || idxPrecio < 0) {
      throw new Error(`Faltan columnas obligatorias en la tarifa Shell. Cabecera vista: ${headers.filter(Boolean).join(' | ')}`);
    }

    const rows = [];
    const seenRefs = new Set();
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const ref = r[idxRef];
      const nameRaw = r[idxName];
      const litersRaw = idxLiters >= 0 ? r[idxLiters] : null;
      const pricePerLiter = r[idxPrecio];
      if (ref == null || nameRaw == null) continue;
      if (typeof pricePerLiter !== 'number' || !isFinite(pricePerLiter) || pricePerLiter <= 0) continue;

      const refStr = String(ref).trim();
      if (seenRefs.has(refStr)) continue; // fila duplicada exacta en la tarifa de origen
      seenRefs.add(refStr);

      const liters = typeof litersRaw === 'number' ? litersRaw : parseFloat(String(litersRaw || '').replace(',', '.'));
      const litersOk = isFinite(liters) && liters > 0;
      const costPerPack = litersOk ? pricePerLiter * liters : null;
      if (costPerPack == null || costPerPack <= 0) continue;

      const namePart = String(nameRaw).split('_')[0].trim();
      const description = litersOk ? `${namePart} ${formatLitersSuffix(liters)}` : namePart;
      const gama = idxGama >= 0 && r[idxGama] != null ? slugify(r[idxGama]) : 'default';

      rows.push({
        ref: refStr,
        description,
        liters: litersOk ? liters : null,
        formatKey: Parser.formatKey(litersOk ? liters : null),
        costPerPack,
        gama,
        litersDetected: litersOk
      });
    }
    const gamas = [...new Set(rows.map(r => r.gama))];
    return { supplier: 'Shell', gamas, rows, sheetUsed: workbook.SheetNames[0] };
  }

  ExcelReader.registerProfile({
    id: 'shell',
    name: 'Shell',
    detect(filename, workbook) {
      const f = (filename || '').toLowerCase();
      if (f.includes('shell')) return true;
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) return false;
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
      const header = (raw[0] || []).map(x => String(x || '').toUpperCase());
      return header.some(h => h.includes('MATERIAL')) && header.some(h => h === 'GAMA' || h.includes('GAMA'));
    },
    read: readShell
  });
})();
