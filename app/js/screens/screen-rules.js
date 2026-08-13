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

  // Umbral que decide si el formato puede tener el modo "1+2" (hasta 5L) o "PVP Neto"
  // (bidones/cubas, a partir de ~150L) disponible como interruptor — fuera de ese rango
  // el interruptor ni se muestra, no tiene sentido para ese tamaño de envase.
  const PROMO_1X2_MAX_LITERS = 5;
  const PVP_NETO_MIN_LITERS = 150;

  // Bidones ~200L (185/200/205/208/209 según proveedor) al 20% sobre venta, cubas
  // ~1000L al 15% — mismos valores que usa la fórmula fija de "PVP Neto" en pricing.js,
  // aquí solo como semilla de margen por formato al crear Netos Bonus por primera vez.
  const CUBAS_MARGIN_BY_FORMAT = { '185': 20, '200': 20, '205': 20, '208': 20, '209': 20, '1000': 15 };
  const BONUS_PREMIUM_BY_FORMAT = { '185': 50, '200': 50, '205': 50, '208': 50, '209': 50, '1000': 100 };

  /** Netos Bonus: coste en cascada (siempre el más bajo disponible, ver ADR 0016), nunca
   *  va a Skrit — son hojas impresas para comerciales, no dependen de Skrit — y en vez de
   *  `onlyFormats` (que antes decidía a la vez "tiene precio" y "se imprime") ahora
   *  `printFormats` solo decide qué formatos se incluyen en la hoja impresa; el precio se
   *  calcula para cualquier formato con coste disponible. */
  function defaultNetosBonusLevel() {
    return {
      id: 'netos_bonus', label: 'Netos Bonus', baseCost: 'tripleNeto', baseCostField: 'costTripleNeto',
      costCascade: ['costTripleNeto', 'costNetoNeto', 'costFactura'], mode: 'sale', defaultMargin: 20,
      byFormat: Object.assign({}, CUBAS_MARGIN_BY_FORMAT), premiumByFormat: Object.assign({}, BONUS_PREMIUM_BY_FORMAT),
      printFormats: {}, rounding: '2dec', manualOverride: {}, goesToSkrit: false
    };
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function configKeyFor(brandId, gama) {
    return gama === 'default' ? `config_${brandId}` : `config_${brandId}_${gama}`;
  }

  /** "Todas las gamas" no tiene su propia config — se lee/edita la de la primera gama
   *  real como representante (lo normal es que Yako quiera la misma política para
   *  todas, ver `saveConfig`). */
  function loadConfig(brandId, gama) {
    const realGama = gama === '__all__' ? ((findBrand(brandId) || {}).gamas || ['default'])[0] : gama;
    const key = configKeyFor(brandId, realGama);
    let cfg = Storage.get(key);
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

    const order = ['pvp', 'netos_bonus'];
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
      Storage.set(configKeyFor(brandId, g), cfg);
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

  function renderGamaSelect() {
    const brand = findBrand(currentBrandId);
    const sel = $('rulesGamaSelect');
    if (!brand || brand.gamas.length <= 1) {
      sel.innerHTML = `<option value="default">General</option>`;
      sel.disabled = true;
      currentGama = 'default';
    } else {
      sel.disabled = false;
      const labels = { normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General', automocion: 'Automoción', industria: 'Industria', 'productos-de-mantenimiento': 'Productos de Mantenimiento', marinos: 'Marinos', grasas: 'Grasas', alimentarios: 'Alimentarios', 'v-ligero': 'V. Ligero', 'v-pesado': 'V. Pesado', agricola: 'Agrícola', transmision: 'Transmisión', hidraulicos: 'Hidráulicos', grasa: 'Grasa', moto: 'Moto', classic: 'Classic', marina: 'Marina', anticogelante: 'Anticongelante', aditivos: 'Aditivos', advance: 'Advance', 'air-tool': 'Air Tool', corena: 'Corena', diala: 'Diala', gadinia: 'Gadinia', gadus: 'Gadus', 'heat-transfer': 'Heat Transfer', helix: 'Helix', hydraulic: 'Hydraulic', morlina: 'Morlina', omala: 'Omala', ondina: 'Ondina', 'paper-mach': 'Paper Mach', refrigeration: 'Refrigeration', rimula: 'Rimula', sirius: 'Sirius', spirax: 'Spirax', tegula: 'Tegula', tellus: 'Tellus', tonna: 'Tonna', transmission: 'Transmission', turbo: 'Turbo', 'vacuum-pump': 'Vacuum Pump', other: 'Other', crb: 'CRB', edge: 'EDGE', gtx: 'GTX', 'gtx-5w': 'GTX 5W', magnatec: 'Magnatec', 'castrol-on': 'Castrol ON', transmax: 'Transmax', vecton: 'Vecton' };
      // "Todas las gamas" primera y por defecto — lo más habitual es gestionar el
      // margen de toda la marca de una vez, no gama a gama.
      sel.innerHTML = '<option value="__all__">Todas las gamas</option>'
        + brand.gamas.map(g => `<option value="${g}">${escapeHtml(labels[g] || g)}</option>`).join('');
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

  async function renderLevels() {
    const cfg = loadConfig(currentBrandId, currentGama);
    const avail = await availableCostFields(currentBrandId, currentGama);
    const formats = await availableFormats(currentBrandId, currentGama);
    if (migrateLevels(cfg, formats)) saveConfig(currentBrandId, currentGama, cfg);
    const el = $('levelsContainer');
    el.innerHTML = cfg.priceLevels.map((lvl, i) => levelCardHtml(lvl, i, avail, formats)).join('');
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
    const marginRow = `<tr><th>Margen (%)</th>${formats.map(f => `
      <td><input type="number" min="0" max="500" step="0.5" data-field="byFormat" data-index="${lvl._index}" data-format="${escapeHtml(f.key)}" placeholder="${lvl.defaultMargin}" value="${lvl.byFormat && lvl.byFormat[f.key] != null ? lvl.byFormat[f.key] : ''}"></td>
    `).join('')}</tr>`;

    let extraRows = '';
    if (lvl.id === 'pvp') {
      extraRows = `
        <tr><th>1+2</th>${formats.map(f => (f.key !== '?' && parseFloat(f.key) <= PROMO_1X2_MAX_LITERS) ? formatToggleCell(lvl, f.key, '1x2') : '<td class="disabled">—</td>').join('')}</tr>
        <tr><th>PVP Neto</th>${formats.map(f => (f.key !== '?' && parseFloat(f.key) >= PVP_NETO_MIN_LITERS) ? formatToggleCell(lvl, f.key, 'pvp_neto') : '<td class="disabled">—</td>').join('')}</tr>
      `;
    } else if (lvl.id === 'netos_bonus') {
      const premiumRow = `<tr><th>Obsequio (€)</th>${formats.map(f => `
        <td><input type="number" min="0" step="0.5" data-field="premiumByFormat" data-index="${lvl._index}" data-format="${escapeHtml(f.key)}" placeholder="0" value="${lvl.premiumByFormat && lvl.premiumByFormat[f.key] != null ? lvl.premiumByFormat[f.key] : ''}"></td>
      `).join('')}</tr>`;
      extraRows = `${premiumRow}<tr><th>Salida impresa</th>${formats.map(f => printToggleCell(lvl, f.key)).join('')}</tr>`;
    }

    return `
      <div class="format-table-wrap">
        <label>Margen por formato (%) — deja vacío para usar el margen por defecto${lvl.id === 'pvp' ? '. "1+2" y "PVP Neto" sustituyen ese margen por su fórmula fija cuando están activados para ese formato' : ''}${lvl.id === 'netos_bonus' ? '. "Obsequio" es el coste en € del regalo de ese formato — se suma al coste antes de calcular el margen (deja vacío = sin obsequio)' : ''}</label>
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
    const isBonus = lvl.id === 'netos_bonus';
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
    $('levelsContainer').addEventListener('change', (e) => {
      const t = e.target;
      const index = t.dataset.index;
      if (index == null) return;
      const field = t.dataset.field;
      if (!field) return;
      if (field === 'byFormat') { updateByFormat(parseInt(index, 10), t.dataset.format, t.value); return; }
      if (field === 'premiumByFormat') { updatePremiumByFormat(parseInt(index, 10), t.dataset.format, t.value); return; }
      const value = field === 'goesToSkrit' ? t.checked : t.value;
      updateLevelField(parseInt(index, 10), field, value);
      if (field === 'goesToSkrit' || field === 'baseCost') renderLevels();
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
  }

  function init() {
    renderBrandSelect();
    setupListeners();
  }

  return { init };
})();
