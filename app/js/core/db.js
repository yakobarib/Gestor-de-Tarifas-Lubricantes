/* ============================================================================
   MÓDULO: MasterDB  (maestro persistente multi-marca — IndexedDB, ver ADR 0008)
   ============================================================================
   Object store 'rows', keyPath 'id' = `${brandId}::${gama}::${ref}`.
   Guarda la fila COMPLETA de cada referencia importada, con dos niveles de
   coste posibles (costFactura / costNetoNeto — el segundo nullable, se rellena
   proveedor a proveedor conforme se audite su lógica de descuentos/rappels).
   `putRows` hace merge por ref: importar una tarifa "neto-neto" completa las
   filas ya existentes en vez de crear un catálogo paralelo.
   Los metadatos de "última tarifa importada" (pequeños, se pintan al instante)
   viven en localStorage vía Storage, no aquí — ver screens/screen-import.js.

   `putRows` también sustituye descripción/litros por la versión verificada de
   MasterDescriptions/DescriptionOverrides cuando existe, marcando `descVerified`
   — ver ADR 0043.
*/
const MasterDB = (() => {
  const DB_NAME = 'tarifador_master_v1';
  const STORE = 'rows';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB no disponible en este navegador.')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('byBrand', 'brandId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function rowId(brandId, gama, ref) {
    return `${brandId}::${gama}::${ref}`;
  }

  /** Inserta/actualiza una tanda de filas de una gama, fusionando por ref. */
  async function putRows(brandId, gama, rows, tariffType) {
    const db = await open();
    const now = new Date().toISOString().slice(0, 10);
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    for (const r of rows) {
      // Referencias que el proveedor manda en su tarifa pero que Yako confirma que no
      // existen como producto real (ver ADR 0047) — se descartan aquí, no llegan siquiera
      // a guardarse (si ya estaban de una importación anterior, `Migration.run()` las
      // borra por su cuenta la próxima vez que se abra la app). `LocalInvalidRefs` es la
      // misma idea pero descartada a mano desde el panel de Tarifas, en este navegador,
      // todavía sin incorporar a la lista de fábrica (ver ADR 0048).
      if (MasterDescriptions.isInvalidRef(brandId, r.ref) || LocalInvalidRefs.has(brandId, r.ref)) continue;
      const id = rowId(brandId, gama, r.ref);
      const existing = await new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      // Descripción/litros verificados por Yako (ver ADR 0043) mandan sobre lo que traiga
      // la tarifa del proveedor este mes — primero la corrección hecha a mano en este
      // navegador (DescriptionOverrides, la más reciente), si no la de fábrica incrustada
      // (MasterDescriptions). Sin ninguna de las dos, se queda la detección automática de
      // siempre — sin cambios de comportamiento para las refs que aún no están validadas.
      const verified = DescriptionOverrides.get(brandId, r.ref) || MasterDescriptions.lookup(brandId, r.ref);
      const merged = Object.assign(
        { id, brandId, gama, ref: r.ref },
        existing || {},
        {
          description: verified ? verified.description : (r.description || (existing && existing.description) || ''),
          descriptionRaw: r.description || (existing && existing.descriptionRaw) || '',
          // Solo algunos perfiles (Repsol) traen una versión renombrada para exports —
          // el resto no la trae, y las tarifas de salida caen de vuelta a `description`.
          descriptionExport: r.descriptionExport || (existing ? existing.descriptionExport : null),
          liters: verified ? verified.liters : (r.liters != null ? r.liters : (existing ? existing.liters : null)),
          formatKey: verified ? Parser.formatKey(verified.liters) : (r.formatKey || (existing ? existing.formatKey : '?')),
          fam: r.fam != null ? r.fam : (existing ? existing.fam : null),
          litersDetected: verified ? verified.liters != null : !!r.litersDetected,
          descVerified: !!verified
        }
      );
      // Guardia: solo tocar el coste del `tariffType` de este import si la fila trae de
      // verdad un `costPerPack` numérico. Sin esto, una importación de "solo triple-neto"
      // (sin costPerPack, ver ADR 0030 — AD Parts manda esos datos en un fichero aparte,
      // no dentro de la tarifa de factura) borraría a `null` el costFactura ya existente.
      const hasCost = typeof r.costPerPack === 'number' && isFinite(r.costPerPack);
      if (hasCost) {
        if (tariffType === 'triple_neto') {
          merged.costTripleNeto = r.costPerPack;
          merged.costTripleNetoImportedAt = now;
        } else if (tariffType === 'netoNeto') {
          merged.costNetoNeto = r.costPerPack;
          merged.costNetoNetoImportedAt = now;
        } else {
          merged.costFactura = r.costPerPack;
          merged.costFacturaImportedAt = now;
        }
      }
      // Campos explícitos que el propio perfil ya conozca (ej. la tarifa Repsol "con
      // aportaciones" trae factura + neto-neto + triple-neto en la misma fila — ver
      // ADR 0010; o un fichero dedicado solo a triple-neto, ver ADR 0030) mandan sobre
      // el mapeo por tariffType de arriba.
      if (r.costNetoNeto != null) { merged.costNetoNeto = r.costNetoNeto; merged.costNetoNetoImportedAt = now; }
      if (r.costTripleNeto != null) { merged.costTripleNeto = r.costTripleNeto; merged.costTripleNetoImportedAt = now; }
      store.put(merged);
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getByBrand(brandId, gama) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const idx = tx.objectStore(STORE).index('byBrand');
      const req = idx.getAll(brandId);
      req.onsuccess = () => resolve(gama == null ? req.result : req.result.filter(r => r.gama === gama));
      req.onerror = () => reject(req.error);
    });
  }

  async function getByRef(brandId, gama, ref) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(rowId(brandId, gama, ref));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Borra una fila por id (`brandId::gama::ref`) — usado por `Migration.run()` para
   *  quitar referencias ya importadas que luego se confirman inválidas (ver ADR 0047). */
  async function deleteRow(brandId, gama, ref) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(rowId(brandId, gama, ref));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  return { putRows, getByBrand, getByRef, getAll, deleteRow, rowId };
})();
