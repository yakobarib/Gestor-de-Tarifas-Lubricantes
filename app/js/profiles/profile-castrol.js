/* ============================================================================
   PERFIL: Castrol (formato Castrol — hay también un "formato AD", no cubierto)
   ============================================================================
   Una sola hoja (más una hoja "DATOS" que Yako se crea a mano de apoyo, se
   ignora). Cabecera en la fila 1. Descuentos en cascada, a diferencia del
   resto de proveedores auditados hasta ahora:

     Tarifa referencia → (Pronto Pago + Dto Logístico = Dto total) →
     Precio Unitario (esto YA es "tarifa", por litro) → (Rapel fin de año) →
     Precio neto litro → (aportaciones en céntimos/L: Turfview, AD 360,
     Objetivo CV, Marketing) → Precio neto litro con aportaciones ("neto-neto"
     por litro).

   Solo hacen falta 2 costes de toda la cascada (confirmado por Yako):
   - "Precio Unitario" (tarifa, por litro) × litros envase → costFactura.
   - "Precio Neto Neto envase con todas aportaciones" (ya por envase, columna
     que Yako añade a mano) → costTripleNeto directamente, sin multiplicar.

   Litros: la tarifa no trae una columna de envase real — Yako se la añadió a
   mano para poder verificar cálculos, pero en un fichero futuro no estará.
   Se derivan de la descripción (patrón "NxM<unidad>", igual que Repsol) y se
   verificó que cuadra al 100% contra la columna manual de Yako en esta
   tarifa (371/371 filas). kg/g se convierten con la tabla de equivalencias
   de Castrol (18kg=20L, 180kg=208L —los bidones de esta marca son de 208L,
   no 205L—, 0,4kg=400ML, 25kg=25L —envase de grasa, confirmado por Yako—).

   Descripción: se limpia quitando el paréntesis final tipo "(C)" y la
   unidad de compra (todo lo que va después de la primera coma), y se le
   añade el sufijo de litros propio — igual criterio que Repsol/Racing Oil.

   "Sustituye a": cuando una ref sustituye a una antigua, Yako pidió no
   eliminar la antigua — se duplica la fila bajo la ref antigua además de la
   nueva, para no romper el stock/Turfview a fin de mes.
   ============================================================================ */
(() => {
  const sheetRows = ExcelReader.sheetRows;

  function normalizeHeader(h) {
    return String(h || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Envases estándar de Castrol en kg/g → litros. Confirmado por Yako (25kg = 25L).
  const KG_TO_L_DESC = { 0.4: 0.4, 18: 20, 25: 25, 180: 208 };

  function formatLitersSuffix(liters) {
    if (liters < 1) return `${Math.round(liters * 1000)}ML`;
    return `${liters}L`;
  }

  /** Limpia "Brake Fluid DOT 4 (C), 12X1L H Q3" → "Brake Fluid DOT 4 1L". */
  function cleanCastrolDescription(raw, liters) {
    let namePart = String(raw).split(',')[0];
    namePart = namePart.replace(/\s*\([^)]*\)\s*$/, ''); // "(C)" y similares al final
    namePart = namePart.replace(/(\d+)W-(\d+)/gi, '$1W$2'); // 0W-20 -> 0W20
    namePart = namePart.replace(/\s+/g, ' ').trim();
    return liters != null ? `${namePart} ${formatLitersSuffix(liters)}` : namePart;
  }

  /** Litros del envase a partir de la parte de la descripción tras la primera
   *  coma ("12X1L H Q3" -> 1, "208L B7" -> 208, "18K B5" -> 20 vía tabla). */
  function parseLitersFromDescription(raw) {
    const rest = String(raw).split(',').slice(1).join(',').trim();
    let m = rest.match(/(\d+)\s*[xX]\s*([\d.,]+)\s*(L|KGS?|K)\b/i);
    let num, isKg;
    if (m) {
      num = parseFloat(m[2].replace(',', '.'));
      isKg = /^K/i.test(m[3]);
    } else {
      m = rest.match(/^([\d.,]+)\s*(L|KGS?|K)\b/i);
      if (!m) return null;
      num = parseFloat(m[1].replace(',', '.'));
      isKg = /^K/i.test(m[2]);
    }
    if (isKg) {
      const liters = KG_TO_L_DESC[num];
      return liters != null ? liters : null;
    }
    return num;
  }

  function readCastrol(workbook) {
    const sheetName = workbook.SheetNames.find(n => /^TARIFA/i.test(n)) || workbook.SheetNames[0];
    const raw = sheetRows(workbook, sheetName);
    if (!raw || !raw.length) return { supplier: 'Castrol', gamas: [], rows: [], sheetUsed: '' };

    const headers = raw[0].map(normalizeHeader);
    const idxRef = headers.findIndex(h => h.includes('MATERIAL') || h === 'SKU');
    const idxName = headers.findIndex(h => h.includes('DESCRIP'));
    const idxGama = headers.findIndex(h => h === 'GAMA');
    const idxFamilia = headers.findIndex(h => h.includes('FAMILIA'));
    const idxPrecioUnitario = headers.findIndex(h => h.includes('PRECIO UNITARIO'));
    const idxNetoNetoEnvase = headers.findIndex(h => h.includes('ENVASE') && (h.match(/NETO/g) || []).length >= 2);
    const idxSustituye = headers.findIndex(h => h.includes('SUSTITUYE'));
    if (idxRef < 0 || idxName < 0 || idxPrecioUnitario < 0) {
      throw new Error(`Faltan columnas obligatorias en la tarifa Castrol. Cabecera vista: ${headers.filter(Boolean).join(' | ')}`);
    }

    const rows = [];
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const ref = r[idxRef];
      const nameRaw = r[idxName];
      const precioLitro = r[idxPrecioUnitario];
      if (ref == null || nameRaw == null) continue;
      if (typeof precioLitro !== 'number' || !isFinite(precioLitro) || precioLitro <= 0) continue;

      const liters = parseLitersFromDescription(nameRaw);
      const description = cleanCastrolDescription(nameRaw, liters);
      const costPerPack = liters != null ? precioLitro * liters : null;
      if (costPerPack == null || costPerPack <= 0) continue;

      const netoNetoEnvase = idxNetoNetoEnvase >= 0 ? r[idxNetoNetoEnvase] : null;
      const gama = idxGama >= 0 && r[idxGama] != null ? slugify(r[idxGama]) : 'default';
      const fam = idxFamilia >= 0 ? r[idxFamilia] : null;

      const row = {
        ref: 'CAT' + String(ref).trim(),
        description,
        liters,
        formatKey: Parser.formatKey(liters),
        costPerPack,
        gama,
        fam,
        litersDetected: liters != null
      };
      if (typeof netoNetoEnvase === 'number' && isFinite(netoNetoEnvase) && netoNetoEnvase > 0) {
        row.costTripleNeto = netoNetoEnvase;
      }
      rows.push(row);

      // "Sustituye a": no se elimina la referencia antigua, se duplica la fila
      // bajo su código para no romper stock/Turfview a fin de mes (ver Yako).
      // "NUEVO" es un valor de relleno ("producto nuevo, no sustituye nada"),
      // no una referencia real — 26 filas lo usan así y colisionarían todas
      // bajo la misma ref "CATNUEVO" si no se excluyera.
      const oldRefRaw = idxSustituye >= 0 ? r[idxSustituye] : null;
      const oldRef = oldRefRaw != null ? String(oldRefRaw).trim() : '';
      if (oldRef !== '' && oldRef.toUpperCase() !== 'NUEVO') {
        // `_aliasOf`: el código antiguo nunca va a estar en el maestro de descripciones
        // (está retirado, por definición) — sin esto, MasterDB.putRows() lo marcaba
        // "pendiente de validar" para siempre, aunque el código nuevo (`row.ref`) ya
        // esté verificado. `_aliasOf` le dice que herede la verificación de su gemelo en
        // vez de pedir una validación aparte para lo que es el mismo producto (ver ADR
        // 0049). No se guarda en el maestro — solo lo lee `putRows` al procesar el lote.
        rows.push(Object.assign({}, row, { ref: 'CAT' + oldRef, _aliasOf: row.ref }));
      }
    }
    const gamas = [...new Set(rows.map(r => r.gama))];
    return { supplier: 'Castrol', gamas, rows, sheetUsed: sheetName };
  }

  ExcelReader.registerProfile({
    id: 'castrol',
    name: 'Castrol',
    detect(filename, workbook) {
      const f = (filename || '').toLowerCase();
      if (f.includes('castrol')) return true;
      const sheetName = workbook.SheetNames.find(n => /^TARIFA/i.test(n));
      if (!sheetName) return false;
      const sheet = workbook.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
      const header = (raw[0] || []).map(x => String(x || '').toUpperCase());
      return header.some(h => h.includes('MATERIAL')) && header.some(h => h.includes('PRONTO PAGO'));
    },
    read: readCastrol
  });
})();
