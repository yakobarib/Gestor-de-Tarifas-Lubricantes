/* ============================================================================
   MÓDULO: history  (comparativa entre tarifas del mismo proveedor)
   ============================================================================
   Almacena en localStorage la última tarifa "vigente" por proveedor:
     { savedAt, tariffDate, refs: [{ref, cost, liters}, ...] }
   Al cargar una nueva tarifa, compara refs vs. la vigente para producir:
     { hasPrevious, previousDate, total, stable, new, obsolete, obsoleteRefs, priceDeltas }
*/
const History = (() => {
  function keyFor(supplierId) {
    return 'history_' + String(supplierId || 'unknown').toLowerCase().replace(/\s+/g, '_');
  }

  function load(supplierId) {
    return Storage.get(keyFor(supplierId), null);
  }

  function save(supplierId, rows, tariffDate) {
    const payload = {
      savedAt: new Date().toISOString().slice(0, 10),
      tariffDate: tariffDate || null,
      refs: rows.map(r => ({
        ref: r.ref,
        cost: r.costPerPack,
        liters: r.liters,
        description: r.description
      }))
    };
    Storage.set(keyFor(supplierId), payload);
    return payload;
  }

  /**
   * Compara filas actuales contra un histórico previo.
   * `rebrandPairs` (opcional): [{ oldRef, newRef }] — ver RebrandMap. Cuando
   * una ref actual no está en el histórico pero es la `newRef` de un rebrand
   * cuya `oldRef` SÍ estaba, se trata como "estable" (mismo producto, cambió
   * de código) en vez de nueva+desaparecida. Marca `row._rebrandedFrom`.
   */
  function diff(currentRows, previous, rebrandPairs) {
    const newToOld = new Map((rebrandPairs || []).map(p => [p.newRef, p.oldRef]));

    if (!previous || !Array.isArray(previous.refs)) {
      for (const row of currentRows) row._status = 'new';
      return {
        hasPrevious: false,
        previousDate: null,
        previousTariffDate: null,
        total: currentRows.length,
        stable: 0,
        new: currentRows.length,
        obsolete: 0,
        obsoleteRefs: [],
        priceDeltas: []
      };
    }
    const currentByRef = new Map(currentRows.map(r => [r.ref, r]));
    const prevByRef = new Map(previous.refs.map(r => [r.ref, r]));
    const rebrandedOldRefs = new Set();

    let stable = 0, newCount = 0;
    const priceDeltas = [];
    for (const [ref, row] of currentByRef) {
      let prev = prevByRef.get(ref);
      let rebrandedFrom = null;
      if (!prev && newToOld.has(ref)) {
        const oldRef = newToOld.get(ref);
        const prevViaRebrand = prevByRef.get(oldRef);
        if (prevViaRebrand) { prev = prevViaRebrand; rebrandedFrom = oldRef; rebrandedOldRefs.add(oldRef); }
      }
      if (prev) {
        stable++;
        row._status = 'stable';
        row._prevCost = prev.cost;
        if (rebrandedFrom) row._rebrandedFrom = rebrandedFrom;
        if (typeof prev.cost === 'number' && typeof row.costPerPack === 'number' && prev.cost > 0) {
          const deltaPct = (row.costPerPack - prev.cost) / prev.cost * 100;
          if (Math.abs(deltaPct) >= 0.01) {
            priceDeltas.push({ ref, prev: prev.cost, curr: row.costPerPack, deltaPct });
          }
        }
      } else {
        newCount++;
        row._status = 'new';
      }
    }
    const obsoleteRefs = [];
    for (const [ref, r] of prevByRef) {
      if (!currentByRef.has(ref) && !rebrandedOldRefs.has(ref)) obsoleteRefs.push({ ref, description: r.description, cost: r.cost });
    }
    return {
      hasPrevious: true,
      previousDate: previous.savedAt,
      previousTariffDate: previous.tariffDate,
      total: currentRows.length,
      stable,
      new: newCount,
      obsolete: obsoleteRefs.length,
      obsoleteRefs,
      priceDeltas
    };
  }

  return { load, save, diff };
})();
