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

  const isMarker = (x) => x !== null && typeof x === 'object';   // segmento {id} = elemento de un array por id

  /** Hojas de una configuración: Map(clave → { segs, path, value }). `segs` es la ruta exacta
   *  (los segmentos `{id}` indexan `priceLevels` por id, así reordenar niveles no cuenta como
   *  cambio); `path` es solo el texto para etiquetas. Con `human`, se omiten los campos heredados
   *  del formato antiguo y las marcas internas (no son decisión de nadie); sin `human` (fusión
   *  entre PCs) entra TODO. Las claves pueden contener puntos (formato "0.5"), por eso se
   *  usan `segs` y nunca se parte `path`. */
  function leaves(cfg, human) {
    const out = new Map();
    const put = (segs, path, value) => out.set(JSON.stringify(segs), { segs, path, value });
    const walk = (v, segs, path) => {
      if (v == null || typeof v !== 'object') { put(segs, path, v); return; }
      if (Array.isArray(v)) {
        if (v.length && v.every(x => x && typeof x === 'object' && !Array.isArray(x) && 'id' in x)) {
          for (const x of v) walk(x, [...segs, { id: x.id }], `${path}[${x.id}]`);
        } else put(segs, path, v);
        return;
      }
      const all = Object.keys(v);
      const keys = all.filter(k => !(human && ((!segs.length && LEGACY_TOP_LEVEL.has(k) && cfg && cfg.priceLevels) || IGNORED_LEAF.has(k))));
      if (!keys.length) return;   // objeto vacío: no es un valor, los hijos ya crean/borran el padre
      for (const k of keys) walk(v[k], [...segs, k], path ? `${path}.${k}` : k);
    };
    walk(cfg || {}, [], '');
    return out;
  }

  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

  /** Lista de cambios hoja a hoja entre dos configuraciones: [{ key, segs, path, before, after }]
   *  (`after === undefined` = campo borrado). Es el "parche" que se aplica sobre la última
   *  versión de Neon al guardar. */
  function makePatch(base, cfg, human) {
    const A = leaves(base, human), B = leaves(cfg, human);
    const out = [];
    for (const key of new Set([...A.keys(), ...B.keys()])) {
      const a = A.get(key), b = B.get(key);
      const va = a ? a.value : undefined, vb = b ? b.value : undefined;
      if (same(va, vb) || (human && ((va === '' && vb == null) || (va == null && vb === '')))) continue;
      out.push({ key, segs: (b || a).segs, path: (b || a).path, before: va, after: vb });
    }
    return out;
  }

  function stepInto(cur, seg, next, create) {
    if (isMarker(seg)) {
      if (!Array.isArray(cur)) return null;
      let el = cur.find(x => x && x.id === seg.id);
      if (!el) { if (!create) return null; el = { id: seg.id }; cur.push(el); }
      return el;
    }
    let nx = cur[seg];
    if (nx == null || typeof nx !== 'object') {
      if (!create) return null;
      nx = isMarker(next) ? [] : {};
      cur[seg] = nx;
    }
    return nx;
  }

  /** Valor actual de una ruta en una configuración (undefined si no existe). */
  function getAt(cfg, segs) {
    let cur = cfg;
    for (const seg of segs) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = isMarker(seg) ? (Array.isArray(cur) ? cur.find(x => x && x.id === seg.id) : undefined) : cur[seg];
    }
    return cur;
  }

  /** Copia de `remote` con SOLO los campos del parche aplicados (lo que otro haya cambiado
   *  en otros campos se conserva). */
  function applyPatch(remote, patch) {
    const out = remote == null ? {} : JSON.parse(JSON.stringify(remote));
    for (const e of patch) {
      const create = e.after !== undefined;
      let cur = out, ok = true;
      for (let i = 0; i < e.segs.length - 1; i++) {
        cur = stepInto(cur, e.segs[i], e.segs[i + 1], create);
        if (cur == null) { ok = false; break; }
      }
      if (!ok) continue;
      const last = e.segs[e.segs.length - 1];
      if (isMarker(last)) continue;
      if (!create) delete cur[last]; else cur[last] = JSON.parse(JSON.stringify(e.after));
    }
    return out;
  }

  /** Campos del parche que otra persona había cambiado ya a un valor distinto del nuestro:
   *  ahí gana el último (nosotros) y queda anotado. */
  function conflicts(remote, patch) {
    const out = [];
    for (const e of patch) {
      const rv = getAt(remote, e.segs);
      if (!same(rv, e.before) && !same(rv, e.after)) out.push({ ...e, before: rv });
    }
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
    if (typeof v === 'object') return JSON.stringify(v);
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

  /** Entradas de parche → cambios legibles: [{ path, label, before, after, text }]. */
  function describe(entries, cfgForNames, prefix) {
    const levelNames = {};
    for (const l of ((cfgForNames && cfgForNames.priceLevels) || [])) if (l && l.id && l.label) levelNames[l.id] = l.label;
    const changes = entries.map(e => {
      const label = (prefix || '') + labelFor(e.path, levelNames);
      return { path: e.path, label, before: e.before === undefined ? null : e.before, after: e.after === undefined ? null : e.after,
        text: `${label}: ${valueText(e.path, e.before)} → ${valueText(e.path, e.after)}` };
    });
    changes.sort((x, y) => x.path.localeCompare(y.path));
    return changes;
  }

  /** Cambios entre dos configuraciones, en lenguaje de persona. */
  function diff(before, after) {
    return describe(makePatch(before, after, true), after || before);
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

  return { diff, describe, summarize, makePatch, applyPatch, conflicts, record, fetchRecent };
})();
