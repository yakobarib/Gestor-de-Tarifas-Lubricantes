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

   `loadTemplate`/`saveTemplate` (ADR 0064) reusan exactamente el mismo mecanismo con un
   valor de `gama` reservado (`'__default_template__'`, nunca una gama real) — la
   "plantilla por defecto" de una marca es solo una fila más de `pricing_rules`, sin
   cambios de esquema.
*/
const RulesStore = (() => {
  const TEMPLATE_GAMA = '__default_template__';

  function configKeyFor(brandId, gama) {
    return gama === 'default' ? `config_${brandId}` : `config_${brandId}_${gama}`;
  }

  function load(brandId, gama) {
    return Storage.get(configKeyFor(brandId, gama));
  }

  // Rastro de cambios (ADR 0092). Las pantallas guardan en cada tecla, así que el cambio se ve
  // y se guarda en local al instante, y el envío a Neon + el registro "quién/qué" se hacen
  // UNA vez, cuando se deja de teclear (FLUSH_MS): ahí se pregunta el nombre si hace falta.
  const FLUSH_MS = 1500;
  const baselines = new Map();   // clave → último config conocido en Neon (para calcular qué cambió)
  const pending = new Map();     // clave → { brandId, gama, cfg } aún sin enviar
  let timer = null;
  let flushing = false;
  const clone = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));

  function toastSyncError(err) {
    if (typeof showToast === 'function') {
      showToast('Guardado en este ordenador, pero no se pudo sincronizar con el equipo (sin conexión?).');
    }
    console.error('NeonRules.upsert error', err);
  }

  /** `opts.auto`: guardado automático (migración/arranque), no es decisión de nadie → sin
   *  nombre ni rastro. Todo lo demás es un cambio de una persona y deja rastro. */
  function save(brandId, gama, cfg, opts) {
    const key = configKeyFor(brandId, gama);
    if (!baselines.has(key)) baselines.set(key, clone(Storage.get(key)));
    Storage.set(key, cfg);
    if (typeof NeonRules === 'undefined') return;
    if (opts && opts.auto) {
      NeonRules.upsert(brandId, gama, cfg).then(() => baselines.set(key, clone(cfg))).catch(toastSyncError);
      return;
    }
    pending.set(key, { brandId, gama, cfg });
    clearTimeout(timer);
    timer = setTimeout(flush, FLUSH_MS);
  }

  async function flush() {
    if (flushing) { timer = setTimeout(flush, FLUSH_MS); return; }
    if (!pending.size) return;
    flushing = true;
    const batch = [...pending.entries()];
    pending.clear();
    try {
      const who = (typeof RulesAuthor !== 'undefined') ? await RulesAuthor.ensure() : 'Sin identificar';
      const sent = [];
      for (const [key, e] of batch) {
        const cfg = clone(e.cfg);   // lo que el usuario dejó al terminar de teclear
        try {
          await NeonRules.upsert(e.brandId, e.gama, cfg);
        } catch (err) {
          toastSyncError(err);
          if (!pending.has(key)) pending.set(key, e);   // se reintenta con el próximo guardado
          continue;
        }
        const changes = RulesAudit.diff(baselines.get(key), cfg);
        baselines.set(key, cfg);
        if (changes.length) sent.push({ e, changes });
      }
      // "Todas las gamas" genera el mismo cambio N veces: una sola línea de rastro.
      const groups = new Map();
      for (const s of sent) {
        const gk = s.e.brandId + '|' + JSON.stringify(s.changes.map(c => [c.path, c.before, c.after]));
        if (!groups.has(gk)) groups.set(gk, { brandId: s.e.brandId, gamas: [], changes: s.changes });
        groups.get(gk).gamas.push(s.e.gama);
      }
      for (const g of groups.values()) {
        try {
          await RulesAudit.record({
            brandId: g.brandId, gama: g.gamas.length > 1 ? '__all__' : g.gamas[0], who,
            summary: RulesAudit.summarize(g.changes), changes: g.changes
          });
        } catch (err) {
          console.error('RulesAudit.record error', err);
          if (typeof showToast === 'function') showToast('El cambio se guardó, pero no se pudo anotar en el historial.');
        }
      }
    } finally {
      flushing = false;
      if (pending.size) { clearTimeout(timer); timer = setTimeout(flush, FLUSH_MS); }
    }
  }

  /** Al arrancar: vuelca en `Storage` lo que el equipo tenga guardado en Neon, bajo las
   *  mismas claves `config_*` de siempre — degrada con gracia si Neon no responde (se
   *  queda con lo que ya hubiera en local, como MasterCache). */
  async function refresh() {
    try {
      const rows = await NeonRules.fetchAll();
      for (const r of rows) {
        const key = configKeyFor(r.brand_id, r.gama);
        Storage.set(key, r.config);
        baselines.set(key, clone(r.config));
      }
      return { offline: false };
    } catch (err) {
      console.error('RulesStore.refresh error', err);
      return { offline: true };
    }
  }

  function loadTemplate(brandId) {
    return load(brandId, TEMPLATE_GAMA);
  }

  function saveTemplate(brandId, cfg) {
    save(brandId, TEMPLATE_GAMA, cfg);
  }

  return { configKeyFor, load, save, refresh, loadTemplate, saveTemplate };
})();
