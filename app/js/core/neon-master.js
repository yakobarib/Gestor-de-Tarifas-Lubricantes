/* ============================================================================
   MÓDULO: NeonMaster  (lectura/escritura de la tabla compartida verified_descriptions)
   ============================================================================
   Envoltorio fino sobre el cliente de Neon (ver neon-bridge.mjs) — el resto de
   la app nunca llama al SDK directamente, solo a estas dos funciones. Así, si
   algún día hay que cambiar cómo se habla con Neon, el cambio se queda aquí.
   Ver ADR 0054.
*/
const NeonMaster = (() => {
  const TABLE = 'verified_descriptions';
  const PAGE_SIZE = 1000;

  function neonReady() {
    if (window.__neonClient) return Promise.resolve(window.__neonClient);
    return new Promise((resolve) => {
      window.addEventListener('neon:ready', () => resolve(window.__neonClient), { once: true });
    });
  }

  /** Trae la tabla entera, paginada — una sola pasada al arrancar la app (ver
   *  MasterCache.refresh), nunca una petición por referencia. */
  async function fetchAll() {
    const client = await neonReady();
    const rows = [];
    let offset = 0;
    while (true) {
      const { data, error } = await client.from(TABLE).select('*').range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message || 'Error leyendo el maestro compartido.');
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return rows;
  }

  /** Guarda/actualiza una referencia validada (o la marca inválida). Requiere estar
   *  online — a diferencia de la lectura al importar, esto nunca degrada en silencio:
   *  si falla, quien llama debe mostrar el error, no aplicar el cambio en local (ver
   *  ADR 0054 — es la única acción que, si fallara callada, reproduciría el problema
   *  que este cambio existe para resolver). */
  async function upsert(brandId, ref, description, liters, isInvalid) {
    const client = await neonReady();
    const email = Auth.currentUserEmail();
    const { error } = await client.from(TABLE).upsert({
      brand_id: brandId,
      ref,
      description: description || null,
      liters: liters != null ? liters : null,
      is_invalid: !!isInvalid,
      source: 'app',
      updated_by: email
    });
    if (error) throw new Error(error.message || 'No se pudo guardar en el maestro compartido.');
  }

  return { fetchAll, upsert };
})();
