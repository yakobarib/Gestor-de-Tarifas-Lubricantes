/* ============================================================================
   MÓDULO: EquivalenceIndex  (índice combinado de las 5 categorías de
   equivalencias, con lookup O(1) por marca+ref — ver ADR 0008)
   ============================================================================
   Se persiste en localStorage (no en IndexedDB): el dataset es semi-estático
   (no cambia cada sesión) y modesto en tamaño (el fichero más grande tiene
   ~1000 filas), muy por debajo del límite práctico de localStorage — evita
   abrir un segundo almacén IndexedDB solo para esto.

   Desde ADR 0063 (Fase 3, "extender lo compartido en Neon"), `build()` también
   empuja el índice recién construido a `equivalences` (Neon, una sola fila) —
   igual patrón que RulesStore: local al instante, Neon en segundo plano, avisa
   sin bloquear si falla. `refresh()` hidrata `Storage` desde Neon al arrancar.
*/
const EquivalenceIndex = (() => {
  const KEY = 'equivalence_index_v1';
  let cached = null;

  function indexGroup(refToGroup, groupRef) {
    for (const m of groupRef.members) {
      if (m.ref == null) continue; // "en otros formatos" (ver EquivalenceReader) — no es buscable por ref
      const key = (m.brandKey || '').toUpperCase();
      refToGroup[key] = refToGroup[key] || {};
      refToGroup[key][m.ref] = groupRef;
    }
  }

  /** `categories` no tiene por qué traer las 5 categorías de golpe — desde Importación se
   *  puede volver a soltar UN solo Excel suelto (ej. tras corregir algo en él) en vez de
   *  los 5 a la vez. Antes `build()` sustituía el índice ENTERO por lo recibido, así que
   *  reimportar uno solo borraba en silencio las otras 4 categorías (bug real, visto por
   *  Yako: tras reimportar los 5 uno a uno, el ranking solo mostraba la última). Ahora
   *  solo se reemplazan las categorías que vienen en `categories`; el resto se conserva
   *  del índice cacheado anterior. */
  function build(categories) {
    const prev = load();
    const incomingCats = new Set(categories.map(c => c.category));
    const keptGroups = prev ? prev.groups.filter(g => !incomingCats.has(g.category)) : [];

    const groups = [...keptGroups];
    const refToGroup = {};
    for (const g of keptGroups) indexGroup(refToGroup, g);
    for (const cat of categories) {
      for (const g of cat.groups) {
        const groupRef = { category: cat.category, groupId: g.groupId, specs: g.specs, members: g.members };
        groups.push(groupRef);
        indexGroup(refToGroup, groupRef);
      }
    }
    cached = { groups, refToGroup, builtAt: new Date().toISOString().slice(0, 10) };
    Storage.set(KEY, cached);
    if (typeof NeonEquivalences !== 'undefined') {
      NeonEquivalences.upsert(cached).catch(err => {
        if (typeof showToast === 'function') {
          showToast('Guardado en este ordenador, pero no se pudo sincronizar con el equipo (sin conexión?).');
        }
        console.error('NeonEquivalences.upsert error', err);
      });
    }
    return cached;
  }

  /** Al arrancar: si el equipo ya tiene equivalencias subidas en Neon, las trae y
   *  sustituye lo que hubiera en este navegador — degrada con gracia si Neon no
   *  responde (se queda con la última copia local, como el resto de cachés). */
  async function refresh() {
    try {
      const data = await NeonEquivalences.fetch();
      if (data) { cached = data; Storage.set(KEY, cached); }
      return { offline: false };
    } catch (err) {
      console.error('EquivalenceIndex.refresh error', err);
      return { offline: true };
    }
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

  /** Vacía TAMBIÉN lo que hay en Neon (no solo este navegador) — `build()` fusiona por
   *  categoría a propósito (ver arriba) para que reimportar un fichero suelto no borre
   *  los demás, pero eso significa que renombrar/reestructurar las categorías (ej. ADR
   *  0085: "aceites"/"motor_industrial"/"transmision_ejes" → "vehiculo_ligero"/
   *  "vehiculo_pesado"/"transmision") deja las categorías viejas huérfanas para siempre,
   *  porque ningún fichero nuevo las vuelve a mencionar. `resetAll()` es la vía de escape:
   *  vacía todo para que la siguiente `build()` parta de cero. */
  async function resetAll() {
    cached = { groups: [], refToGroup: {}, builtAt: new Date().toISOString().slice(0, 10) };
    Storage.set(KEY, cached);
    if (typeof NeonEquivalences !== 'undefined') await NeonEquivalences.upsert(cached);
  }

  return { build, load, isLoaded, findEquivalents, clear, refresh, resetAll };
})();
