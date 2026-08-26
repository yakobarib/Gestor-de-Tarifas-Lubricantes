/* ============================================================================
   MÓDULO: NeonEquivalences  (lectura/escritura de la tabla compartida equivalences)
   ============================================================================
   Una sola fila (`id = 'singleton'`) con el JSON que antes vivía solo en
   localStorage (ver equivalence-index.js) — el fichero de equivalencias es un
   único dataset semi-estático, no por marca/gama. Mismo patrón que
   NeonMaster/NeonTariffs/NeonRules. Ver ADR 0063 (Fase 3 de "extender lo
   compartido en Neon").
*/
const NeonEquivalences = (() => {
  const TABLE = 'equivalences';
  const ROW_ID = 'singleton';

  function neonReady() {
    if (window.__neonClient) return Promise.resolve(window.__neonClient);
    return new Promise((resolve) => {
      window.addEventListener('neon:ready', () => resolve(window.__neonClient), { once: true });
    });
  }

  /** `null` si nadie ha subido el fichero de equivalencias todavía (fila no existe). */
  async function fetch() {
    const client = await neonReady();
    const { data, error } = await client.from(TABLE).select('*').eq('id', ROW_ID);
    if (error) throw new Error(error.message || 'Error leyendo las equivalencias compartidas.');
    return data && data.length ? data[0].data : null;
  }

  async function upsert(data) {
    const client = await neonReady();
    const email = (typeof Auth !== 'undefined' && Auth.currentUserEmail()) || null;
    const { error } = await client.from(TABLE).upsert({ id: ROW_ID, data, updated_by: email });
    if (error) throw new Error(error.message || 'No se pudieron sincronizar las equivalencias con el equipo.');
  }

  return { fetch, upsert };
})();
