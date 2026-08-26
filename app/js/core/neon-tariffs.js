/* ============================================================================
   MÓDULO: NeonTariffs  (lectura/escritura de la tabla compartida imported_tariff_rows)
   ============================================================================
   Mismo patrón que NeonMaster (ver neon-master.js, ADR 0054) para las tarifas
   importadas en sí — descripción/litros verificados siguen viviendo solo en
   verified_descriptions/MasterCache, esta tabla no los duplica. Ver ADR 0060+
   (extensión de lo compartido en Neon — tarifas/reglas/equivalencias).
*/
const NeonTariffs = (() => {
  const TABLE = 'imported_tariff_rows';
  const PAGE_SIZE = 1000;

  // camelCase (forma que usa MasterDB) -> nombre de columna en Postgres.
  const FIELD_MAP = {
    descriptionRaw: 'description_raw',
    descriptionExport: 'description_export',
    liters: 'liters',
    formatKey: 'format_key',
    litersDetected: 'liters_detected',
    fam: 'fam',
    costFactura: 'cost_factura',
    costFacturaImportedAt: 'cost_factura_imported_at',
    costNetoNeto: 'cost_neto_neto',
    costNetoNetoImportedAt: 'cost_neto_neto_imported_at',
    costTripleNeto: 'cost_triple_neto',
    costTripleNetoImportedAt: 'cost_triple_neto_imported_at'
  };

  function neonReady() {
    if (window.__neonClient) return Promise.resolve(window.__neonClient);
    return new Promise((resolve) => {
      window.addEventListener('neon:ready', () => resolve(window.__neonClient), { once: true });
    });
  }

  /** Trae la tabla entera, paginada — una sola pasada al arrancar la app (ver
   *  app.js finishBoot), nunca una petición por marca ni por import. */
  async function fetchAll() {
    const client = await neonReady();
    const rows = [];
    let offset = 0;
    while (true) {
      const { data, error } = await client.from(TABLE).select('*').range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message || 'Error leyendo las tarifas compartidas.');
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return rows;
  }

  function toPayload(brandId, gama, ref, fields, email) {
    const payload = { brand_id: brandId, gama, ref, updated_by: email };
    for (const key of Object.keys(fields)) {
      const column = FIELD_MAP[key];
      if (!column) continue;
      payload[column] = fields[key] != null ? fields[key] : null;
    }
    return payload;
  }

  /** Guarda/actualiza una fila de tarifa importada — `fields` es PARCIAL a propósito
   *  (solo las claves camelCase de FIELD_MAP que esta importación trae de verdad).
   *  El Data API solo toca en Postgres las columnas presentes en el cuerpo del upsert;
   *  las que faltan quedan intactas en la fila existente — así una importación de
   *  "solo triple-neto" no anula costFactura/costNetoNeto ya guardados, igual que hace
   *  hoy MasterDB.putRows() en local (ver ADR 0060+). No degrada en silencio: si falla,
   *  quien llama debe avisar (no es tan crítico como guardar una validación — el import
   *  ya se guardó en local, ver db.js). */
  async function upsert(brandId, gama, ref, fields) {
    const client = await neonReady();
    const email = (typeof Auth !== 'undefined' && Auth.currentUserEmail()) || null;
    const { error } = await client.from(TABLE).upsert(toPayload(brandId, gama, ref, fields, email));
    if (error) throw new Error(error.message || 'No se pudo sincronizar la tarifa con el equipo.');
  }

  /** Igual que `upsert`, pero para muchas filas en una sola petición — usado al importar
   *  una tarifa completa. IMPORTANTE: todas las filas de `items` deben traer el MISMO
   *  conjunto de claves en `fields` (quien llama agrupa por eso antes de invocar esto) —
   *  un upsert en lote de PostgREST usa una sola lista de columnas para todo el lote, así
   *  que mezclar conjuntos de claves distintos en una misma llamada rompería el "las
   *  columnas ausentes quedan intactas" para filas que sí las traían. */
  async function upsertBatch(items) {
    if (!items.length) return;
    const client = await neonReady();
    const email = (typeof Auth !== 'undefined' && Auth.currentUserEmail()) || null;
    const payload = items.map(it => toPayload(it.brandId, it.gama, it.ref, it.fields, email));
    const { error } = await client.from(TABLE).upsert(payload);
    if (error) throw new Error(error.message || 'No se pudo sincronizar la tarifa con el equipo.');
  }

  /** Punto de entrada normal para empujar muchas filas de golpe (import real o la
   *  migración de una sola vez que sube lo que ya hubiera en local, ver migration.js):
   *  agrupa `items` por el conjunto exacto de claves de `fields` (ver `upsertBatch`) y
   *  además trocea cada grupo en tandas de `CHUNK_SIZE` para no mandar una sola petición
   *  gigante. Lanza en el primer trozo que falle — quien llama decide si eso es
   *  bloqueante o solo un aviso. */
  async function upsertMany(items) {
    if (!items.length) return;
    const CHUNK_SIZE = 500;
    const groups = new Map();
    for (const item of items) {
      const key = Object.keys(item.fields).sort().join(',');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i += CHUNK_SIZE) {
        await upsertBatch(group.slice(i, i + CHUNK_SIZE));
      }
    }
  }

  return { fetchAll, upsert, upsertBatch, upsertMany, FIELD_MAP };
})();
