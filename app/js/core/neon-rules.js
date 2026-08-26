/* ============================================================================
   MÓDULO: NeonRules  (lectura/escritura de la tabla compartida pricing_rules)
   ============================================================================
   Mismo patrón que NeonMaster/NeonTariffs — un blob JSON por (marca, gama), espejo
   exacto de lo que hasta ahora vivía solo en `localStorage` (`config_${brandId}
   [_${gama}]`, ver screen-rules.js). A diferencia de las tarifas importadas, aquí
   SIEMPRE se manda el blob entero (no hay merge parcial por campo que preservar —
   guardar una regla ya era, y sigue siendo, "reescribir todo el documento"). Ver
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
      const { data, error } = await client.from(TABLE).select('*').range(offset, offset + PAGE_SIZE - 1);
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

  return { fetchAll, upsert };
})();
