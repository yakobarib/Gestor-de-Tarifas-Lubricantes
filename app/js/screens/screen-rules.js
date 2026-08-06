/* ============================================================================
   PANTALLA: REGLAS
   ============================================================================
   Selección de marca + gama, y edición de sus "niveles de precio"
   (`priceLevels`, ver ADR 0008 y Migration): cada nivel tiene una base de
   coste (factura / neto-neto), un modo de margen, y si va o no a Skrit.
   El nivel "pvp" siempre existe (se sintetiza vía Migration si no hay
   config guardada todavía) — "Añadir nivel" es solo para niveles extra:
   Bidones y Cubas Neto, Netos Bonus (ver ADR 0015/0016). El preset
   "Precio Neto de Venta" del diseño original (ADR 0008) quedó obsoleto y se
   retiró — Yako lo confundía con PVP y en la práctica solo se usan los dos
   anteriores.
*/
const ScreenRules = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = null;
  let currentGama = 'default';

  // Bidones ~200L (185/200/205/208/209 según proveedor) al 20% sobre venta, cubas
  // ~1000L al 15% sobre venta — confirmado por Yako 2026-07-31. `onlyFormats` hace que
  // Pricing.compute devuelva "sin coste" (no un PVP a 0% de margen) para cualquier
  // formato que no sea bidón o cuba — este nivel no tiene precio fuera de esos dos.
  // Netos Bonus usa el mismo desglose de formato/margen, con un "precio del premio"
  // (50€ bidones / 100€ cubas) sumado al coste antes de aplicar el margen — ver ADR 0016.
  const CUBAS_FORMATS = ['185', '200', '205', '208', '209', '1000'];
  const CUBAS_MARGIN_BY_FORMAT = { '185': 20, '200': 20, '205': 20, '208': 20, '209': 20, '1000': 15 };
  const BONUS_PREMIUM_BY_FORMAT = { '185': 50, '200': 50, '205': 50, '208': 50, '209': 50, '1000': 100 };

  const PRESETS = {
    cubas_neto: { id: 'cubas_neto', label: 'Bidones y Cubas Neto', baseCost: 'factura', baseCostField: 'costPerPack', mode: 'sale', defaultMargin: 20, onlyFormats: CUBAS_FORMATS, byFormat: CUBAS_MARGIN_BY_FORMAT, rounding: '2dec', manualOverride: {}, goesToSkrit: true },
    // "Siempre el precio más bajo disponible" (Yako): triple-neto si existe, si no
    // neto-neto, si no factura. costCascade ya usa los nombres de campo del maestro
    // (MasterDB) porque este nivel solo tiene sentido en Comparación/Exportación.
    netos_bonus: { id: 'netos_bonus', label: 'Netos Bonus', baseCost: 'tripleNeto', baseCostField: 'costTripleNeto', costCascade: ['costTripleNeto', 'costNetoNeto', 'costFactura'], mode: 'sale', defaultMargin: 20, onlyFormats: CUBAS_FORMATS, byFormat: CUBAS_MARGIN_BY_FORMAT, premiumByFormat: BONUS_PREMIUM_BY_FORMAT, rounding: '2dec', manualOverride: {}, goesToSkrit: true }
  };

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
    const el = $('levelsContainer');
    el.innerHTML = cfg.priceLevels.map((lvl, i) => levelCardHtml(lvl, i, cfg.priceLevels.length, avail, formats)).join('');
  }

  function levelCardHtml(lvl, index, total, avail, formats) {
    // Un nivel con `onlyFormats` (Bidones y Cubas Neto, Netos Bonus) solo tiene precio
    // para esos formatos — no tiene sentido ofrecer margen por formato para el resto.
    const editableFormats = lvl.onlyFormats ? formats.filter(f => lvl.onlyFormats.includes(f.key)) : formats;
    const byFormatHtml = editableFormats.length ? `
      <div class="level-field wide">
        <label>Margen por formato (%) — deja vacío para usar el margen por defecto</label>
        <div class="byformat-grid">
          ${editableFormats.map(f => `
            <div class="format-row">
              <label>${escapeHtml(f.label)}</label>
              <input type="number" min="0" max="500" step="0.5" data-field="byFormat" data-format="${escapeHtml(f.key)}" data-index="${index}" placeholder="${lvl.defaultMargin}" value="${lvl.byFormat && lvl.byFormat[f.key] != null ? lvl.byFormat[f.key] : ''}">
              <span class="count">${f.count} refs</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';
    const canDelete = lvl.id !== 'pvp' && total > 1;
    return `
      <div class="level-card" data-index="${index}">
        <div class="level-card-head">
          <h4>${escapeHtml(lvl.label)}</h4>
          <span class="skrit-flag ${lvl.goesToSkrit ? 'yes' : 'no'}">${lvl.goesToSkrit ? 'va a Skrit' : 'no va a Skrit'}</span>
          ${canDelete ? `<button type="button" class="delete-level" data-action="delete-level" data-index="${index}">Eliminar</button>` : ''}
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
            <input type="number" min="0" max="500" step="0.5" data-field="defaultMargin" data-index="${index}" value="${lvl.defaultMargin}">
          </div>
          ${byFormatHtml}
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
          <div class="level-field checkbox">
            <input type="checkbox" id="skrit-${index}" data-field="goesToSkrit" data-index="${index}" ${lvl.goesToSkrit ? 'checked' : ''}>
            <label for="skrit-${index}">¿Va a Skrit?</label>
          </div>
        </div>
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

  function addLevel(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const cfg = loadConfig(currentBrandId, currentGama);
    if (cfg.priceLevels.some(l => l.id === preset.id)) { alert('Ese nivel ya existe para esta marca/gama.'); return; }
    cfg.priceLevels.push(JSON.parse(JSON.stringify(preset)));
    saveConfig(currentBrandId, currentGama, cfg);
    renderLevels();
  }

  function deleteLevel(index) {
    const cfg = loadConfig(currentBrandId, currentGama);
    cfg.priceLevels.splice(index, 1);
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
      const value = field === 'goesToSkrit' ? t.checked : t.value;
      updateLevelField(parseInt(index, 10), field, value);
      if (field === 'goesToSkrit' || field === 'baseCost') renderLevels();
    });
    $('levelsContainer').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="delete-level"]');
      if (!btn) return;
      deleteLevel(parseInt(btn.dataset.index, 10));
    });
    $('btnAddLevel').addEventListener('click', () => {
      const presetKey = $('newLevelPreset').value;
      if (!presetKey) { alert('Elige un preset antes de añadir un nivel.'); return; }
      addLevel(presetKey);
    });
  }

  function init() {
    renderBrandSelect();
    setupListeners();
  }

  return { init };
})();
