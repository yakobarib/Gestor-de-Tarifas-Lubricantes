/* ==========================================================================
   PERFIL: AD Parts — "Tarifa" maestra de 42 columnas (ver ADR 0098)
   Desde noviembre de 2026 AD Parts manda cada línea en su propio Excel — "Tarifa AD
   Aceites PTarifa 01-11-2026", "Tarifa AD Grasas …", "Tarifa AD Quimicos …" — todos con
   la misma hoja `Tarifa` (REF PROVEEDOR, DESCRIPCION ARTICULO, FAMILIA ADGLOBAL, PRECIO
   COMPRA, NETO NETO, PESO (KG)…). La línea la dice FAMILIA ADGLOBAL, no el nombre del
   fichero:
     ACEITE MOTOR        → gama `normal`, o `standard` si la descripción dice STANDARD
                           (mismo criterio que ya tenían las 40 refs Standard guardadas)
     GRASAS              → gama `grasas`
     QUIMICOS Y ADITIVOS → gama `quimico`
   PRECIO COMPRA es el precio de factura del envase (sin descuento: DTO COMPRA viene a 0).
   NETO NETO, cuando AD lo rellena, entra como coste neto-neto. El triple-neto sigue
   llegando en su propio fichero (ver profile-ad-parts-triple-neto.js).
   Debe cargarse ANTES que los otros perfiles AD: el primero que detecta, gana.
   ========================================================================== */
(() => {
  const sheetRows = ExcelReader.sheetRows;

  // AD reutiliza estos 3 códigos en la lista de químicos (aquí "Concentrado Universal Plus")
  // para productos que en la de aceites son otros (20005 = DEX-ATF, 22005 = SDI 5W40,
  // 26005 = HHM 32). El maestro de descripciones se busca por marca+ref, así que se descartan
  // en químicos igual que ya hacía profile-ad-parts-quimico.js (ver ADR 0046).
  const KNOWN_REF_COLLISIONS = ['20005', '22005', '26005'];

  const norm = (x) => String(x == null ? '' : x).toUpperCase().trim();

  function headerIndexes(raw) {
    if (!raw || !raw.length) return null;
    const h = raw[0].map(norm);
    const idx = {
      ref: h.indexOf('REF PROVEEDOR'),
      desc: h.indexOf('DESCRIPCION ARTICULO'),
      familia: h.indexOf('FAMILIA ADGLOBAL'),
      precio: h.indexOf('PRECIO COMPRA'),
      netoNeto: h.indexOf('NETO NETO'),
      peso: h.indexOf('PESO (KG)')
    };
    return (idx.ref >= 0 && idx.desc >= 0 && idx.familia >= 0 && idx.precio >= 0) ? idx : null;
  }

  function gamaFor(familia, description) {
    const f = norm(familia);
    if (f.startsWith('GRASA')) return 'grasas';
    if (f.startsWith('QUIMICO')) return 'quimico';
    return norm(description).includes('STANDARD') ? 'standard' : 'normal';
  }

  function readTarifa(workbook) {
    const raw = sheetRows(workbook, 'Tarifa');
    const idx = headerIndexes(raw);
    if (!idx) throw new Error('No encuentro las columnas REF PROVEEDOR / DESCRIPCION ARTICULO / FAMILIA ADGLOBAL / PRECIO COMPRA en la hoja "Tarifa".');
    const byKey = new Map();
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const refRaw = r[idx.ref];
      const price = r[idx.precio];
      if (refRaw == null || String(refRaw).trim() === '') continue;
      if (typeof price !== 'number' || !isFinite(price) || price <= 0) continue;
      // Misma ref sin puntos que ya usaba AD Parts ("57.005" → "57005"), ver ADR 0056.
      const ref = String(refRaw).replace(/\./g, '').trim();
      const description = Parser.cleanDescription(r[idx.desc]);
      const gama = gamaFor(r[idx.familia], description);
      if (gama === 'quimico' && KNOWN_REF_COLLISIONS.includes(ref)) continue;
      let liters;
      if (gama === 'grasas') {
        // Las refs de grasas no codifican el formato (64530 = 45 kg): manda el peso neto.
        const peso = idx.peso >= 0 ? r[idx.peso] : null;
        liters = (typeof peso === 'number' && peso > 0) ? peso : Parser.extractLiters(description);
      } else if (gama === 'quimico') {
        liters = Parser.extractLiters(description);
      } else {
        // Aceites: los 3 últimos dígitos de la ref son el formato (5, 208, 1000…).
        liters = Parser.litersFromRefSuffix(ref) ?? Parser.extractLiters(description);
      }
      const row = {
        ref, description, liters,
        formatKey: Parser.formatKey(liters),
        costPerPack: price,
        fam: gama === 'normal' || gama === 'standard' ? '06' : (String(r[idx.familia] || '').trim() || null),
        gama,
        litersDetected: liters != null
      };
      const nn = idx.netoNeto >= 0 ? r[idx.netoNeto] : null;
      if (typeof nn === 'number' && isFinite(nn) && nn > 0) row.costNetoNeto = nn;
      byKey.set(`${gama}::${ref}`, row);   // si AD repite una ref, vale la última
    }
    const rows = [...byKey.values()];
    const gamas = ['normal', 'standard', 'grasas', 'quimico'].filter(g => rows.some(r => r.gama === g));
    return { supplier: 'AD Parts', gamas, rows, sheetUsed: 'Tarifa' };
  }

  ExcelReader.registerProfile({
    id: 'ad_parts_aceite',
    name: 'AD Parts Tarifa (aceites / grasas / químicos)',
    detect(filename, workbook) {
      if (!workbook.SheetNames.includes('Tarifa')) return false;
      const raw = sheetRows(workbook, 'Tarifa');
      if (!headerIndexes(raw)) return false;
      // Castrol manda la misma hoja de 42 columnas (ADR 0099): que no la lea este perfil.
      if (/castrol/i.test(filename || '')) return false;
      const iM = raw[0].map(norm).indexOf('MARCA');
      return !(iM >= 0 && raw.slice(1, 6).some(r => norm(r && r[iM]) === 'CASTROL'));
    },
    read: readTarifa
  });
})();
