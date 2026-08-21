/* ============================================================================
   MÓDULO: MasterCache  (caché en memoria del maestro compartido — ver ADR 0054)
   ============================================================================
   Sustituye a master-descriptions.js + description-overrides.js +
   local-invalid-refs.js: una sola carga completa de `verified_descriptions`
   (Neon) al arrancar la app, guardada en un Map en memoria — `db.js` la
   consulta de forma síncrona, igual que antes consultaba esos tres módulos.

   Si Neon no responde al arrancar (wifi de tienda), se usa el último snapshot
   guardado en IndexedDB en vez de bloquear la app — la lectura al importar
   una tarifa degrada con gracia. Guardar una validación nueva, en cambio, NO
   degrada: si falla, quien llama debe mostrarlo como error (ver
   `screen-tarifas.js`), nunca fingir que se guardó.
*/
const MasterCache = (() => {
  const SNAPSHOT_STORE = MasterDB.SNAPSHOT_STORE;
  const SNAPSHOT_KEY = 'snapshot';
  let map = new Map();
  let lastSyncedAt = null;

  function cacheKey(brandId, ref) {
    return `${brandId}::${ref}`;
  }

  async function loadSnapshotFromIndexedDb() {
    const db = await MasterDB.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const req = tx.objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveSnapshotToIndexedDb(rows, syncedAt) {
    const db = await MasterDB.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(SNAPSHOT_STORE).put({ key: SNAPSHOT_KEY, rows, syncedAt });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function loadRowsIntoMap(rows) {
    map = new Map();
    for (const r of rows) {
      map.set(cacheKey(r.brand_id, r.ref), {
        description: r.description,
        liters: r.liters,
        isInvalid: !!r.is_invalid
      });
    }
  }

  /** Una sola pasada al arrancar la app (tras el login, antes de inicializar
   *  pantallas) — nunca por marca, nunca por import. Devuelve `{ offline: bool,
   *  syncedAt }` para que la pantalla pueda avisar sin bloquear si tocó usar el
   *  último snapshot conocido. */
  async function refresh() {
    try {
      const rows = await NeonMaster.fetchAll();
      loadRowsIntoMap(rows);
      lastSyncedAt = new Date().toISOString();
      await saveSnapshotToIndexedDb(rows, lastSyncedAt);
      return { offline: false, syncedAt: lastSyncedAt };
    } catch (err) {
      const snapshot = await loadSnapshotFromIndexedDb().catch(() => null);
      if (snapshot) {
        loadRowsIntoMap(snapshot.rows);
        lastSyncedAt = snapshot.syncedAt;
      } else {
        loadRowsIntoMap([]);
        lastSyncedAt = null;
      }
      return { offline: true, syncedAt: lastSyncedAt };
    }
  }

  /** {description, liters} o null — síncrono, lee el mapa ya calentado por `refresh()`. */
  function get(brandId, ref) {
    const entry = map.get(cacheKey(brandId, ref));
    return entry && !entry.isInvalid ? { description: entry.description, liters: entry.liters } : null;
  }

  function isInvalid(brandId, ref) {
    const entry = map.get(cacheKey(brandId, ref));
    return !!(entry && entry.isInvalid);
  }

  /** Actualiza una sola entrada tras un guardado/descarte correcto en Neon — evita tener
   *  que releer la tabla entera por una sola fila (ver `screen-tarifas.js`). */
  function setLocal(brandId, ref, description, liters, invalid) {
    map.set(cacheKey(brandId, ref), { description, liters, isInvalid: !!invalid });
  }

  return { refresh, get, isInvalid, setLocal };
})();
