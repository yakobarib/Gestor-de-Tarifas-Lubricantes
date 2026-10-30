/* ============================================================================
   MÓDULO: RulesStore  (caché local + sincronización de las reglas de márgenes)
   ============================================================================
   Sustituye las 3 copias sueltas de `configKeyFor`/`Storage.get`/`Storage.set` que
   tenían screen-rules.js, screen-export.js y screen-compare.js — centraliza la
   clave y añade Neon (`pricing_rules`, ver neon-rules.js) sin cambiar el patrón
   síncrono que ya usaban las tres pantallas (leen/escriben en cada tecla, muchas
   veces por render — no pueden depender de una llamada async).

   `load()` sigue siendo síncrono contra `Storage` (localStorage). `save()` escribe en
   local al instante (el cambio se ve ya) y lo lleva a Neon en segundo plano, con estas
   garantías (ADR 0092 y 0093):

   - POR CAMPOS: no se manda el config entero, sino solo lo que esta persona cambió
     (parche = config local vs. última versión conocida en Neon). Se lee lo último de Neon,
     se aplica el parche encima y se escribe — así lo que otra persona cambiara en OTROS
     campos (p. ej. un PVP manual) se conserva. Si ambos tocan el mismo campo gana el último
     y queda anotado en el historial.
   - CONDICIONAL: la escritura solo se acepta si nadie escribió entre la lectura y la
     escritura (`updated_at`); si no, se vuelve a leer, fusionar y reintentar.
   - SIN CONEXIÓN: los cambios pendientes se guardan en el navegador (`rules_pending`) y se
     reintentan al volver la conexión y al arrancar, ANTES de que `refresh()` traiga lo de
     Neon — un cambio pendiente nunca se sobrescribe.
   - RASTRO: cada cambio de una persona se anota con su nombre (ver RulesAudit/RulesAuthor).

   `loadTemplate`/`saveTemplate` (ADR 0064) reusan exactamente el mismo mecanismo con un
   valor de `gama` reservado (`'__default_template__'`, nunca una gama real).
*/
const RulesStore = (() => {
  const TEMPLATE_GAMA = '__default_template__';
  const PENDING_KEY = 'rules_pending';
  const FLUSH_MS = 1500;        // tras dejar de teclear
  const RETRY_MS = 60 * 1000;   // reintento mientras haya pendientes sin enviar
  const MAX_ATTEMPTS = 5;       // lecturas+escrituras seguidas si alguien escribe a la vez

  const baselines = new Map();  // clave → último config conocido en Neon
  const pending = new Map();    // clave → { brandId, gama, baseline, auto, who }
  let timer = null;
  let flushing = false;
  const clone = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));

  function configKeyFor(brandId, gama) {
    return gama === 'default' ? `config_${brandId}` : `config_${brandId}_${gama}`;
  }

  function load(brandId, gama) {
    return Storage.get(configKeyFor(brandId, gama));
  }

  function persistPending() {
    const obj = {};
    for (const [k, e] of pending) obj[k] = e;
    if (pending.size) Storage.set(PENDING_KEY, obj); else Storage.delete(PENDING_KEY);
  }

  function restorePending() {
    const stored = Storage.get(PENDING_KEY) || {};
    for (const [k, e] of Object.entries(stored)) {
      if (!pending.has(k)) pending.set(k, e);
    }
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(flush, ms);
  }

  /** `opts.auto`: guardado automático (migración/arranque), no es decisión de nadie → sin
   *  nombre ni rastro (pero igualmente por campos y condicional). */
  function save(brandId, gama, cfg, opts) {
    const key = configKeyFor(brandId, gama);
    const auto = !!(opts && opts.auto);
    const prev = pending.get(key);
    // Punto de partida del parche: lo último que sabíamos de Neon (o, si no lo sabíamos, lo
    // que había en local antes de este cambio).
    const baseline = prev ? prev.baseline : (baselines.has(key) ? baselines.get(key) : clone(Storage.get(key)));
    Storage.set(key, cfg);
    if (typeof NeonRules === 'undefined') return;
    pending.set(key, { brandId, gama, baseline, auto: prev ? (prev.auto && auto) : auto, who: prev ? prev.who : undefined });
    persistPending();
    schedule(FLUSH_MS);
  }

  /** Envía una marca/gama: lee lo último de Neon, aplica solo nuestro parche, escribe de forma
   *  condicional. Devuelve { patch, conflicts, merged } o null si no había nada que enviar. */
  async function syncOne(key, e) {
    const local = clone(Storage.get(key));
    const patch = RulesAudit.makePatch(e.baseline, local, false);
    if (!patch.length) { baselines.set(key, local); return null; }
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const remote = await NeonRules.fetchOne(e.brandId, e.gama);
      const merged = remote ? RulesAudit.applyPatch(remote.config, patch) : local;
      const clash = remote ? RulesAudit.conflicts(remote.config, patch) : [];
      const res = await NeonRules.writeIfUnchanged(e.brandId, e.gama, merged, remote ? remote.updated_at : null);
      if (!res.ok) continue;   // alguien escribió en medio: releer, fusionar y reintentar
      baselines.set(key, clone(merged));
      // Si nadie tocó la regla mientras esperábamos a la red, el local recoge lo que otras
      // personas hubieran cambiado (y las pantallas se enteran). Si sí la tocó, NO se pisa: esas
      // ediciones nuevas viajan en su propio parche, que parte de lo que acabamos de enviar.
      const edited = JSON.stringify(Storage.get(key)) !== JSON.stringify(local);
      if (!edited && JSON.stringify(merged) !== JSON.stringify(local)) {
        Storage.set(key, merged);
        if (typeof Store !== 'undefined' && Store.emit) Store.emit('rules:changed', { brandId: e.brandId, gama: e.gama });
      }
      return { patch, clash, mine: local };
    }
    throw new Error('Demasiadas escrituras simultáneas sobre la misma regla.');
  }

  async function flush() {
    if (flushing) { schedule(FLUSH_MS); return; }
    if (!pending.size) return;
    flushing = true;
    let failed = 0;
    try {
      const batch = [...pending.entries()];
      let who = null;
      if (batch.some(([, e]) => !e.auto)) {
        who = batch.map(([, e]) => e.who).find(Boolean) || ((typeof RulesAuthor !== 'undefined') ? await RulesAuthor.ensure() : 'Sin identificar');
        for (const [, e] of batch) if (!e.auto && !e.who) e.who = who;
        persistPending();
      }
      const sent = [];
      for (const [key, e] of batch) {
        try {
          const r = await syncOne(key, e);
          const newer = pending.get(key);
          if (newer === e) pending.delete(key);
          else if (newer && r) newer.baseline = clone(r.mine);   // editado durante el envío
          if (r && !e.auto) sent.push({ e, r, changes: RulesAudit.diff(e.baseline, r.mine) });
        } catch (err) {
          failed++;
          console.error('RulesStore.syncOne error', key, err);
        }
      }
      persistPending();
      await recordAudit(sent, who);
    } finally {
      flushing = false;
      if (failed && typeof showToast === 'function') {
        showToast(`Guardado en este ordenador. ${failed} cambio(s) pendiente(s) de enviar al equipo: se reintentará solo.`);
      }
      if (pending.size) schedule(failed ? RETRY_MS : FLUSH_MS);
    }
  }

  async function recordAudit(sent, who) {
    // "Todas las gamas" genera el mismo cambio N veces: una sola línea de rastro.
    const groups = new Map();
    for (const s of sent) {
      if (!s.changes.length && !s.r.clash.length) continue;
      const gk = s.e.brandId + '|' + JSON.stringify(s.changes.map(c => [c.path, c.before, c.after]));
      if (!groups.has(gk)) groups.set(gk, { brandId: s.e.brandId, gamas: [], changes: s.changes, clash: [] });
      const g = groups.get(gk);
      g.gamas.push(s.e.gama);
      g.clash.push(...s.r.clash);
    }
    for (const g of groups.values()) {
      const clash = RulesAudit.describe(g.clash, null, 'Pisó el valor de otra persona · ');
      const uniqueClash = clash.filter((c, i) => clash.findIndex(x => x.path === c.path) === i);
      const changes = [...g.changes, ...uniqueClash];
      const note = uniqueClash.length ? ` · ⚠ pisó cambios de otra persona en ${uniqueClash.length} campo(s)` : '';
      try {
        await RulesAudit.record({
          brandId: g.brandId, gama: g.gamas.length > 1 ? '__all__' : g.gamas[0], who,
          summary: RulesAudit.summarize(g.changes) + note, changes
        });
      } catch (err) {
        console.error('RulesAudit.record error', err);
        if (typeof showToast === 'function') showToast('El cambio se guardó, pero no se pudo anotar en el historial.');
      }
    }
  }

  /** Al arrancar: primero envía lo que se quedó pendiente (cambios hechos sin conexión o con la
   *  página cerrada a medias), y SOLO después vuelca en `Storage` lo que el equipo tenga en Neon
   *  — nunca sobrescribe una regla con cambios aún sin enviar. Degrada con gracia si Neon no
   *  responde (se queda con lo local). */
  async function refresh() {
    try {
      restorePending();
      if (pending.size) await flush();
      const rows = await NeonRules.fetchAll();
      for (const r of rows) {
        const key = configKeyFor(r.brand_id, r.gama);
        if (pending.has(key)) continue;   // sigue sin enviar: lo local manda
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

  // Al volver la conexión, enviar lo pendiente sin esperar al reintento.
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { restorePending(); if (pending.size) schedule(500); });
  }

  return { configKeyFor, load, save, refresh, loadTemplate, saveTemplate, pendingCount: () => pending.size };
})();
