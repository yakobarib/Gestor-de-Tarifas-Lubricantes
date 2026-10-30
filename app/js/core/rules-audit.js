/* ============================================================================
   MÓDULO: RulesAudit  (rastro de cambios de las reglas de margen — ADR 0092)
   ============================================================================
   Las reglas se sincronizan "el último que guarda gana" (decisión de Yako, ver ADR 0091),
   pero cada cambio deja rastro: quién (nombre escrito en un diálogo obligatorio, ver
   RulesAuthor), cuándo, y QUÉ cambió exactamente. Este módulo hace dos cosas:

   1. `diff(before, after)`: compara dos configuraciones y devuelve la lista de cambios
      campo a campo, con una etiqueta legible ("PVP · margen formato 1000 L: 15 → 20").
      Funciones puras, sin dependencias del navegador — se prueban con Node.
   2. `record` / `fetchRecent`: escribir y leer la tabla `pricing_rules_log` de Neon
      (solo de añadir: los usuarios pueden insertar y leer, nunca modificar ni borrar).
*/
const RulesAudit = (() => {
  const TABLE = 'pricing_rules_log';

  // Campos que NO son una decisión de nadie: copias heredadas del formato antiguo (la regla
  // vigente vive en `priceLevels`), derivados de otros campos o marcas internas.
  const LEGACY_TOP_LEVEL = new Set(['byFormat', 'rounding', 'manualPvp', 'marginMode', 'defaultMargin']);
  const IGNORED_LEAF = new Set(['_index', 'baseCostField', 'label']);

  const ROUNDING = { none: 'sin redondeo', '2dec': '2 decimales', psy99: 'acabado en ,99', psy95: 'acabado en ,95', step05: 'múltiplo de 0,05 €', int: 'entero' };
  const MODE = { sale: 'sobre venta', cost: 'sobre compra' };
  const BASE_COST = { factura: 'coste factura', netoNeto: 'coste neto-neto', tripleNeto: 'coste triple neto' };
  const FORMAT_MODE = { '1x2': '1+2', pvp_neto: 'PVP Neto' };
  const LEVEL_NAME = { pvp: 'PVP', netos_bonus: 'Netos Bonus', netos_gasolineras: 'Netos Gasolineras' };

  /** Aplana una configuración a { ruta: valor }. `priceLevels` (array de objetos con `id`)
   *  se indexa por id para que reordenar niveles no cuente como cambio. */
  function flatten(cfg) {
    const out = {};
    const walk = (v, path) => {
      if (v == null || typeof v !== 'object') { out[path] = v; return; }
      if (Array.isArray(v)) {
        if (v.length && v.every(x => x && typeof x === 'object' && 'id' in x)) {
          for (const x of v) walk(x, `${path}[${x.id}]`);
        } else {
          out[path] = JSON.stringify(v);
        }
        return;
      }
      for (const k of Object.keys(v)) {
        if (!path && LEGACY_TOP_LEVEL.has(k) && cfg && cfg.priceLevels) continue;
        if (IGNORED_LEAF.has(k)) continue;
        walk(v[k], path ? `${path}.${k}` : k);
      }
    };
    walk(cfg || {}, '');
    return out;
  }

  function formatLabelOf(key) {
    if (key === '?') return 'sin formato';
    const n = parseFloat(key);
    if (!isFinite(n)) return String(key);
    if (typeof Parser !== 'undefined' && Parser.formatLabel) return Parser.formatLabel(n);
    return n < 1 ? `${Math.round(n * 1000)} ml` : `${n} L`;
  }

  function valueText(path, v) {
    if (v === undefined || v === null || v === '') return '(vacío)';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (/\.rounding$/.test(path)) return ROUNDING[v] || String(v);
    if (/\.mode$/.test(path)) return MODE[v] || String(v);
    if (/\.baseCost$/.test(path)) return BASE_COST[v] || String(v);
    if (/\.formatModes\./.test(path)) return FORMAT_MODE[v] || String(v);
    if (/\.premiumByFormat\./.test(path)) return `${v} €`;
    if (/(\.byFormat\.|\.defaultMargin$)/.test(path)) return `${v} %`;
    if (/\.manualOverride\./.test(path)) return `${v} €`;
    return String(v);
  }

  /** Etiqueta legible de una ruta, p. ej. `priceLevels[pvp].byFormat.1000` → "PVP · margen formato 1000 L". */
  function labelFor(path, levelNames) {
    const m = /^priceLevels\[([^\]]+)\]\.?(.*)$/.exec(path);
    if (!m) {
      const b = /^bigContainerFormats\.(.+)$/.exec(path);
      if (b) return `Bidones y cubas · formato ${formatLabelOf(b[1])}`;
      return path;
    }
    const [, id, rest] = m;
    const level = (levelNames && levelNames[id]) || LEVEL_NAME[id] || id;
    let r;
    if (rest === 'defaultMargin') r = 'margen por defecto';
    else if (rest === 'rounding') r = 'redondeo';
    else if (rest === 'mode') r = 'modo de margen';
    else if (rest === 'baseCost') r = 'base de coste';
    else if (rest === 'goesToSkrit') r = '¿va a Skrit?';
    else if ((r = /^byFormat\.(.+)$/.exec(rest))) r = `margen formato ${formatLabelOf(r[1])}`;
    else if ((r = /^formatModes\.(.+)$/.exec(rest))) r = `modo especial formato ${formatLabelOf(r[1])}`;
    else if ((r = /^premiumByFormat\.(.+)$/.exec(rest))) r = `obsequio formato ${formatLabelOf(r[1])}`;
    else if ((r = /^printFormats\.(.+)$/.exec(rest))) r = `salida impresa formato ${formatLabelOf(r[1])}`;
    else if ((r = /^manualOverride\.(.+)$/.exec(rest))) r = `PVP manual de ${r[1]}`;
    else r = rest || 'nivel';
    return `${level} · ${r}`;
  }

  /** Cambios entre dos configuraciones: [{ path, label, before, after, text }]. */
  function diff(before, after) {
    const levelNames = {};
    for (const l of ((after && after.priceLevels) || (before && before.priceLevels) || [])) if (l && l.id && l.label) levelNames[l.id] = l.label;
    const a = flatten(before), b = flatten(after);
    const changes = [];
    for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const va = a[path], vb = b[path];
      const same = va === vb || (va == null && vb == null) || (va === '' && vb == null) || (va == null && vb === '');
      if (same) continue;
      const label = labelFor(path, levelNames);
      changes.push({ path, label, before: va === undefined ? null : va, after: vb === undefined ? null : vb,
        text: `${label}: ${valueText(path, va)} → ${valueText(path, vb)}` });
    }
    changes.sort((x, y) => x.path.localeCompare(y.path));
    return changes;
  }

  /** Resumen en una sola línea: los primeros cambios y cuántos más hay. */
  function summarize(changes, max = 6) {
    if (!changes.length) return 'Sin cambios en los valores';
    const shown = changes.slice(0, max).map(c => c.text);
    return shown.join(' · ') + (changes.length > max ? ` · (+${changes.length - max} más)` : '');
  }

  function neonReady() {
    if (window.__neonClient) return Promise.resolve(window.__neonClient);
    return new Promise((resolve) => {
      window.addEventListener('neon:ready', () => resolve(window.__neonClient), { once: true });
    });
  }

  /** Guarda una entrada del rastro. Lanza si falla: quien llama decide cómo avisar (no debe
   *  bloquear el guardado de la regla en sí). */
  async function record({ brandId, gama, who, summary, changes }) {
    const client = await neonReady();
    const email = (typeof Auth !== 'undefined' && Auth.currentUserEmail()) || null;
    const { error } = await client.from(TABLE).insert({
      brand_id: brandId, gama, changed_by_name: who, changed_by_email: email,
      summary, changes: changes.map(c => ({ path: c.path, label: c.label, before: c.before, after: c.after }))
    });
    if (error) throw new Error(error.message || 'No se pudo guardar el rastro del cambio.');
  }

  /** Últimas entradas (más recientes primero). */
  async function fetchRecent(limit = 300) {
    const client = await neonReady();
    const { data, error } = await client.from(TABLE).select('*').order('changed_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message || 'No se pudo leer el historial de cambios.');
    return data;
  }

  return { diff, summarize, flatten, record, fetchRecent };
})();
