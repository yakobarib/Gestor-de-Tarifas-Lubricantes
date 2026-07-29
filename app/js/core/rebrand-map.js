/* ============================================================================
   MÓDULO: RebrandMap  (cruce ref antigua ↔ ref nueva por rebranding, ver ADR 0009)
   ============================================================================
   Algunos proveedores renombran productos (mismo producto, nuevo código +
   nombre comercial) — ej. Repsol en la tarifa de agosto 2026: SIRDI/NOMBRE
   antiguos → SIRDI NUEVO/NOMBRE NUEVO. La tarifa entrante ya usa solo la ref
   nueva (ver profile-repsol.js), pero la comparativa histórica (History.diff)
   necesita saber que "ref nueva X" es continuación de "ref antigua Y" para no
   mostrarlo como alta+baja. Este mapa persiste ese cruce en localStorage,
   independiente de que la tarifa del mes siga trayendo ambos códigos o no.
   Se carga desde un Excel con columnas MARCA / SIRDI ANTIGUA / SIRDI NUEVA
   (nombres de columna flexibles, ver readRebrandExcel).
*/
const RebrandMap = (() => {
  function keyFor(supplierId) {
    return `rebrand_map_${String(supplierId || 'unknown').toLowerCase().replace(/\s+/g, '_')}`;
  }

  /** pairs: [{ oldRef, newRef, oldName?, newName? }] */
  function save(supplierId, pairs) {
    Storage.set(keyFor(supplierId), pairs);
  }

  function load(supplierId) {
    return Storage.get(keyFor(supplierId), []);
  }

  /** newRef → oldRef, para lookup O(1) desde History.diff. */
  function toNewToOldMap(pairs) {
    const m = new Map();
    for (const p of pairs || []) {
      if (p.newRef) m.set(p.newRef, p.oldRef);
    }
    return m;
  }

  /**
   * Lee un Excel de cruce de rebranding. Detecta cabecera por nombre de
   * columna flexible: MARCA (opcional, si no está se usa `defaultBrand`),
   * y un par de columnas cuyo nombre contenga "ANTIGU"/"VIEJ" y "NUEV".
   */
  function readRebrandExcel(workbook, defaultBrand) {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
    if (!raw.length) return [];
    const headers = raw[0].map(x => String(x || '').toUpperCase().trim());
    const idxMarca = headers.findIndex(h => h === 'MARCA');
    const idxOld = headers.findIndex(h => /ANTIGU|VIEJ/.test(h) && !h.includes('NOMBRE'));
    const idxNew = headers.findIndex(h => /NUEV/.test(h) && !h.includes('NOMBRE'));
    const idxOldName = headers.findIndex(h => h.includes('NOMBRE') && /ANTIGU|VIEJ/.test(h));
    const idxNewName = headers.findIndex(h => h.includes('NOMBRE') && /NUEV/.test(h));
    if (idxOld < 0 || idxNew < 0) return [];

    const bySupplier = {};
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i];
      if (!r) continue;
      const oldRef = r[idxOld];
      const newRef = r[idxNew];
      if (!oldRef || !newRef) continue;
      const brand = idxMarca >= 0 && r[idxMarca] ? String(r[idxMarca]).trim() : (defaultBrand || 'desconocida');
      (bySupplier[brand] = bySupplier[brand] || []).push({
        oldRef: String(oldRef).trim(),
        newRef: String(newRef).trim(),
        oldName: idxOldName >= 0 ? r[idxOldName] : null,
        newName: idxNewName >= 0 ? r[idxNewName] : null
      });
    }
    return bySupplier;
  }

  return { save, load, toNewToOldMap, readRebrandExcel };
})();
