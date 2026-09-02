/* ============================================================================
   PANTALLA: REGLAS
   ============================================================================
   Selección de marca + gama, y edición de sus "niveles de precio"
   (`priceLevels`, ver ADR 0008 y Migration): cada nivel tiene una base de
   coste (factura / neto-neto), un modo de margen, y si va o no a Skrit.
   Solo hay dos niveles, siempre presentes (se sintetizan si no hay config
   guardada todavía), sin "Añadir nivel":
   - PVP: el que va a Skrit. Por formato puede además marcarse un modo
     especial mutuamente excluyente con el margen normal — "1+2" o "PVP
     Neto" (antes eran niveles aparte que había que añadir/quitar; a Yako le
     resultaba menos visual y conceptualmente un formato solo puede ir de
     una forma, ver ADR 0026 v2).
   - Netos Bonus: nunca va a Skrit (hojas impresas para comerciales) — su
     propio coste/margen por formato, y qué formatos se marcan para esa
     salida impresa.
*/
const ScreenRules = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = null;
  let currentGama = 'default';
  // Qué tarjeta de nivel se muestra (ver ADR 0070 — antes se mostraban las 3 a la vez).
  let currentLevelId = 'pvp';

  const LEVEL_LEGENDS = {
    pvp: `<strong>PVP</strong>: aplica los cálculos según las opciones elegidas para exportar el PVP que va a Skrit.`,
    netos_bonus: `<strong>Netos Bonus</strong>: precios para el programa Bonus de comerciales — precio de salida más margen más el obsequio, hasta llegar al precio neto especial de venta.`,
    netos_gasolineras: `<strong>Netos Gasolineras</strong>: precios Netos exclusivos para Gasolineras — precio de partida más un margen ajustado.`
  };

  // Umbral que decide si el formato puede tener el modo "1+2" (hasta 5L) o "PVP Neto"
  // (bidones/cubas, a partir de ~150L) disponible como interruptor — fuera de ese rango
  // el interruptor ni se muestra, no tiene sentido para ese tamaño de envase.
  const PROMO_1X2_MAX_LITERS = 5;
  const PVP_NETO_MIN_LITERS = 150;

  const GAMA_LABELS = { normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General', automocion: 'Automoción', industria: 'Industria', 'productos-de-mantenimiento': 'Productos de Mantenimiento', marinos: 'Marinos', grasas: 'Grasas', alimentarios: 'Alimentarios', 'v-ligero': 'V. Ligero', 'v-pesado': 'V. Pesado', agricola: 'Agrícola', transmision: 'Transmisión', hidraulicos: 'Hidráulicos', grasa: 'Grasa', moto: 'Moto', classic: 'Classic', marina: 'Marina', anticogelante: 'Anticongelante', aditivos: 'Aditivos', advance: 'Advance', 'air-tool': 'Air Tool', corena: 'Corena', diala: 'Diala', gadinia: 'Gadinia', gadus: 'Gadus', 'heat-transfer': 'Heat Transfer', helix: 'Helix', hydraulic: 'Hydraulic', morlina: 'Morlina', omala: 'Omala', ondina: 'Ondina', 'paper-mach': 'Paper Mach', refrigeration: 'Refrigeration', rimula: 'Rimula', sirius: 'Sirius', spirax: 'Spirax', tegula: 'Tegula', tellus: 'Tellus', tonna: 'Tonna', transmission: 'Transmission', turbo: 'Turbo', 'vacuum-pump': 'Vacuum Pump', other: 'Other', crb: 'CRB', edge: 'EDGE', gtx: 'GTX', 'gtx-5w': 'GTX 5W', magnatec: 'Magnatec', 'castrol-on': 'Castrol ON', transmax: 'Transmax', vecton: 'Vecton' };

  /** Etiqueta legible de una gama para mostrar (títulos de PDF, etc.) — `'__all__'` y
   *  marcas con una sola gama ("General") aparte, el resto sale de `GAMA_LABELS`. */
  function gamaLabelFor(brand, gama) {
    if (gama === '__all__') return 'Todas las gamas';
    if (!brand || brand.gamas.length <= 1) return 'General';
    return GAMA_LABELS[gama] || gama;
  }

  /** Netos Bonus: coste en cascada (siempre el más bajo disponible, ver ADR 0016), nunca
   *  va a Skrit — son hojas impresas para comerciales, no dependen de Skrit — y en vez de
   *  `onlyFormats` (que antes decidía a la vez "tiene precio" y "se imprime") ahora
   *  `printFormats` solo decide qué formatos se incluyen en la hoja impresa; el precio se
   *  calcula para cualquier formato con coste disponible. `byFormat`/`premiumByFormat`
   *  empiezan vacíos (antes traían una semilla fija de 20%/15% y 50€/100€ para bidones/
   *  cubas, indistinguible de un valor puesto a mano — Margen por defecto no la seguía
   *  al cambiarla, bug real, ver ADR 0040) — cada formato sigue "Margen por defecto"
   *  hasta que Yako escriba algo a mano. */
  function defaultNetosBonusLevel() {
    return {
      id: 'netos_bonus', label: 'Netos Bonus', baseCost: 'tripleNeto', baseCostField: 'costTripleNeto',
      costCascade: ['costTripleNeto', 'costNetoNeto', 'costFactura'], mode: 'sale', defaultMargin: 20,
      byFormat: {}, premiumByFormat: {},
      printFormats: {}, rounding: '2dec', manualOverride: {}, goesToSkrit: false
    };
  }

  /** Netos Gasolineras (ver ADR 0070) — mismo patrón que Netos Bonus (copia pedida
   *  explícitamente por Yako, "prácticamente lo mismo"): coste en cascada, nunca va a
   *  Skrit, obsequio por formato y "Salida impresa" propios. Mismo `defaultMargin` de
   *  partida (20%) para no inventar un valor sin que Yako lo haya pedido. */
  function defaultNetosGasolinerasLevel() {
    return {
      id: 'netos_gasolineras', label: 'Netos Gasolineras', baseCost: 'tripleNeto', baseCostField: 'costTripleNeto',
      costCascade: ['costTripleNeto', 'costNetoNeto', 'costFactura'], mode: 'sale', defaultMargin: 20,
      byFormat: {}, premiumByFormat: {},
      printFormats: {}, rounding: '2dec', manualOverride: {}, goesToSkrit: false
    };
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** "Todas las gamas" no tiene su propia config — se lee/edita la de la primera gama
   *  real como representante (lo normal es que Yako quiera la misma política para
   *  todas, ver `saveConfig`). */
  function loadConfig(brandId, gama) {
    const realGama = gama === '__all__' ? ((findBrand(brandId) || {}).gamas || ['default'])[0] : gama;
    let cfg = RulesStore.load(brandId, realGama);
    if (!cfg) {
      cfg = { defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualPvp: {} };
    }
    if (!cfg.priceLevels) {
      cfg.priceLevels = [Migration.synthesizePvpLevel(cfg)];
    }
    return cfg;
  }

  /** Migra configs de antes de ADR 0026 v2 ("1+2"/"Bidones y Cubas Neto" como niveles
   *  aparte) y asegura que siempre existan exactamente los niveles "pvp" y "netos_bonus",
   *  en ese orden. Corre en cada `renderLevels` porque necesita `formats` (async) para
   *  saber qué formatos activar; guarda solo si de verdad cambió algo. */
  function migrateLevels(cfg, formats) {
    let changed = false;
    let pvp = cfg.priceLevels.find(l => l.id === 'pvp');
    if (!pvp) { pvp = Migration.synthesizePvpLevel(cfg); cfg.priceLevels.unshift(pvp); changed = true; }
    if (!pvp.formatModes) { pvp.formatModes = {}; changed = true; }

    const legacyPromo = cfg.priceLevels.find(l => l.id === 'promo_1x2');
    if (legacyPromo) {
      for (const f of formats) {
        if (f.key !== '?' && legacyPromo.maxLiters != null && parseFloat(f.key) <= legacyPromo.maxLiters) {
          pvp.formatModes[f.key] = '1x2';
        }
      }
      cfg.priceLevels = cfg.priceLevels.filter(l => l.id !== 'promo_1x2');
      changed = true;
    }
    const legacyCubas = cfg.priceLevels.find(l => l.id === 'cubas_neto');
    if (legacyCubas) {
      for (const key of (legacyCubas.onlyFormats || [])) pvp.formatModes[key] = 'pvp_neto';
      cfg.priceLevels = cfg.priceLevels.filter(l => l.id !== 'cubas_neto');
      changed = true;
    }

    let bonus = cfg.priceLevels.find(l => l.id === 'netos_bonus');
    if (!bonus) {
      bonus = defaultNetosBonusLevel();
      cfg.priceLevels.push(bonus);
      changed = true;
    }
    if (bonus.goesToSkrit !== false) { bonus.goesToSkrit = false; changed = true; }
    if (!bonus.printFormats) {
      bonus.printFormats = {};
      for (const k of (bonus.onlyFormats || [])) bonus.printFormats[k] = true;
      changed = true;
    }
    if (bonus.onlyFormats) { delete bonus.onlyFormats; changed = true; }

    // Netos Gasolineras (ADR 0070) — mismo alta perezosa que Netos Bonus arriba, para
    // que las marcas ya configuradas antes de este cambio la ganen la primera vez que se
    // abran en Reglas, sin migración aparte.
    let gasolineras = cfg.priceLevels.find(l => l.id === 'netos_gasolineras');
    if (!gasolineras) {
      gasolineras = defaultNetosGasolinerasLevel();
      cfg.priceLevels.push(gasolineras);
      changed = true;
    }

    const order = ['pvp', 'netos_bonus', 'netos_gasolineras'];
    cfg.priceLevels.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return changed;
  }

  /** Al guardar con "Todas las gamas" seleccionada, se difunde la misma config a CADA
   *  gama real de la marca — es lo más habitual (una sola política de margen por marca),
   *  y sobrescribe cualquier diferencia que hubiera entre gamas. Para una gama que
   *  necesite de verdad un margen distinto, hay que seleccionarla suelta en el selector. */
  function saveConfig(brandId, gama, cfg) {
    const gamas = gama === '__all__' ? ((findBrand(brandId) || {}).gamas || ['default']) : [gama];
    for (const g of gamas) {
      RulesStore.save(brandId, g, cfg);
      Store.emit('rules:changed', { brandId, gama: g });
    }
  }

  function renderBrandSelect() {
    const sel = $('rulesBrandSelect');
    sel.innerHTML = BRANDS.filter(b => !b.pending).map(b => `<option value="${b.id}">${escapeHtml(b.label)}</option>`).join('');
    if (!currentBrandId) currentBrandId = sel.value;
    sel.value = currentBrandId;
    renderGamaSelect();
  }

  /** Selector independiente del de arriba — "qué marca(s) resumir" en el PDF de
   *  políticas de precios, no "qué marca estoy editando" (ver ADR 0041). */
  function renderPolicyBrandSelect() {
    const sel = $('rulesPolicyBrandSelect');
    sel.innerHTML = '<option value="__all__">Todas las marcas</option>'
      + BRANDS.filter(b => !b.pending).map(b => `<option value="${b.id}">${escapeHtml(b.label)}</option>`).join('');
  }

  /** `gama` en minúsculas real, o `'__all__'` (representante = primera gama real, como
   *  siempre) — usada tanto por la exportación "todas las marcas" (siempre `'__all__'`,
   *  no tiene sentido "la gama actual" recorriendo 6 marcas de golpe) como por la de una
   *  sola marca (usa la gama seleccionada en pantalla, ver ADR 0064 — "seguir el workflow
   *  visual"). Efecto colateral aceptado: si la marca nunca se abrió en Reglas, sintetiza
   *  y guarda sus niveles por defecto, igual que haría `renderLevels()` la primera vez. */
  async function gatherBrandPolicy(brandId, gama) {
    const brand = findBrand(brandId);
    const cfg = loadConfig(brandId, gama);
    const formats = await availableFormats(brandId, gama);
    if (migrateLevels(cfg, formats)) saveConfig(brandId, gama, cfg);
    const template = RulesStore.loadTemplate(brandId);
    return {
      brand,
      gamaLabel: gamaLabelFor(brand, gama),
      formats,
      pvp: cfg.priceLevels.find(l => l.id === 'pvp'),
      bonus: cfg.priceLevels.find(l => l.id === 'netos_bonus'),
      gasolineras: cfg.priceLevels.find(l => l.id === 'netos_gasolineras'),
      cfg,
      template
    };
  }

  async function doExportPolicies() {
    const btn = $('btnExportPolicies');
    const scope = $('rulesPolicyBrandSelect').value;
    btn.disabled = true;
    try {
      if (scope === '__all__') {
        const brandPolicies = [];
        for (const b of BRANDS.filter(x => !x.pending)) brandPolicies.push(await gatherBrandPolicy(b.id, '__all__'));
        PdfWriter.exportAllPoliciesPdf(brandPolicies);
      } else {
        const policy = await gatherBrandPolicy(scope, currentBrandId === scope ? currentGama : '__all__');
        if (!policy.formats.length) { alert('Esta marca no tiene ninguna tarifa importada todavía — no hay formatos que resumir.'); return; }
        PdfWriter.exportPolicyPdf(policy);
      }
    } finally {
      btn.disabled = false;
    }
  }

  function renderGamaSelect() {
    const brand = findBrand(currentBrandId);
    const sel = $('rulesGamaSelect');
    if (!brand || brand.gamas.length <= 1) {
      sel.innerHTML = `<option value="default">General</option>`;
      sel.disabled = true;
      currentGama = 'default';
    } else {
      sel.disabled = false;
      // "Todas las gamas" primera y por defecto — lo más habitual es gestionar el
      // margen de toda la marca de una vez, no gama a gama.
      sel.innerHTML = '<option value="__all__">Todas las gamas</option>'
        + brand.gamas.map(g => `<option value="${g}">${escapeHtml(GAMA_LABELS[g] || g)}</option>`).join('');
      currentGama = '__all__';
      sel.value = currentGama;
    }
    renderLevels();
  }

  /** Qué bases de coste tienen datos reales para esta marca/gama en el maestro — para no
   *  ofrecer "Coste neto-neto"/"Coste triple neto" en marcas que nunca traen esa columna
   *  (Racing Oil, Eni Live…) y que darían "sin coste" en todas las filas si se eligieran. */
  async function availableCostFields(brandId, gama) {
    const rows = gama === '__all__'
      ? await MasterDB.getByBrand(brandId, null)
      : await MasterDB.getByBrand(brandId, gama);
    const has = (field) => rows.some(r => typeof r[field] === 'number' && isFinite(r[field]));
    return { factura: has('costFactura'), netoNeto: has('costNetoNeto'), tripleNeto: has('costTripleNeto') };
  }

  /** Formatos (litros) reales de esta marca/gama en el maestro, con cuántas refs tiene
   *  cada uno — para que el desglose de margen por formato solo ofrezca formatos que de
   *  verdad existan en esta tarifa, no una lista genérica. */
  async function availableFormats(brandId, gama) {
    const rows = gama === '__all__'
      ? await MasterDB.getByBrand(brandId, null)
      : await MasterDB.getByBrand(brandId, gama);
    const counts = {};
    for (const r of rows) {
      const k = r.formatKey || '?';
      counts[k] = (counts[k] || 0) + 1;
    }
    const keys = Object.keys(counts).sort((a, b) => {
      if (a === '?') return 1; if (b === '?') return -1;
      return parseFloat(a) - parseFloat(b);
    });
    return keys.map(k => ({ key: k, count: counts[k], label: Parser.formatLabel(k === '?' ? null : parseFloat(k)) }));
  }

  /** Un selector por marca/gama (no una tarjeta fija por nivel, ver ADR 0070) — al haber
   *  pasado de 2 a 3 niveles fijos, mostrarlos todos a la vez ocupaba demasiada pantalla.
   *  Las opciones salen de `cfg.priceLevels` (no de una lista fija), así que si en el
   *  futuro se copia el patrón para un cuarto nivel, el selector lo recoge solo. */
  function renderLevelSelect(cfg) {
    const sel = $('rulesLevelSelect');
    if (!sel) return;
    sel.innerHTML = cfg.priceLevels.map(l =>
      `<option value="${escapeHtml(l.id)}" ${l.id === currentLevelId ? 'selected' : ''}>${escapeHtml(l.label)}</option>`
    ).join('');
  }

  /** Leyenda explicativa partida por nivel (antes explicaba PVP y Netos Bonus a la vez
   *  en un único párrafo — con 3 niveles ya no cabía sin ocupar demasiado, ver ADR 0070). */
  function renderLevelLegend() {
    const el = $('rulesLevelLegend');
    if (el) el.innerHTML = LEVEL_LEGENDS[currentLevelId] || '';
  }

  async function renderLevels() {
    const cfg = loadConfig(currentBrandId, currentGama);
    const avail = await availableCostFields(currentBrandId, currentGama);
    const formats = await availableFormats(currentBrandId, currentGama);
    if (migrateLevels(cfg, formats)) saveConfig(currentBrandId, currentGama, cfg);
    renderLevelSelect(cfg);
    // El índice real dentro de `cfg.priceLevels` (no 0) — lo necesitan
    // updateLevelField/updateByFormat/etc. para escribir en el nivel correcto tras
    // filtrar a uno solo visible.
    let index = cfg.priceLevels.findIndex(l => l.id === currentLevelId);
    if (index < 0) { index = 0; currentLevelId = cfg.priceLevels[0].id; }
    renderLevelLegend();
    const el = $('levelsContainer');
    el.innerHTML = levelCardHtml(cfg.priceLevels[index], index, avail, formats);
  }

  function formatToggleCell(lvl, formatKey, mode) {
    const active = lvl.formatModes && lvl.formatModes[formatKey] === mode;
    return `<td><button type="button" class="format-toggle-btn ${active ? 'active' : ''}" data-action="toggle-mode" data-mode="${mode}" data-format="${escapeHtml(formatKey)}" aria-pressed="${active}">${active ? 'Sí' : 'No'}</button></td>`;
  }

  function printToggleCell(lvl, formatKey) {
    const active = !!(lvl.printFormats && lvl.printFormats[formatKey]);
    return `<td><button type="button" class="format-toggle-btn ${active ? 'active' : ''}" data-action="toggle-print" data-format="${escapeHtml(formatKey)}" aria-pressed="${active}">${active ? 'Sí' : 'No'}</button></td>`;
  }

  function formatTableHtml(lvl, formats) {
    // `data-index` en el propio input (no solo en la <table> contenedora) — lo lee
    // directamente el listener de "change" de más abajo; sin él, editar el margen/
    // obsequio por formato no llegaba nunca a guardarse (bug real, ver ADR 0037).
    const marginRow = `<tr><th>Margen (%)</th>${formats.map(f => {
      const hasValue = lvl.byFormat && lvl.byFormat[f.key] != null;
      return `<td><input type="number" min="0" max="500" step="0.5" class="${hasValue ? 'has-value' : ''}" data-field="byFormat" data-index="${lvl._index}" data-format="${escapeHtml(f.key)}" placeholder="${lvl.defaultMargin}" value="${hasValue ? lvl.byFormat[f.key] : ''}"></td>`;
    }).join('')}</tr>`;

    // Cualquier nivel que no sea PVP sigue el patrón "Netos Bonus" (coste en cascada,
    // obsequio por formato, salida impresa) — Netos Gasolineras lo copia sin cambios,
    // y un futuro nivel calcado heredaría el mismo patrón sin tocar este código.
    let extraRows = '';
    if (lvl.id === 'pvp') {
      extraRows = `
        <tr><th>1+2</th>${formats.map(f => (f.key !== '?' && parseFloat(f.key) <= PROMO_1X2_MAX_LITERS) ? formatToggleCell(lvl, f.key, '1x2') : '<td class="disabled">—</td>').join('')}</tr>
        <tr><th>PVP Neto en Bidones y Cubas</th>${formats.map(f => (f.key !== '?' && parseFloat(f.key) >= PVP_NETO_MIN_LITERS) ? formatToggleCell(lvl, f.key, 'pvp_neto') : '<td class="disabled">—</td>').join('')}</tr>
      `;
    } else {
      const premiumRow = `<tr><th>Obsequio (€)</th>${formats.map(f => {
        const hasValue = lvl.premiumByFormat && lvl.premiumByFormat[f.key] != null;
        return `<td><input type="number" min="0" step="0.5" class="${hasValue ? 'has-value' : ''}" data-field="premiumByFormat" data-index="${lvl._index}" data-format="${escapeHtml(f.key)}" placeholder="0" value="${hasValue ? lvl.premiumByFormat[f.key] : ''}"></td>`;
      }).join('')}</tr>`;
      extraRows = `${premiumRow}<tr><th>Salida impresa</th>${formats.map(f => printToggleCell(lvl, f.key)).join('')}</tr>`;
    }

    return `
      <div class="format-table-wrap">
        <label>Margen por formato (%) — deja vacío para usar el margen por defecto${lvl.id === 'pvp' ? '. "1+2" y "PVP Neto" sustituyen ese margen por su fórmula fija cuando están activados para ese formato' : '. "Obsequio" es el coste en € del regalo de ese formato — se suma al coste antes de calcular el margen (deja vacío = sin obsequio)'}</label>
        <div class="format-table-scroll">
          <table class="format-table" data-index="${lvl._index}">
            <thead><tr><th></th>${formats.map(f => `<th>${escapeHtml(f.label)}<small>${f.count} refs</small></th>`).join('')}</tr></thead>
            <tbody>${marginRow}${extraRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function levelCardHtml(lvl, index, avail, formats) {
    lvl._index = index; // leído por formatTableHtml para el data-index de la tabla
    // Solo PVP puede ir a Skrit — cualquier otro nivel (Netos Bonus, Netos Gasolineras...)
    // es siempre uso interno, sin interruptor.
    const isBonus = lvl.id !== 'pvp';
    return `
      <div class="level-card" data-index="${index}">
        <div class="level-card-head">
          <h4>${escapeHtml(lvl.label)}</h4>
          <span class="skrit-flag ${lvl.goesToSkrit ? 'yes' : 'no'}">${lvl.goesToSkrit ? 'va a Skrit' : 'no va a Skrit'}</span>
        </div>
        <div class="level-fields">
          <div class="level-field">
            <label>Base de coste</label>
            <select data-field="baseCost" data-index="${index}">
              <option value="factura" ${!lvl.baseCost || lvl.baseCost === 'factura' ? 'selected' : ''} ${!avail.factura ? 'disabled' : ''}>Coste factura${!avail.factura ? ' (sin datos)' : ''}</option>
              <option value="netoNeto" ${lvl.baseCost === 'netoNeto' ? 'selected' : ''} ${!avail.netoNeto ? 'disabled' : ''}>Coste neto-neto${!avail.netoNeto ? ' (sin datos)' : ''}</option>
              <option value="tripleNeto" ${lvl.baseCost === 'tripleNeto' ? 'selected' : ''} ${!avail.tripleNeto ? 'disabled' : ''}>Coste triple neto${!avail.tripleNeto ? ' (sin datos)' : ''}</option>
            </select>
          </div>
          <div class="level-field">
            <label>Modo de margen</label>
            <select data-field="mode" data-index="${index}">
              <option value="sale" ${lvl.mode !== 'cost' ? 'selected' : ''}>Sobre venta</option>
              <option value="cost" ${lvl.mode === 'cost' ? 'selected' : ''}>Sobre compra</option>
            </select>
          </div>
          <div class="level-field">
            <label>Margen por defecto</label>
            <div class="input-suffix">
              <input type="number" min="0" max="500" step="0.5" data-field="defaultMargin" data-index="${index}" value="${lvl.defaultMargin}">
              <span class="suffix">%</span>
            </div>
          </div>
          <div class="level-field">
            <label>Redondeo</label>
            <select data-field="rounding" data-index="${index}">
              <option value="none" ${lvl.rounding === 'none' ? 'selected' : ''}>Sin redondeo</option>
              <option value="2dec" ${lvl.rounding === '2dec' ? 'selected' : ''}>2 decimales</option>
              <option value="psy99" ${lvl.rounding === 'psy99' ? 'selected' : ''}>Acabado en ,99</option>
              <option value="psy95" ${lvl.rounding === 'psy95' ? 'selected' : ''}>Acabado en ,95</option>
              <option value="step05" ${lvl.rounding === 'step05' ? 'selected' : ''}>Múltiplo de 0,05 €</option>
              <option value="int" ${lvl.rounding === 'int' ? 'selected' : ''}>Entero</option>
            </select>
          </div>
          ${isBonus
            ? `<div class="level-field"><label>&nbsp;</label><span class="skrit-flag no block">no va a Skrit — uso interno</span></div>`
            : `<div class="level-field checkbox"><input type="checkbox" id="skrit-${index}" data-field="goesToSkrit" data-index="${index}" ${lvl.goesToSkrit ? 'checked' : ''}><label for="skrit-${index}">¿Va a Skrit?</label></div>`}
        </div>
        ${formats.length ? formatTableHtml(lvl, formats) : ''}
      </div>
    `;
  }

  function updateLevelField(index, field, value) {
    const cfg = loadConfig(currentBrandId, currentGama);
    const lvl = cfg.priceLevels[index];
    if (!lvl) return;
    if (field === 'baseCost') {
      lvl.baseCost = value;
      lvl.baseCostField = value === 'tripleNeto' ? 'costTripleNeto' : value === 'netoNeto' ? 'costNetoNeto' : 'costPerPack';
    } else if (field === 'defaultMargin') {
      lvl.defaultMargin = parseFloat(value) || 0;
    } else if (field === 'goesToSkrit') {
      lvl.goesToSkrit = !!value;
    } else {
      lvl[field] = value;
    }
    saveConfig(currentBrandId, currentGama, cfg);
  }

  function updateByFormat(index, formatKey, rawValue) {
    const cfg = loadConfig(currentBrandId, currentGama);
    const lvl = cfg.priceLevels[index];
    if (!lvl) return;
    if (!lvl.byFormat) lvl.byFormat = {};
    if (rawValue === '' || rawValue == null) {
      delete lvl.byFormat[formatKey];
    } else {
      const v = parseFloat(rawValue);
      if (isFinite(v)) lvl.byFormat[formatKey] = v; else delete lvl.byFormat[formatKey];
    }
    saveConfig(currentBrandId, currentGama, cfg);
  }

  /** Activa/desactiva el modo especial de un formato en el nivel PVP — mutuamente
   *  excluyente por construcción: es un único valor por formatKey, así que marcar
   *  "pvp_neto" desplaza automáticamente "1x2" para ese mismo formato y viceversa. */
  /** Coste del obsequio de Netos Bonus, por formato — se suma al coste (en pricing.js)
   *  antes de aplicar el margen. A diferencia del margen, sin valor por defecto: un
   *  formato sin importe puesto no lleva obsequio (premium 0), ver ADR 0037. */
  function updatePremiumByFormat(index, formatKey, rawValue) {
    const cfg = loadConfig(currentBrandId, currentGama);
    const lvl = cfg.priceLevels[index];
    if (!lvl) return;
    if (!lvl.premiumByFormat) lvl.premiumByFormat = {};
    if (rawValue === '' || rawValue == null) {
      delete lvl.premiumByFormat[formatKey];
    } else {
      const v = parseFloat(rawValue);
      if (isFinite(v)) lvl.premiumByFormat[formatKey] = v; else delete lvl.premiumByFormat[formatKey];
    }
    saveConfig(currentBrandId, currentGama, cfg);
  }

  function toggleFormatMode(index, formatKey, mode) {
    const cfg = loadConfig(currentBrandId, currentGama);
    const lvl = cfg.priceLevels[index];
    if (!lvl) return;
    if (!lvl.formatModes) lvl.formatModes = {};
    if (lvl.formatModes[formatKey] === mode) delete lvl.formatModes[formatKey];
    else lvl.formatModes[formatKey] = mode;
    saveConfig(currentBrandId, currentGama, cfg);
    renderLevels();
  }

  function togglePrintFormat(index, formatKey) {
    const cfg = loadConfig(currentBrandId, currentGama);
    const lvl = cfg.priceLevels[index];
    if (!lvl) return;
    if (!lvl.printFormats) lvl.printFormats = {};
    if (lvl.printFormats[formatKey]) delete lvl.printFormats[formatKey];
    else lvl.printFormats[formatKey] = true;
    saveConfig(currentBrandId, currentGama, cfg);
    renderLevels();
  }

  function setupListeners() {
    $('rulesBrandSelect').addEventListener('change', (e) => {
      currentBrandId = e.target.value;
      renderGamaSelect();
    });
    $('rulesGamaSelect').addEventListener('change', (e) => {
      currentGama = e.target.value;
      renderLevels();
    });
    const levelSel = $('rulesLevelSelect');
    if (levelSel) levelSel.addEventListener('change', (e) => {
      currentLevelId = e.target.value;
      renderLevels();
    });
    $('levelsContainer').addEventListener('change', (e) => {
      const t = e.target;
      const index = t.dataset.index;
      if (index == null) return;
      const field = t.dataset.field;
      if (!field) return;
      // Solo se cambia la clase del propio input (no un renderLevels() completo) para no
      // perder el foco/orden de tabulación al rellenar varias celdas seguidas — a
      // diferencia de "Margen por defecto", que sí necesita repintar toda la fila porque
      // cambia el placeholder de las demás celdas vacías (ver ADR 0040).
      if (field === 'byFormat') { updateByFormat(parseInt(index, 10), t.dataset.format, t.value); t.classList.toggle('has-value', t.value !== ''); return; }
      if (field === 'premiumByFormat') { updatePremiumByFormat(parseInt(index, 10), t.dataset.format, t.value); t.classList.toggle('has-value', t.value !== ''); return; }
      const value = field === 'goesToSkrit' ? t.checked : t.value;
      updateLevelField(parseInt(index, 10), field, value);
      if (field === 'goesToSkrit' || field === 'baseCost' || field === 'defaultMargin') renderLevels();
    });
    $('levelsContainer').addEventListener('click', (e) => {
      const modeBtn = e.target.closest('[data-action="toggle-mode"]');
      if (modeBtn) {
        const index = parseInt(modeBtn.closest('table').dataset.index, 10);
        toggleFormatMode(index, modeBtn.dataset.format, modeBtn.dataset.mode);
        return;
      }
      const printBtn = e.target.closest('[data-action="toggle-print"]');
      if (printBtn) {
        const index = parseInt(printBtn.closest('table').dataset.index, 10);
        togglePrintFormat(index, printBtn.dataset.format);
      }
    });
    $('btnExportPolicies').addEventListener('click', doExportPolicies);
    const btnSave = $('btnSaveTemplate');
    if (btnSave) btnSave.addEventListener('click', saveAsTemplate);
    const btnReset = $('btnResetTemplate');
    if (btnReset) btnReset.addEventListener('click', resetToTemplate);
  }

  /** "Plantilla por defecto" de una marca (ver ADR 0064) — una fotografía completa del
   *  `cfg` vigente (niveles) de la gama/scope actual, guardada aparte para poder volver a
   *  ella si alguien la lía. Cada marca tiene UNA plantilla, no una
   *  por gama — al guardar con una gama suelta seleccionada, esa gama concreta pasa a ser
   *  el "modelo" de la marca entera. */
  function saveAsTemplate() {
    const brand = findBrand(currentBrandId);
    if (!brand) return;
    const scopeLabel = currentGama === '__all__' ? 'todas las gamas' : gamaLabelFor(brand, currentGama);
    if (!confirm(`¿Guardar la configuración actual de ${brand.label} (${scopeLabel}) como su plantilla por defecto? Sustituye la plantilla anterior de esta marca, si tenía una.`)) return;
    const cfg = loadConfig(currentBrandId, currentGama);
    RulesStore.saveTemplate(currentBrandId, cfg);
    alert(`Plantilla por defecto de ${brand.label} guardada.`);
  }

  /** Aplica la plantilla guardada de la marca al scope actual (gama sola o "Todas las
   *  gamas", mismo mecanismo de `saveConfig`/fan-out de siempre) — sobrescribe lo editado. */
  function resetToTemplate() {
    const brand = findBrand(currentBrandId);
    if (!brand) return;
    const template = RulesStore.loadTemplate(currentBrandId);
    if (!template) { alert(`${brand.label} todavía no tiene una plantilla por defecto guardada.`); return; }
    const scopeLabel = currentGama === '__all__' ? 'todas las gamas' : gamaLabelFor(brand, currentGama);
    if (!confirm(`¿Volver a la plantilla por defecto de ${brand.label} para ${scopeLabel}? Se pierde lo que hayas cambiado a mano en ese scope.`)) return;
    saveConfig(currentBrandId, currentGama, template);
    renderLevels();
  }

  function init() {
    renderBrandSelect();
    renderPolicyBrandSelect();
    setupListeners();
  }

  return { init };
})();
