/* ============================================================================
   PERFIL: Eni Live
   ============================================================================
   Tarifa dividida en una hoja por gama (i-Sint, i-Sigma, Rotra, Industria,
   i-Ride, Food-Line, Grasas, Forestal, Anticongelantes) con la misma
   estructura de columnas de fondo, aunque el texto exacto de cada cabecera
   varía ligeramente entre hojas (espacios, salto de línea, columnas extra
   como PAIS). Las hojas "Capacidad palet" y "Plazo de entrega pedidos" son
   solo informativas y no traen productos.

   Precio a usar: columna TARIFA 2 (precio final por envase, ya negociado);
   si una gama no tiene Tarifa 2 (Rotra, i-Ride), se usa TARIFA 1. Nunca la
   variante "UNIDAD DE VENTA" de esas columnas (esa es TARIFA × UDS.POR
   ENVASE, no el precio por envase individual que necesita Skrit).

   Litros: columna "LITROS UNIDAD" / "KG. UNIDAD" / "LITROS / KG UNIDAD"
   según la hoja. Varias gamas (Food-Line, Grasas, Forestal, Industria,
   Anticongelantes) dan el formato en KG en vez de litros — se convierte a
   los 6 envases estándar (0.4/5/20/50/205/1000 L) por rango de peso, no por
   igualdad exacta: el mismo envase nominal pesa distinto según la densidad
   del producto (confirmado por Yako con Food-Line: el envase "grande" pesa
   165, 170, 175, 180, 185 o 200 kg según el aceite, y siempre son 205 L).
   ============================================================================ */
(() => {
  const sheetRows = ExcelReader.sheetRows;

  const GAMA_SHEETS = [
    'i-Sint', 'i-Sigma', 'Rotra', 'Industria', 'i-Ride',
    'Food-Line', 'Grasas', 'Forestal', 'Anticongelantes'
  ];

  // Envases estándar Eni por peso (kg), de menor a mayor. Cada envase nominal
  // cubre un rango de pesos porque la densidad varía según el producto (ver
  // cabecera del fichero) — los límites se sitúan a medio camino entre los
  // pesos reales observados en la tarifa, con margen amplio a cada lado.
  const KG_BUCKETS = [
    { max: 2, liters: 0.4 },
    { max: 10, liters: 5 },
    { max: 35, liters: 20 },
    { max: 100, liters: 50 },
    { max: 500, liters: 205 },
    { max: 1200, liters: 1000 }
  ];

  function kgToLiters(kg) {
    const bucket = KG_BUCKETS.find(b => kg <= b.max);
    return bucket ? bucket.liters : null;
  }

  /** "5 lts." / "20 lts." / "125 ml." / "180 kgs." / número pelado en kg (bug de origen) → litros. */
  function parseLitrosKg(cellValue) {
    if (typeof cellValue === 'number') return kgToLiters(cellValue); // único caso visto: kg sin unidad
    if (typeof cellValue !== 'string') return null;
    const m = cellValue.trim().match(/^([\d.,]+)\s*(kgs?|lts?|ml)\.?\s*$/i);
    if (!m) return null;
    const num = parseFloat(m[1].replace(',', '.'));
    const unit = m[2].toLowerCase();
    if (unit === 'ml') return num / 1000;
    if (unit[0] === 'k') return kgToLiters(num);
    return num; // lt / lts
  }

  /** "5" → "5L", "0.4" → "400ML" — mismo estilo que usan los proveedores que sí incluyen litros en el nombre. */
  function formatLitersSuffix(liters) {
    if (liters == null) return '';
    if (liters < 1) return `${Math.round(liters * 1000)}ML`;
    return `${liters}L`;
  }

  function normalizeHeader(h) {
    return String(h || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  function readGamaSheet(workbook, sheetName, gamaId) {
    const raw = sheetRows(workbook, sheetName);
    if (!raw || !raw.length) return [];

    const headerIdx = raw.findIndex(r => normalizeHeader(r && r[0]) === 'CODIGO');
    if (headerIdx < 0) return [];
    const headers = raw[headerIdx].map(normalizeHeader);

    const idxCodigo = headers.indexOf('CODIGO');
    const idxProducto = headers.indexOf('PRODUCTO');
    const idxLitrosKg = headers.findIndex(h => h.includes('LITROS') || /KG\.?\s*UNIDAD/.test(h));
    const idxTarifa2 = headers.findIndex(h => h.includes('TARIFA 2') && !h.includes('UNIDAD DE VENTA'));
    const idxTarifa1 = headers.findIndex(h => h.includes('TARIFA 1') && !h.includes('UNIDAD DE VENTA'));
    if (idxCodigo < 0 || idxProducto < 0 || (idxTarifa2 < 0 && idxTarifa1 < 0)) return [];

    const out = [];
    let currentFamily = null;
    for (let i = headerIdx + 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const codigo = r[idxCodigo];
      const productoRaw = r[idxProducto];
      // Filas de familia ("LUBRICANTES DE MOTOR", "SISTEMAS HIDRAULICOS"…): solo
      // rellena la columna A, el resto viene vacío — se usan de contexto (FAMILIA
      // del export), no son productos.
      if (codigo != null && (productoRaw == null || productoRaw === '')) {
        currentFamily = String(codigo).trim();
        continue;
      }
      if (codigo == null || productoRaw == null) continue;
      // Tarifa 2 se cae a Tarifa 1 fila a fila (no por hoja): en Industria hay
      // referencias sueltas sin Tarifa 2 aunque la mayoría de la hoja sí la tenga.
      const tarifa2 = idxTarifa2 >= 0 ? r[idxTarifa2] : null;
      const tarifa1 = idxTarifa1 >= 0 ? r[idxTarifa1] : null;
      const price = (typeof tarifa2 === 'number' && isFinite(tarifa2)) ? tarifa2 : tarifa1;
      if (typeof price !== 'number' || !isFinite(price)) continue;

      const liters = idxLitrosKg >= 0 ? parseLitrosKg(r[idxLitrosKg]) : null;
      const name = Parser.cleanDescription(String(productoRaw).replace(/^\s*eni\s+/i, ''));
      const description = liters != null ? `${name} ${formatLitersSuffix(liters)}` : name;

      out.push({
        ref: String(codigo).trim(),
        description,
        liters,
        formatKey: Parser.formatKey(liters),
        costPerPack: price,
        fam: currentFamily,
        gama: gamaId,
        litersDetected: liters != null
      });
    }
    return out;
  }

  function gamaIdFor(sheetName) {
    return sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function readEni(workbook) {
    const rows = [];
    for (const sheetName of GAMA_SHEETS) {
      rows.push(...readGamaSheet(workbook, sheetName, gamaIdFor(sheetName)));
    }
    const gamas = GAMA_SHEETS.map(gamaIdFor).filter(g => rows.some(r => r.gama === g));
    return { supplier: 'Eni Live', gamas, rows, sheetUsed: GAMA_SHEETS.join(' / ') };
  }

  ExcelReader.registerProfile({
    id: 'eni',
    name: 'Eni Live',
    detect(filename, workbook) {
      const f = (filename || '').toLowerCase();
      if (f.includes('eni')) return true;
      const names = workbook.SheetNames;
      return names.includes('i-Sint') || names.includes('i-Sigma') || names.includes('i-Ride');
    },
    read: readEni
  });
})();
