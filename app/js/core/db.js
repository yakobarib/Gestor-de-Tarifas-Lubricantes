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
   MasterCache (maestro compartido en Neon, ver ADR 0054) cuando existe, marcando
   `descVerified`.

   Desde ADR 0060+ (tarifas importadas compartidas), `putRows` además empuja a
   `imported_tariff_rows` (Neon) los campos que cada fila trae de verdad — igual criterio
   que ya usa para decidir qué coste local tocar — y `hydrateFromNeon` vuelca en IndexedDB,
   al arrancar la app, lo que otros compañeros ya hayan importado desde su propio
   ordenador. El push a Neon no bloquea el import (que ya quedó guardado en local): si
   falla, solo avisa.
*/
const MasterDB = (() => {
  const DB_NAME = 'tarifador_master_v1';
  const STORE = 'rows';
  let dbPromise = null;

  const SNAPSHOT_STORE = 'master_cache_snapshot';

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB no disponible en este navegador.')); return; }
      // v2 añade `master_cache_snapshot` (ver MasterCache, ADR 0054) — mismo IndexedDB
      // que ya usaba el maestro de tarifas, para no abrir una segunda conexión aparte.
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('byBrand', 'brandId', { unique: false });
        }
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'key' });
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
    const pendingNeonPush = [];

    // Verificación de todo el lote de una vez, ANTES de guardar nada — hace falta para
    // resolver `_aliasOf` (ver ADR 0049): algunos perfiles (Castrol, "Sustituye a")
    // duplican una fila bajo un código antiguo retirado, que por definición nunca va a
    // estar en el maestro. Sin esto, ese duplicado se quedaba "pendiente de validar"
    // para siempre aunque el código nuevo (`_aliasOf`) ya estuviera verificado — ahora
    // hereda esa misma verificación en vez de pedir una validación aparte para lo que es
    // el mismo producto.
    const verifiedByRef = new Map();
    for (const r of rows) {
      verifiedByRef.set(r.ref, MasterCache.get(brandId, r.ref));
    }
    for (const r of rows) {
      if (!verifiedByRef.get(r.ref) && r._aliasOf && verifiedByRef.has(r._aliasOf)) {
        verifiedByRef.set(r.ref, verifiedByRef.get(r._aliasOf));
      }
    }

    for (const r of rows) {
      // Referencias que el proveedor manda en su tarifa pero que Yako (o quien valide)
      // confirma que no existen como producto real — marcadas `is_invalid` en el maestro
      // compartido (ver ADR 0048/0054), se descartan aquí y no llegan siquiera a
      // guardarse (si ya estaban de una importación anterior, `Migration.run()` las borra
      // por su cuenta la próxima vez que se abra la app).
      if (MasterCache.isInvalid(brandId, r.ref)) continue;
      const id = rowId(brandId, gama, r.ref);
      const existing = await new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      // Descripción/litros verificados (maestro compartido en Neon, vía MasterCache —
      // ver ADR 0054) mandan sobre lo que traiga la tarifa del proveedor este mes, si no
      // la heredada de `_aliasOf` (ver ADR 0049). Sin ninguna de las dos, se queda la
      // detección automática de siempre — sin cambios de comportamiento para las refs que
      // aún no están validadas.
      const verified = verifiedByRef.get(r.ref);
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
          // Guardia igual que `liters` arriba: `'?'` es un string truthy, así que un
          // `r.formatKey || existing.formatKey` sin más pisaba un formato ya resuelto con
          // `'?'` cada vez que una reimportación posterior no lograba extraer los litros
          // de esa fila (ej. Repsol cambia la redacción de la descripción entre tarifas) —
          // bug real detectado por Yako: refs con `liters` correcto pero `formatKey: '?'`.
          formatKey: verified ? Parser.formatKey(verified.liters)
            : ((r.formatKey && r.formatKey !== '?') ? r.formatKey : (existing ? existing.formatKey : '?')),
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

      // Campos que ESTA fila trae de verdad — parcial a propósito, ver
      // NeonTariffs.upsert/upsertBatch: lo que no está aquí no se toca en Neon. IMPORTANTE:
      // solo se incluye un campo si `r` lo trae de verdad (`!= null`), NUNCA a partir de
      // `merged`/`existing` — `Migration.applyMasterDescriptions()` reimporta con filas
      // esqueleto (`{ref}` nada más) para reaplicar el maestro a lo ya importado, y de
      // sacar estos campos de `merged` (que sí hereda de `existing`) se acabaría empujando
      // `null` a Neon para liters/formatKey/fam de CADA fila en CADA arranque.
      const neonFields = {};
      if (r.description != null) neonFields.descriptionRaw = r.description;
      if (r.descriptionExport != null) neonFields.descriptionExport = r.descriptionExport;
      if (r.liters != null) neonFields.liters = r.liters;
      if (r.formatKey != null) neonFields.formatKey = r.formatKey;
      if (r.litersDetected != null) neonFields.litersDetected = !!r.litersDetected;
      if (r.fam != null) neonFields.fam = r.fam;
      if (hasCost) {
        if (tariffType === 'triple_neto') { neonFields.costTripleNeto = r.costPerPack; neonFields.costTripleNetoImportedAt = now; }
        else if (tariffType === 'netoNeto') { neonFields.costNetoNeto = r.costPerPack; neonFields.costNetoNetoImportedAt = now; }
        else { neonFields.costFactura = r.costPerPack; neonFields.costFacturaImportedAt = now; }
      }
      if (r.costNetoNeto != null) { neonFields.costNetoNeto = r.costNetoNeto; neonFields.costNetoNetoImportedAt = now; }
      if (r.costTripleNeto != null) { neonFields.costTripleNeto = r.costTripleNeto; neonFields.costTripleNetoImportedAt = now; }
      if (Object.keys(neonFields).length) pendingNeonPush.push({ brandId, gama, ref: r.ref, fields: neonFields });
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    // El push a Neon va DESPUÉS de que el import ya quedó guardado en local — si falla
    // (sin red, RLS, lo que sea), el import sigue viéndose en pantalla igual, solo se
    // avisa que no llegó al equipo (ver ADR 0060+, no es tan crítico como guardar una
    // validación desde Tarifas, que si falla no aplica el cambio ni en local).
    if (pendingNeonPush.length && typeof NeonTariffs !== 'undefined') {
      try {
        await NeonTariffs.upsertMany(pendingNeonPush);
      } catch (err) {
        if (typeof showToast === 'function') {
          showToast('Importado en este ordenador, pero no se pudo sincronizar con el equipo (sin conexión?).');
        }
        console.error('NeonTariffs.upsertBatch error', err);
      }
    }
  }

  /** Vuelca en IndexedDB lo que ya haya en `imported_tariff_rows` (Neon) — se llama al
   *  arrancar la app (ver app.js finishBoot), ANTES de Migration.run(), para que las
   *  tarifas que otro compañero ya importó desde su propio ordenador aparezcan aquí sin
   *  reimportar nada. `description`/`formatKey`/`descVerified` se dejan en un estado
   *  provisional a partir del dato crudo — `Migration.run()`'s `applyMasterDescriptions()`
   *  los recalcula justo después contra el MasterCache ya calentado, igual que hace con
   *  cualquier fila (ver ADR 0054), así que no hace falta acertarlos aquí. */
  async function hydrateFromNeon(neonRows) {
    if (!neonRows.length) return;
    const db = await open();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const nr of neonRows) {
      const id = rowId(nr.brand_id, nr.gama, nr.ref);
      store.put({
        id, brandId: nr.brand_id, gama: nr.gama, ref: nr.ref,
        description: nr.description_raw || '',
        descriptionRaw: nr.description_raw || '',
        descriptionExport: nr.description_export != null ? nr.description_export : null,
        liters: nr.liters,
        formatKey: nr.format_key || '?',
        fam: nr.fam,
        litersDetected: !!nr.liters_detected,
        descVerified: false,
        costFactura: nr.cost_factura,
        costFacturaImportedAt: nr.cost_factura_imported_at,
        costNetoNeto: nr.cost_neto_neto,
        costNetoNetoImportedAt: nr.cost_neto_neto_imported_at,
        costTripleNeto: nr.cost_triple_neto,
        costTripleNetoImportedAt: nr.cost_triple_neto_imported_at
      });
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

  // `openDb`/`SNAPSHOT_STORE` expuestos para que `MasterCache` reutilice esta misma
  // conexión/promesa en vez de abrir una segunda a la misma IndexedDB (ver ADR 0054).
  return { putRows, hydrateFromNeon, getByBrand, getByRef, getAll, deleteRow, rowId, openDb: open, SNAPSHOT_STORE };
})();
