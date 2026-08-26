/* ============================================================================
   MÓDULO: RulesStore  (caché local + sincronización de las reglas de márgenes)
   ============================================================================
   Sustituye las 3 copias sueltas de `configKeyFor`/`Storage.get`/`Storage.set` que
   tenían screen-rules.js, screen-export.js y screen-compare.js — centraliza la
   clave y añade Neon (`pricing_rules`, ver neon-rules.js) sin cambiar el patrón
   síncrono que ya usaban las tres pantallas (leen/escriben en cada tecla, muchas
   veces por render — no pueden depender de una llamada async).

   `load()` sigue siendo síncrono contra `Storage` (localStorage), igual que antes
   — `refresh()` la calienta desde Neon una vez al arrancar (ver app.js). `save()`
   escribe en local al instante (el cambio se ve ya) y empuja a Neon en segundo
   plano; si falla, solo avisa — a diferencia de guardar una validación de
   descripción (ADR 0054), un margen que tarde en llegar a los demás no es un
   problema tan grave como para bloquear la edición. Ver ADR 0062.
*/
const RulesStore = (() => {
  function configKeyFor(brandId, gama) {
    return gama === 'default' ? `config_${brandId}` : `config_${brandId}_${gama}`;
  }

  function load(brandId, gama) {
    return Storage.get(configKeyFor(brandId, gama));
  }

  function save(brandId, gama, cfg) {
    Storage.set(configKeyFor(brandId, gama), cfg);
    if (typeof NeonRules === 'undefined') return;
    NeonRules.upsert(brandId, gama, cfg).catch(err => {
      if (typeof showToast === 'function') {
        showToast('Guardado en este ordenador, pero no se pudo sincronizar con el equipo (sin conexión?).');
      }
      console.error('NeonRules.upsert error', err);
    });
  }

  /** Al arrancar: vuelca en `Storage` lo que el equipo tenga guardado en Neon, bajo las
   *  mismas claves `config_*` de siempre — degrada con gracia si Neon no responde (se
   *  queda con lo que ya hubiera en local, como MasterCache). */
  async function refresh() {
    try {
      const rows = await NeonRules.fetchAll();
      for (const r of rows) {
        Storage.set(configKeyFor(r.brand_id, r.gama), r.config);
      }
      return { offline: false };
    } catch (err) {
      console.error('RulesStore.refresh error', err);
      return { offline: true };
    }
  }

  return { configKeyFor, load, save, refresh };
})();
