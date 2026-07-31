/* ============================================================================
   PERFIL: Repsol
   ============================================================================
   Repsol mete todas las gamas en una sola hoja, separadas verticalmente por
   filas de cabecera de sección — igual que Eni Live pero en vertical en vez
   de en hojas distintas. No se distinguen por texto (serían demasiado
   variables) sino por el color de relleno de la celda: naranja (FFC000) =
   gama (AUTOMOCION, INDUSTRIA, PRODUCTOS DE MANTENIMIENTO, MARINOS, GRASAS,
   ALIMENTARIOS), rojo (FF0000) = subcategoría dentro de la gama activa
   (MOTO, ENGRANAJES, ENGRASE GENERAL…) — se guarda como `fam`, no como gama
   propia, igual que las familias de Eni. La columna donde cae el texto de
   cabecera varía entre variantes de la tarifa (columna A en la normal,
   columna E en la "con aportaciones"), así que se localiza dinámicamente
   como la primera celda no vacía de la fila, no por índice fijo.
   ============================================================================ */
(() => {
  const GAMA_FILL = 'FFC000';
  const FAM_FILL = 'FF0000';

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /** Lee un workbook de Repsol y devuelve array de filas estandarizadas. */
  function readRepsol(workbook) {
    // Prioridad: hoja "DATOS" (limpia) > "Hoja1" (con presentación)
    const sheetName = workbook.SheetNames.find(n => /^DATOS$/i.test(n))
                   || workbook.SheetNames.find(n => /^Hoja1$/i.test(n))
                   || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });

    // Detectar fila de cabecera: la que contiene "PRECIO FACTURA" y algún identificador
    // de referencia (SIRDI, REF PROVEDOR, REFERENCIA, REF). Repsol cambia el nombre entre
    // versiones de tarifa (2025 usaba "REF PROVEDOR", 2026 usa "SIRDI").
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      const row = raw[i].map(x => String(x || '').toUpperCase());
      const hasPrecio = row.some(c => c.includes('PRECIO FACTURA'));
      const hasRef    = row.some(c => /\b(SIRDI|REF|REFERENCIA|CODIGO)\b/.test(c));
      const hasNombre = row.some(c => c.includes('NOMBRE') || c.includes('PRODUCTO') || c.includes('DESCRIP'));
      if (hasPrecio && hasRef && hasNombre) { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error('No se encontró la fila de cabecera en la tarifa Repsol (busco columnas de referencia + nombre + PRECIO FACTURA en las primeras 10 filas).');

    const headers = raw[headerIdx].map(x => String(x || '').toUpperCase().trim());
    const col = (re) => headers.findIndex(h => re.test(h));
    // Prioridad para la columna de referencia (SIRDI en tarifas 2026, REF PROVEDOR en anteriores)
    const idxRef = col(/^SIRDI$/) >= 0 ? col(/^SIRDI$/)
                : col(/REF\s*PROVE?EDOR/) >= 0 ? col(/REF\s*PROVE?EDOR/)
                : col(/REFERENCIA/) >= 0 ? col(/REFERENCIA/)
                : col(/\bREF\b/) >= 0 ? col(/\bREF\b/)
                : col(/CODIGO/);
    const idxName   = col(/NOMBRE|PRODUCTO|DESCRIP/);
    const idxPeso   = col(/PESO/);
    const idxUds    = col(/UDS?\s*X?\s*CAJA|UNIDADES/);
    const idxPrecio = col(/PRECIO\s*FACTURA/);
    // Rebranding Repsol (agosto 2026): productos con nueva imagen cambian de SIRDI y de
    // nombre comercial, pero por dentro son el mismo producto. Cuando la fila ya trae
    // SIRDI NUEVO relleno, esa es la referencia vigente a partir de ahora — la antigua
    // se descataloga (sigue en Skrit pero desaparece de las tarifas nuevas). No todas
    // las filas están rebrandeadas a la vez: en la tarifa de agosto 101 de 895 sí, el
    // resto todavía no, así que se decide fila a fila, no por fichero.
    const idxRefNuevo  = col(/SIRDI\s*NUEVO/);
    const idxNameNuevo = col(/NOMBRE\s*NUEVO/);

    // Tarifa "con aportaciones" (ver ADR 0010): trae, además de todo lo anterior, el
    // precio ya neto de rappels (incondicional + variable + volumen grupo) y el precio
    // neto-neto tras aplicar también el soporte marketing — Repsol ya los calcula por
    // envase/caja en la propia hoja, no hace falta recomputar los rappels intermedios.
    // Se detectan por texto de cabecera, no por letra de columna fija (puede cambiar de
    // mes a mes). Distinción: ambas cabeceras contienen "NETO" y "CAJA"/"ENVASE", pero la
    // de triple neto repite "NETO" dos veces ("PRECIO NETO NETO CAJA/ENVASE") frente a
    // una sola vez en la de neto-neto ("Precio Neto caja/envase").
    const netoCols = [];
    headers.forEach((h, i) => {
      if (!h) return;
      const isCajaOrEnvase = h.includes('CAJA') || h.includes('ENVASE');
      const netoCount = (h.match(/NETO/g) || []).length;
      if (isCajaOrEnvase && netoCount >= 1) netoCols.push({ idx: i, netoCount });
    });
    const idxNetoNeto   = (netoCols.find(c => c.netoCount === 1) || {}).idx;
    const idxTripleNeto = (netoCols.find(c => c.netoCount >= 2) || {}).idx;

    if (idxRef < 0 || idxName < 0 || idxPrecio < 0)
      throw new Error(`Faltan columnas obligatorias. Detectadas: ref=${idxRef>=0?'✓':'✗'} nombre=${idxName>=0?'✓':'✗'} precio=${idxPrecio>=0?'✓':'✗'}. Cabecera vista: ${headers.filter(Boolean).join(' | ')}`);

    const rows = [];
    let currentGama = 'default';
    let currentFam = null;
    for (let i = headerIdx + 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r || r.length === 0) continue;
      const refNuevo = idxRefNuevo >= 0 ? r[idxRefNuevo] : null;
      const nameNuevo = idxNameNuevo >= 0 ? r[idxNameNuevo] : null;
      const ref = refNuevo || r[idxRef];
      const name = refNuevo ? (nameNuevo || r[idxName]) : r[idxName];
      const priceInvoice = r[idxPrecio];   // PRECIO FACTURA = precio por unidad de compra (caja)
      // Fila de cabecera de sección (sin ref o sin precio numérico) — puede ser
      // gama o subcategoría, se clasifica por color; si no es ninguna de las
      // dos (ej. producto real "* Novedad" aún sin precio) simplemente se salta.
      if (!ref || typeof priceInvoice !== 'number' || !isFinite(priceInvoice)) {
        const labelIdx = r.findIndex(v => v != null);
        if (labelIdx >= 0) {
          const label = String(r[labelIdx]).trim();
          const cell = sheet[XLSX.utils.encode_cell({ r: i, c: labelIdx })];
          const fillColor = cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb;
          if (fillColor === GAMA_FILL) { currentGama = slugify(label); currentFam = null; }
          else if (fillColor === FAM_FILL) { currentFam = label; }
        }
        continue;
      }

      const description = Parser.cleanDescription(name);
      const liters = Parser.extractLiters(description);

      // CRÍTICO: Repsol factura por CAJA (unidad de compra), no por envase.
      // Ejemplo: "5W-40 12X1L" con UDS X CAJA=12 y PRECIO FACTURA=102,17 €
      // → coste real por envase (botella de 1L) = 102,17 / 12 = 8,51 €
      // Skrit espera el precio por envase individual, por eso dividimos aquí.
      const unitsPerBox = (idxUds >= 0 && typeof r[idxUds] === 'number' && r[idxUds] > 0)
        ? r[idxUds]
        : 1;
      const costPerPack = priceInvoice / unitsPerBox;

      const netoNetoVal = idxNetoNeto >= 0 ? r[idxNetoNeto] : null;
      const tripleNetoVal = idxTripleNeto >= 0 ? r[idxTripleNeto] : null;

      const row = {
        ref: String(ref).trim(),
        description,
        liters,
        formatKey: Parser.formatKey(liters),
        unitsPerBox,                 // usado para el cálculo; no se muestra en UI
        costPerBox: priceInvoice,    // precio factura original (por caja) — trazabilidad
        netWeight: (idxPeso >= 0 && typeof r[idxPeso] === 'number') ? r[idxPeso] : null,
        costPerPack,                 // precio real por envase individual (lo que espera Skrit)
        gama: currentGama,
        fam: currentFam,
        litersDetected: liters !== null
      };
      // Ya vienen por envase/caja en la propia hoja de Repsol — no hace falta dividir
      // de nuevo por unitsPerBox como con costPerPack.
      if (typeof netoNetoVal === 'number' && isFinite(netoNetoVal)) row.costNetoNeto = netoNetoVal;
      if (typeof tripleNetoVal === 'number' && isFinite(tripleNetoVal)) row.costTripleNeto = tripleNetoVal;

      rows.push(row);
    }
    const gamas = [...new Set(rows.map(r => r.gama))];
    return { supplier: 'Repsol', gamas, rows, sheetUsed: sheetName };
  }

  ExcelReader.registerProfile({
    id: 'repsol',
    name: 'Repsol',
    detect(filename, workbook) {
      const lower = (filename || '').toLowerCase();
      return lower.includes('repsol') || workbook.SheetNames.includes('DATOS');
    },
    read: readRepsol
  });
})();
