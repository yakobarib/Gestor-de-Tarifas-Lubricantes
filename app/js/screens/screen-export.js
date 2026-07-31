/* ============================================================================
   PANTALLA: EXPORTACIÓN
   ============================================================================
   Elegir marca + gama + nivel de precio (de los `priceLevels` configurados en
   REGLAS) y exportar el layout unificado de 9 columnas (ver ADR 0008) leyendo
   las filas directamente del maestro (MasterDB). Solo se listan los niveles
   con `goesToSkrit: true` — "Precios para Bonus" nunca aparece aquí.
*/
const ScreenExport = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = '';
  let currentGama = 'default';

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function configKeyFor(brandId, gama) {
    return gama === 'default' ? `config_${brandId}` : `config_${brandId}_${gama}`;
  }

  /** Las filas del maestro usan costFactura/costNetoNeto, no costPerPack (ver ADR 0008) —
   *  se remapea baseCostField a partir de baseCost antes de pasarlo a Pricing.compute. */
  function forMaster(level) {
    const baseCostField = level.baseCost === 'tripleNeto' ? 'costTripleNeto'
                        : level.baseCost === 'netoNeto' ? 'costNetoNeto'
                        : 'costFactura';
    return Object.assign({}, level, { baseCostField });
  }

  function loadLevels(brandId, gama) {
    const cfg = Storage.get(configKeyFor(brandId, gama));
    const raw = (cfg && cfg.priceLevels && cfg.priceLevels.length)
      ? cfg.priceLevels
      : [Migration.synthesizePvpLevel(cfg || { defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualPvp: {} })];
    return raw.map(forMaster);
  }

  function renderBrandSelect() {
    const sel = $('exportBrandSelect');
    const options = ['<option value="">Ninguna</option>']
      .concat(BRANDS.filter(b => !b.pending).map(b => `<option value="${b.id}">${escapeHtml(b.label)}</option>`));
    sel.innerHTML = options.join('');
    sel.value = currentBrandId;
    renderGamaSelect();
  }

  function renderGamaSelect() {
    const brand = findBrand(currentBrandId);
    const sel = $('exportGamaSelect');
    if (!brand) {
      sel.innerHTML = `<option value="default">—</option>`;
      sel.disabled = true;
      currentGama = 'default';
    } else if (brand.gamas.length <= 1) {
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
    renderLevelSelect();
  }

  function renderLevelSelect() {
    const sel = $('exportLevelSelect');
    if (!currentBrandId) {
      sel.innerHTML = '<option value="">Elige una marca primero</option>';
      return;
    }
    const levels = loadLevels(currentBrandId, currentGama).filter(l => l.goesToSkrit);
    if (!levels.length) {
      sel.innerHTML = '<option value="">Sin niveles exportables a Skrit para esta marca/gama</option>';
      return;
    }
    sel.innerHTML = levels.map((l, i) => `<option value="${i}">${escapeHtml(l.label)}</option>`).join('');
  }

  async function doExport() {
    const brand = findBrand(currentBrandId);
    if (!brand) { alert('Elige una marca antes de exportar.'); return; }
    const levels = loadLevels(currentBrandId, currentGama).filter(l => l.goesToSkrit);
    const levelIdx = parseInt($('exportLevelSelect').value, 10);
    const level = levels[levelIdx];
    if (!level) { alert('Elige marca, gama y nivel de precio.'); return; }
    const rows = await MasterDB.getByBrand(currentBrandId, currentGama);
    if (!rows.length) { alert('No hay tarifa importada para esta marca/gama en el maestro.'); return; }
    const tariffDate = $('exportTariffDate').value || new Date().toISOString().slice(0, 10);
    const fname = ExcelWriter.exportSkritV2(rows, brand.abbr, level, tariffDate);
    $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${rows.length} filas, nivel "${escapeHtml(level.label)}").</small>`;
  }

  function setupListeners() {
    $('exportBrandSelect').addEventListener('change', (e) => { currentBrandId = e.target.value; renderGamaSelect(); });
    $('exportGamaSelect').addEventListener('change', (e) => { currentGama = e.target.value; renderLevelSelect(); });
    $('btnDoExport').addEventListener('click', doExport);
    Store.on('rules:changed', ({ brandId, gama }) => {
      if (brandId === currentBrandId && gama === currentGama) renderLevelSelect();
    });
    Store.on('screen:changed', (screen) => { if (screen === 'export') renderBrandSelect(); });
  }

  function init() {
    $('exportTariffDate').value = new Date().toISOString().slice(0, 10);
    renderBrandSelect();
    setupListeners();
  }

  return { init };
})();
