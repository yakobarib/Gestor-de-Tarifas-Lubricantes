/* ============================================================================
   MÓDULO: LocalInvalidRefs  (referencias descartadas a mano en el panel de
   validación de Tarifas — ver ADR 0048)
   ============================================================================
   Equivalente, para referencias que Yako confirma que NO existen como
   producto real, a lo que `DescriptionOverrides` es para descripciones
   corregidas: vive en este navegador (vía Storage/localStorage), no en
   `MasterDescriptions.INVALID_REFS` (incrustado en el código, ver ADR 0047) —
   esa es la lista "de fábrica"; esta es la capa local que se aplica al
   instante mientras esa referencia todavía no se ha incorporado a la lista
   de fábrica y desplegado.

   `MasterDB.putRows()` consulta esta lista igual que consulta
   `MasterDescriptions.isInvalidRef()` — una referencia descartada aquí nunca
   vuelve a guardarse, en esta marca, aunque la tarifa del proveedor la siga
   trayendo. `countAll()` alimenta el mismo aviso de "sin incorporar al
   maestro" que ya usan las correcciones de descripción.
*/
const LocalInvalidRefs = (() => {
  const keyFor = (brandId) => `local_invalid_refs_${brandId}`;

  function getAll(brandId) {
    return Storage.get(keyFor(brandId), []);
  }

  function has(brandId, ref) {
    return getAll(brandId).includes(ref);
  }

  function add(brandId, ref) {
    const list = getAll(brandId);
    if (!list.includes(ref)) {
      list.push(ref);
      Storage.set(keyFor(brandId), list);
    }
  }

  /** Cuántas referencias hay descartadas SOLO en este navegador, sumando todas las
   *  marcas — para el mismo aviso de "pide que se incorporen al maestro". */
  function countAll() {
    let n = 0;
    for (const key of Storage.list()) {
      if (!key.startsWith('local_invalid_refs_')) continue;
      n += Storage.get(key, []).length;
    }
    return n;
  }

  /** Todos los descartes de todas las marcas, para el botón "Exportar correcciones" del
   *  panel de validación — mismo shape que guarda cada clave, agrupado por marca. */
  function exportAll() {
    const out = {};
    for (const key of Storage.list()) {
      if (!key.startsWith('local_invalid_refs_')) continue;
      const brandId = key.slice('local_invalid_refs_'.length);
      const data = Storage.get(key, []);
      if (data.length) out[brandId] = data;
    }
    return out;
  }

  return { getAll, has, add, countAll, exportAll };
})();
