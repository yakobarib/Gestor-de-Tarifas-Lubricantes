/* ============================================================================
   PANTALLA: REGLAS
   ============================================================================
   Selección de marca + gama, y edición de sus "niveles de precio"
   (`priceLevels`, ver ADR 0008 y Migration): cada nivel tiene una base de
   coste (factura / neto-neto), un modo de margen, y si va o no a Skrit.
   Presets: PVP (siempre existe), Precio Neto de Venta, Precios para Bonus
   (nunca va a Skrit — uso interno de Yako para ventas especiales).
*/
const ScreenRules = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = null;
  let currentGama = 'default';

  const PRESETS = {
    precio_neto_venta: { id: 'precio_neto_venta', label: 'Precio Neto de Venta', baseCost: 'netoNeto', baseCostField: 'costNetoNeto', mode: 'sale', defaultMargin: 15, byFormat: {}, rounding: 'int', manualOverride: {}, goesToSkrit: true },
    precio_bonus: { id: 'precio_bonus', label: 'Precios para Bonus', baseCost: 'factura', baseCostField: 'costPerPack', mode: 'cost', defaultMargin: 10, byFormat: {}, rounding: 'none', manualOverride: {}, goesToSkrit: false }
  };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function configKeyFor(brandId, gama) {
    return gama === 'default' ? `config_${brandId}` : `config_${brandId}_${gama}`;
  }

  function loadConfig(brandId, gama) {
    const key = configKeyFor(brandId, gama);
    let cfg = Storage.get(key);
    if (!cfg) {
      cfg = { defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualPvp: {} };
    }
    if (!cfg.priceLevels) {
      cfg.priceLevels = [Migration.synthesizePvpLevel(cfg)];
    }
    return cfg;
  }

  function saveConfig(brandId, gama, cfg) {
    Storage.set(configKeyFor(brandId, gama), cfg);
    Store.emit('rules:changed', { brandId, gama });
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
      const labels = { normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General', automocion: 'Automoción', industria: 'Industria', 'productos-de-mantenimiento': 'Productos de Mantenimiento', marinos: 'Marinos', grasas: 'Grasas', alimentarios: 'Alimentarios' };
      sel.innerHTML = brand.gamas.map(g => `<option value="${g}">${escapeHtml(labels[g] || g)}</option>`).join('');
      currentGama = brand.gamas[0];
      sel.value = currentGama;
    }
    renderLevels();
  }

  function renderLevels() {
    const cfg = loadConfig(currentBrandId, currentGama);
    const el = $('levelsContainer');
    el.innerHTML = cfg.priceLevels.map((lvl, i) => levelCardHtml(lvl, i, cfg.priceLevels.length)).join('');
  }

  function levelCardHtml(lvl, index, total) {
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
              <option value="factura" ${!lvl.baseCost || lvl.baseCost === 'factura' ? 'selected' : ''}>Coste factura</option>
              <option value="netoNeto" ${lvl.baseCost === 'netoNeto' ? 'selected' : ''}>Coste neto-neto</option>
              <option value="tripleNeto" ${lvl.baseCost === 'tripleNeto' ? 'selected' : ''}>Coste triple neto</option>
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
      addLevel(presetKey);
    });
  }

  function init() {
    renderBrandSelect();
    setupListeners();
  }

  return { init };
})();
