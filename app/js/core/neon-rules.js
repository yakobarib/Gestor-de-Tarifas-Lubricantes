/* ============================================================================
   MÓDULO: NeonRules  (lectura/escritura de la tabla compartida pricing_rules)
   ============================================================================
   Mismo patrón que NeonMaster/NeonTariffs — un blob JSON por (marca, gama), espejo
   exacto de lo que hasta ahora vivía solo en `localStorage` (`config_${brandId}
   [_${gama}]`, ver screen-rules.js). El blob se guarda entero, pero RulesStore
   lo fusiona antes por campos con lo último de Neon y escribe de forma condicional (ADR 0093). Ver
   ADR 0062 (Fase 2 de "extender lo compartido en Neon").
*/
const NeonRules = (() => {
  const TABLE = 'pricing_rules';
  const PAGE_SIZE = 1000;

  function neonReady() {
    if (window.__neonClient) return Promise.resolve(window.__neonClient);
    return new Promise((resolve) => {
      window.addEventListener('neon:ready', () => resolve(window.__neonClient), { once: true });
    });
  }

  /** Trae la tabla entera, paginada — se llama una vez al arrancar (ver
   *  RulesStore.refresh), nunca por marca ni al abrir la pantalla de Reglas. */
  async function fetchAll() {
    const client = await neonReady();
    const rows = [];
    let offset = 0;
    while (true) {
      // Orden por clave primaria para que la paginación sea estable (ver neon-tariffs.js, ADR 0091).
      const { data, error } = await client.from(TABLE).select('*').order('brand_id').order('gama').range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message || 'Error leyendo las reglas compartidas.');
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return rows;
  }

  /** Guarda el config ENTERO de una marca/gama — no degrada en silencio, pero tampoco
   *  bloquea a quien llama (ver RulesStore.save): el cambio ya se aplicó en local, esto
   *  solo lo lleva al equipo. */
  async function upsert(brandId, gama, config) {
    const client = await neonReady();
    const email = (typeof Auth !== 'undefined' && Auth.currentUserEmail()) || null;
    const { error } = await client.from(TABLE).upsert({ brand_id: brandId, gama, config, updated_by: email });
    if (error) throw new Error(error.message || 'No se pudo sincronizar la regla con el equipo.');
  }

  /** Una sola fila (config + marca de tiempo) o null si aún no existe. */
  async function fetchOne(brandId, gama) {
    const client = await neonReady();
    const { data, error } = await client.from(TABLE).select('config, updated_at').eq('brand_id', brandId).eq('gama', gama).maybeSingle();
    if (error) throw new Error(error.message || 'No se pudo leer la regla compartida.');
    return data || null;
  }

  /** Escritura condicional (ADR 0093): solo escribe si la fila sigue como la leímos
   *  (`expectedUpdatedAt`; null = debe no existir). Devuelve { ok: true } o { ok: false } si
   *  alguien escribió en medio — quien llama vuelve a leer, fusiona y reintenta. */
  async function writeIfUnchanged(brandId, gama, config, expectedUpdatedAt) {
    const client = await neonReady();
    const email = (typeof Auth !== 'undefined' && Auth.currentUserEmail()) || null;
    if (expectedUpdatedAt == null) {
      const { error } = await client.from(TABLE).insert({ brand_id: brandId, gama, config, updated_by: email });
      if (!error) return { ok: true };
      if (error.code === '23505' || /duplicate key/i.test(error.message || '')) return { ok: false };
      throw new Error(error.message || 'No se pudo sincronizar la regla con el equipo.');
    }
    const { data, error } = await client.from(TABLE).update({ config, updated_by: email })
      .eq('brand_id', brandId).eq('gama', gama).eq('updated_at', expectedUpdatedAt).select('gama');
    if (error) throw new Error(error.message || 'No se pudo sincronizar la regla con el equipo.');
    return { ok: !!(data && data.length) };
  }

  return { fetchAll, fetchOne, writeIfUnchanged, upsert };
})();
