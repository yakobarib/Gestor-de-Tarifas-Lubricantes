/* ============================================================================
   PERFIL: Racing Oil
   ============================================================================
   Igual que Eni Live: una hoja por gama (V.LIGERO, V.PESADO, AGRÍCOLA,
   TRANSMISIÓN, HIDRÁULICOS, INDUSTRIA, GRASA, MOTO, CLASSIC, MARINA,
   ANTICOGELANTE, ADITIVOS). Cabecera en DOS filas (la primera trae COD.
   FABRI/EAN/PRODUCTO, la segunda ENVASE/UDS. POR CAJA/PRECIO) — se fusionan
   por columna en vez de asumir que todo cae en una sola fila.

   Precio: columna PRECIO, ya por envase individual (no hace falta dividir
   por UDS. POR CAJA — confirmado cruzando 1L/5L del mismo producto, el
   precio por litro cuadra igual en ambos formatos).

   Descripción: PRODUCTO no incluye el envase — se añade a partir de la
   columna ENVASE, igual que en Eni Live.

   Hoja "PRECIOS ESPECIALES AD IBIZA": no es una gama — son un puñado de
   referencias repartidas por el resto de hojas con un precio especial que
   prevalece sobre el de su hoja de gama. Se lee aparte y se aplica como
   override después de leer todas las gamas.
   ============================================================================ */
(() => {
  const sheetRows = ExcelReader.sheetRows;

  const GAMA_SHEETS = [
    'V.LIGERO', 'V.PESADO', 'AGRÍCOLA', 'TRANSMISIÓN', 'HIDRÁULICOS',
    'INDUSTRIA', 'GRASA', 'MOTO', 'CLASSIC', 'MARINA', 'ANTICOGELANTE', 'ADITIVOS'
  ];
  const SPECIAL_SHEET = 'PRECIOS ESPECIALES AD IBIZA';

  // Envases de grasa (GRASA/ADITIVOS) en kg/g — mismo patrón que Repsol/Eni: el
  // peso real no es la escala nominal de litros que usa Racing Oil en el resto
  // de la tarifa (1/5/20/50/200/1000). Confirmado por Yako.
  const KG_TO_L_DESC = { 0.4: 0.4, 5: 5, 20: 20, 45: 50, 185: 200 };

  function normalizeHeader(h) {
    return String(h || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  /** "5L" / "20kg" / "0,400g" / "40 un." → { liters, suffix }. Si no se puede
   *  interpretar como volumen/peso (ej. "40 un."), se deja el texto tal cual. */
  function parseEnvase(raw) {
    const s = String(raw || '').trim();
    const m = s.match(/^([\d.,]+)\s*(kgs?|grs?|g|mls?|cc|lts?|l)$/i);
    if (!m) return { liters: null, suffix: s };
    const num = parseFloat(m[1].replace(',', '.'));
    const unit = m[2].toLowerCase();
    if (unit === 'ml' || unit === 'mls' || unit === 'cc') return { liters: num / 1000, suffix: formatLitersSuffix(num / 1000) };
    if (unit[0] === 'k' || unit[0] === 'g') {
      const liters = KG_TO_L_DESC[num];
      return liters != null ? { liters, suffix: formatLitersSuffix(liters) } : { liters: null, suffix: s.toUpperCase() };
    }
    return { liters: num, suffix: formatLitersSuffix(num) }; // l / lt / lts
  }

  function formatLitersSuffix(liters) {
    if (liters < 1) return `${Math.round(liters * 1000)}ML`;
    return `${liters}L`;
  }

  /** Busca la fila que empieza por "COD. FABRI" (o similar) en las primeras filas de
   *  la hoja, y fusiona esa fila con la siguiente para tener un único array de
   *  cabeceras — Racing Oil reparte ENVASE/UDS. POR CAJA/PRECIO en dos filas
   *  distintas según la hoja (fila 1 en la hoja normal, fila 2 en "Precios
   *  especiales"), así que no se puede asumir una posición fija. */
  function findHeader(raw) {
    for (let i = 0; i < Math.min(30, raw.length); i++) {
      const first = normalizeHeader(raw[i] && raw[i][0]);
      if (first.includes('COD') && (first.includes('FABRI') || first.includes('FAB'))) {
        const row1 = raw[i] || [];
        const row2 = raw[i + 1] || [];
        const merged = [];
        for (let c = 0; c < Math.max(row1.length, row2.length); c++) {
          merged[c] = normalizeHeader(row1[c]) || normalizeHeader(row2[c]);
        }
        return { headers: merged, dataStart: i + 2 };
      }
    }
    return null;
  }

  function readGamaSheet(workbook, sheetName, gamaId) {
    const raw = sheetRows(workbook, sheetName);
    if (!raw || !raw.length) return [];
    const h = findHeader(raw);
    if (!h) return [];
    const { headers, dataStart } = h;
    const idxRef = headers.findIndex(x => x.includes('COD'));
    const idxName = headers.findIndex(x => x.includes('PRODUCTO'));
    const idxEnvase = headers.findIndex(x => x.includes('ENVASE'));
    // TRANSMISIÓN e INDUSTRIA no rotulan "PRECIO" en la fila de cabecera (queda en
    // blanco) aunque el dato está en la misma columna F que en el resto de hojas —
    // se cae a esa posición fija cuando el texto no aparece.
    const idxPrecio = headers.findIndex(x => x.includes('PRECIO')) >= 0
      ? headers.findIndex(x => x.includes('PRECIO'))
      : 5;
    if (idxRef < 0 || idxName < 0) return [];

    const out = [];
    for (let i = dataStart; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const ref = r[idxRef];
      const nameRaw = r[idxName];
      const price = r[idxPrecio];
      if (ref == null || nameRaw == null) continue;
      if (typeof price !== 'number' || !isFinite(price) || price <= 0) continue;

      const { liters, suffix } = idxEnvase >= 0 ? parseEnvase(r[idxEnvase]) : { liters: null, suffix: '' };
      const name = Parser.cleanDescription(nameRaw);
      const description = suffix ? `${name} ${suffix}` : name;

      out.push({
        ref: String(ref).trim(),
        description,
        liters,
        formatKey: Parser.formatKey(liters),
        costPerPack: price,
        gama: gamaId,
        litersDetected: liters != null
      });
    }
    return out;
  }

  /** ref → precio especial. La hoja de precios especiales tiene su propio cruce de
   *  cabecera (misma búsqueda de "COD. FABRI" + fusión de las 2 filas de cabecera). */
  function readSpecialPrices(workbook) {
    const raw = sheetRows(workbook, SPECIAL_SHEET);
    if (!raw || !raw.length) return new Map();
    const h = findHeader(raw);
    if (!h) return new Map();
    const { headers, dataStart } = h;
    const idxRef = headers.findIndex(x => x.includes('COD'));
    const idxPrecio = headers.findIndex(x => x.includes('PRECIO'));
    const map = new Map();
    if (idxRef < 0 || idxPrecio < 0) return map;
    for (let i = dataStart; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const ref = r[idxRef];
      const price = r[idxPrecio];
      if (ref == null || typeof price !== 'number' || !isFinite(price) || price <= 0) continue;
      map.set(String(ref).trim(), price);
    }
    return map;
  }

  function gamaIdFor(sheetName) {
    const noAccents = sheetName.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return noAccents.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function readRacingOil(workbook) {
    const rows = [];
    for (const sheetName of GAMA_SHEETS) {
      rows.push(...readGamaSheet(workbook, sheetName, gamaIdFor(sheetName)));
    }
    const specialPrices = readSpecialPrices(workbook);
    for (const row of rows) {
      if (specialPrices.has(row.ref)) row.costPerPack = specialPrices.get(row.ref);
    }
    const gamas = GAMA_SHEETS.map(gamaIdFor).filter(g => rows.some(r => r.gama === g));
    return { supplier: 'Racing Oil', gamas, rows, sheetUsed: GAMA_SHEETS.join(' / ') };
  }

  ExcelReader.registerProfile({
    id: 'racing_oil',
    name: 'Racing Oil',
    detect(filename, workbook) {
      const f = (filename || '').toLowerCase();
      if (f.includes('racing oil') || f.includes('racing-oil')) return true;
      const names = workbook.SheetNames;
      return names.includes('V.LIGERO') && names.includes('V.PESADO');
    },
    read: readRacingOil
  });
})();
