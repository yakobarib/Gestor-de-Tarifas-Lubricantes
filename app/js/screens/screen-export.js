/* ============================================================================
   PANTALLA: EXPORTACIÓN
   ============================================================================
   Elegir marca + gama + tipo de exportación y exportar. "Tipo de exportación"
   es una lista plana que mezcla los niveles configurados en REGLAS (PVP,
   Bidones y Cubas Neto, Netos Bonus… formato Skrit de 9 columnas, solo los que
   tengan `goesToSkrit: true`) con los listados simples sin margen (Neto
   Factura, Neto-Neto) — antes eran dos selectores separados ("Tipo" + "Nivel
   de precio"), confuso porque escondía los niveles reales dentro de un select
   secundario. Gama admite "Todas" (por defecto, es lo más habitual) además de
   cada gama suelta — para niveles, se resuelve fila a fila según la gama real
   de cada fila, porque cada gama puede tener ese mismo nivel configurado con
   un margen distinto.
*/
const ScreenExport = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = '';
  let currentGama = 'default';
  let currentOption = ''; // 'level:<id>' | 'list:neto_factura' | 'list:neto_neto'

  // "Neto Factura" / "Neto-Neto" son listados simples (sin cálculo de margen, ver
  // conversación con Yako 2026-07-31) — no usan `priceLevels`, solo el coste tal cual.
  const PRICE_LIST_TYPES = {
    neto_factura: { costField: 'costFactura', label: 'Neto Factura' },
    neto_neto: { costField: 'costNetoNeto', label: 'Neto-Neto' }
  };

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

  /** gama -> niveles, para el export "Todas" (cada gama puede tener distinta config). */
  function loadLevelsByGama(brandId, gamas) {
    const map = {};
    for (const g of gamas) map[g] = loadLevels(brandId, g);
    return map;
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
      const labels = { normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General', automocion: 'Automoción', industria: 'Industria', 'productos-de-mantenimiento': 'Productos de Mantenimiento', marinos: 'Marinos', grasas: 'Grasas', alimentarios: 'Alimentarios', 'v-ligero': 'V. Ligero', 'v-pesado': 'V. Pesado', agricola: 'Agrícola', transmision: 'Transmisión', hidraulicos: 'Hidráulicos', grasa: 'Grasa', moto: 'Moto', classic: 'Classic', marina: 'Marina', anticogelante: 'Anticongelante', aditivos: 'Aditivos', advance: 'Advance', 'air-tool': 'Air Tool', corena: 'Corena', diala: 'Diala', gadinia: 'Gadinia', gadus: 'Gadus', 'heat-transfer': 'Heat Transfer', helix: 'Helix', hydraulic: 'Hydraulic', morlina: 'Morlina', omala: 'Omala', ondina: 'Ondina', 'paper-mach': 'Paper Mach', refrigeration: 'Refrigeration', rimula: 'Rimula', sirius: 'Sirius', spirax: 'Spirax', tegula: 'Tegula', tellus: 'Tellus', tonna: 'Tonna', transmission: 'Transmission', turbo: 'Turbo', 'vacuum-pump': 'Vacuum Pump', other: 'Other', crb: 'CRB', edge: 'EDGE', gtx: 'GTX', 'gtx-5w': 'GTX 5W', magnatec: 'Magnatec', 'castrol-on': 'Castrol ON', transmax: 'Transmax', vecton: 'Vecton' };
      // "Todas" por defecto — es lo más habitual de exportar (pedido por Yako).
      sel.innerHTML = '<option value="__all__">Todas</option>'
        + brand.gamas.map(g => `<option value="${g}">${escapeHtml(labels[g] || g)}</option>`).join('');
      currentGama = '__all__';
      sel.value = currentGama;
    }
    renderExportOptions();
  }

  /** Lista plana única: un nivel de precio por opción (PVP, Bidones y Cubas Neto, Netos
   *  Bonus…, "de venta") más los listados fijos sin margen ("de compra"). Cuando la gama
   *  es "Todas" se listan los niveles que existan en AL MENOS una gama de la marca. */
  function renderExportOptions() {
    const sel = $('exportTypeSelect');
    if (!currentBrandId) {
      sel.innerHTML = '<option value="">Elige una marca primero</option>';
      currentOption = '';
      return;
    }
    const brand = findBrand(currentBrandId);
    let levels;
    if (currentGama === '__all__') {
      const byGama = loadLevelsByGama(currentBrandId, brand.gamas);
      const seen = new Map();
      for (const g of brand.gamas) {
        for (const l of byGama[g]) {
          if (l.goesToSkrit && !seen.has(l.id)) seen.set(l.id, l);
        }
      }
      levels = [...seen.values()];
    } else {
      levels = loadLevels(currentBrandId, currentGama).filter(l => l.goesToSkrit);
    }
    const levelOptions = levels.map(l => `<option value="level:${escapeHtml(l.id)}">${escapeHtml(l.label)} (Venta)</option>`);
    const listOptions = Object.entries(PRICE_LIST_TYPES).map(([key, spec]) => `<option value="list:${key}">${escapeHtml(spec.label)} (Compra)</option>`);
    sel.innerHTML = levelOptions.concat(listOptions).join('');
    currentOption = sel.value || '';
  }

  async function doExport() {
    const brand = findBrand(currentBrandId);
    if (!brand) { alert('Elige una marca antes de exportar.'); return; }
    if (!currentOption) { alert('Elige un tipo de exportación.'); return; }
    const gamaForFetch = currentGama === '__all__' ? null : currentGama;
    const rows = await MasterDB.getByBrand(currentBrandId, gamaForFetch);
    if (!rows.length) { alert('No hay tarifa importada para esta marca/gama en el maestro.'); return; }
    const tariffDate = $('exportTariffDate').value || new Date().toISOString().slice(0, 10);
    const [kind, key] = currentOption.split(':');

    if (kind === 'list') {
      const spec = PRICE_LIST_TYPES[key];
      const withCost = rows.filter(r => typeof r[spec.costField] === 'number' && isFinite(r[spec.costField]));
      if (!withCost.length) { alert(`Ninguna referencia de esta marca/gama tiene "${spec.label}" auditado todavía.`); return; }
      const fname = ExcelWriter.exportPriceList(rows, brand.abbr, spec.costField, spec.label, tariffDate);
      $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${withCost.length} filas).</small>`;
      return;
    }

    // kind === 'level' — en "Todas" cada gama puede tener ese nivel con un margen
    // distinto, así que se resuelve fila a fila según la gama real de cada fila.
    if (currentGama === '__all__') {
      const byGama = loadLevelsByGama(currentBrandId, brand.gamas);
      const resolver = (row) => (byGama[row.gama] || []).find(l => l.id === key);
      const anyLevel = brand.gamas.map(g => (byGama[g] || []).find(l => l.id === key)).find(Boolean);
      const fname = ExcelWriter.exportSkritV2(rows, brand.abbr, resolver, tariffDate, key);
      $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${rows.length} filas, nivel "${escapeHtml(anyLevel ? anyLevel.label : key)}", todas las gamas).</small>`;
      return;
    }
    const level = loadLevels(currentBrandId, currentGama).find(l => l.id === key);
    if (!level) { alert('Ese nivel ya no existe para esta marca/gama.'); return; }
    const fname = ExcelWriter.exportSkritV2(rows, brand.abbr, level, tariffDate);
    $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${rows.length} filas, nivel "${escapeHtml(level.label)}").</small>`;
  }

  function setupListeners() {
    $('exportBrandSelect').addEventListener('change', (e) => { currentBrandId = e.target.value; renderGamaSelect(); });
    $('exportGamaSelect').addEventListener('change', (e) => { currentGama = e.target.value; renderExportOptions(); });
    $('exportTypeSelect').addEventListener('change', (e) => { currentOption = e.target.value; });
    $('btnDoExport').addEventListener('click', doExport);
    Store.on('rules:changed', ({ brandId }) => { if (brandId === currentBrandId) renderExportOptions(); });
    Store.on('screen:changed', (screen) => { if (screen === 'export') renderBrandSelect(); });
  }

  function init() {
    $('exportTariffDate').value = new Date().toISOString().slice(0, 10);
    renderBrandSelect();
    setupListeners();
  }

  return { init };
})();
