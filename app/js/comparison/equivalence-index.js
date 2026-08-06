/* ============================================================================
   MÓDULO: EquivalenceIndex  (índice combinado de las 5 categorías de
   equivalencias, con lookup O(1) por marca+ref — ver ADR 0008)
   ============================================================================
   Se persiste en localStorage (no en IndexedDB): el dataset es semi-estático
   (no cambia cada sesión) y modesto en tamaño (el fichero más grande tiene
   ~1000 filas), muy por debajo del límite práctico de localStorage — evita
   abrir un segundo almacén IndexedDB solo para esto.
*/
const EquivalenceIndex = (() => {
  const KEY = 'equivalence_index_v1';
  let cached = null;

  function build(categories) {
    const groups = [];
    const refToGroup = {};
    for (const cat of categories) {
      for (const g of cat.groups) {
        const groupRef = { category: cat.category, groupId: g.groupId, specs: g.specs, members: g.members };
        groups.push(groupRef);
        for (const m of g.members) {
          if (m.ref == null) continue; // "en otros formatos" (ver EquivalenceReader) — no es buscable por ref
          const key = (m.brandKey || '').toUpperCase();
          refToGroup[key] = refToGroup[key] || {};
          refToGroup[key][m.ref] = groupRef;
        }
      }
    }
    cached = { groups, refToGroup, builtAt: new Date().toISOString().slice(0, 10) };
    Storage.set(KEY, cached);
    return cached;
  }

  function load() {
    if (cached) return cached;
    cached = Storage.get(KEY, null);
    return cached;
  }

  function isLoaded() {
    return !!load();
  }

  /** brandKey: tal como aparece en los ficheros de equivalencias (ej. 'AD PARTS', 'REPSOL'). */
  function findEquivalents(brandKey, ref) {
    const idx = load();
    if (!idx) return null;
    const byBrand = idx.refToGroup[(brandKey || '').toUpperCase()];
    if (!byBrand) return null;
    return byBrand[ref] || null;
  }

  function clear() {
    cached = null;
    Storage.delete(KEY);
  }

  return { build, load, isLoaded, findEquivalents, clear };
})();
