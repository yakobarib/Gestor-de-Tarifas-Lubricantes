/* ============================================================================
   MÓDULO: DescriptionOverrides  (correcciones de descripción/litros hechas a
   mano en el panel de validación de Tarifas — ver ADR 0043)
   ============================================================================
   Vive en este navegador (vía Storage/localStorage), NO en el maestro de
   fábrica incrustado (MasterDescriptions) — es la capa que manda mientras esa
   corrección todavía no se ha incorporado al código. `MasterDB.putRows()`
   consulta primero aquí y solo si no hay nada cae a `MasterDescriptions`.

   Al no ser un fichero externo ni un servicio en la nube (decisión explícita
   de Yako, ver ADR 0043), estas correcciones NO se sincronizan solas entre
   dispositivos — hay que pedir que se incorporen al fichero de datos y se
   suban al repositorio para que estén en todos los sitios. `countAll()` es lo
   que alimenta el aviso persistente de "N correcciones sin incorporar".
*/
const DescriptionOverrides = (() => {
  const keyFor = (brandId) => `desc_override_${brandId}`;

  function getAll(brandId) {
    return Storage.get(keyFor(brandId), {});
  }

  /** {description, liters} corregidos a mano, o null si esta ref no tiene
   *  ninguna corrección guardada en este navegador. */
  function get(brandId, ref) {
    const all = getAll(brandId);
    const entry = all[ref];
    return entry ? { description: entry[0], liters: entry[1] } : null;
  }

  function set(brandId, ref, description, liters) {
    const all = getAll(brandId);
    all[ref] = [description, liters];
    Storage.set(keyFor(brandId), all);
  }

  /** Cuántas correcciones hay guardadas SOLO en este navegador, sumando todas
   *  las marcas — para el aviso de "pide que se incorporen al maestro". */
  function countAll() {
    let n = 0;
    for (const key of Storage.list()) {
      if (!key.startsWith('desc_override_')) continue;
      n += Object.keys(Storage.get(key, {})).length;
    }
    return n;
  }

  return { get, getAll, set, countAll };
})();
