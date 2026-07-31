/* ============================================================================
   PANTALLA: COMPARACIÓN
   ============================================================================
   Carga (una vez, se cachea) los 5 Excel de equivalencias de
   BASE DE CONOCIMIENTO/ y permite, dada una ref importada de una marca,
   encontrar su grupo de equivalencia y comparar el precio calculado (nivel
   PVP) de cada marca miembro que ya tenga tarifa en el maestro. Reacciona en
   vivo a cambios de márgenes en la pantalla REGLAS vía Store.
*/
const ScreenCompare = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = null;
  let currentGama = 'default';
  let currentRef = null;
  let reverseAlias = null;

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatEur(v) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function buildReverseAlias() {
    reverseAlias = {};
    for (const [brandKey, idKey] of Object.entries(EQUIV_BRAND_ALIASES)) {
      reverseAlias[idKey] = brandKey;
    }
    return reverseAlias;
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

  function loadPvpLevel(brandId, gama) {
    const cfg = Storage.get(configKeyFor(brandId, gama));
    if (!cfg) return forMaster({ defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualOverride: {}, baseCost: 'factura' });
    if (cfg.priceLevels && cfg.priceLevels.length) {
      const pvp = cfg.priceLevels.find(l => l.id === 'pvp') || cfg.priceLevels[0];
      return forMaster(pvp);
    }
    return forMaster(Migration.synthesizePvpLevel(cfg));
  }

  function renderKbStatus() {
    const el = $('kbStatus');
    if (EquivalenceIndex.isLoaded()) {
      const idx = EquivalenceIndex.load();
      el.innerHTML = `<span class="status-ok">Base de conocimiento cargada: ${idx.groups.length} grupos (actualizada ${escapeHtml(idx.builtAt)}).</span>`;
    } else {
      el.innerHTML = `<span class="status-none">Base de conocimiento no cargada — carga los 5 Excel de equivalencias para poder comparar.</span>`;
    }
  }

  async function handleKbFiles(files) {
    if (!files || !files.length) return;
    $('kbStatus').innerHTML = '<small class="muted">Leyendo ficheros de equivalencias…</small>';
    const categories = [];
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      categories.push(EquivalenceReader.readKnownFile(file.name, workbook));
    }
    EquivalenceIndex.build(categories);
    renderKbStatus();
  }

  function renderBrandSelect() {
    const sel = $('compareBrandSelect');
    sel.innerHTML = BRANDS.filter(b => !b.pending).map(b => `<option value="${b.id}">${escapeHtml(b.label)}</option>`).join('');
    if (!currentBrandId) currentBrandId = sel.value;
    sel.value = currentBrandId;
    renderGamaSelect();
  }

  function renderGamaSelect() {
    const brand = findBrand(currentBrandId);
    const sel = $('compareGamaSelect');
    if (!brand || brand.gamas.length <= 1) {
      sel.innerHTML = `<option value="default">General</option>`;
      sel.disabled = true;
      currentGama = 'default';
    } else {
      sel.disabled = false;
      const labels = { normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General', automocion: 'Automoción', industria: 'Industria', 'productos-de-mantenimiento': 'Productos de Mantenimiento', marinos: 'Marinos', grasas: 'Grasas', alimentarios: 'Alimentarios', 'v-ligero': 'V. Ligero', 'v-pesado': 'V. Pesado', agricola: 'Agrícola', transmision: 'Transmisión', hidraulicos: 'Hidráulicos', grasa: 'Grasa', moto: 'Moto', classic: 'Classic', marina: 'Marina', anticogelante: 'Anticongelante', aditivos: 'Aditivos', advance: 'Advance', 'air-tool': 'Air Tool', corena: 'Corena', diala: 'Diala', gadinia: 'Gadinia', gadus: 'Gadus', 'heat-transfer': 'Heat Transfer', helix: 'Helix', hydraulic: 'Hydraulic', morlina: 'Morlina', omala: 'Omala', ondina: 'Ondina', 'paper-mach': 'Paper Mach', refrigeration: 'Refrigeration', rimula: 'Rimula', sirius: 'Sirius', spirax: 'Spirax', tegula: 'Tegula', tellus: 'Tellus', tonna: 'Tonna', transmission: 'Transmission', turbo: 'Turbo', 'vacuum-pump': 'Vacuum Pump' };
      sel.innerHTML = brand.gamas.map(g => `<option value="${g}">${escapeHtml(labels[g] || g)}</option>`).join('');
      currentGama = brand.gamas[0];
      sel.value = currentGama;
    }
    renderRefOptions();
  }

  async function renderRefOptions() {
    const sel = $('compareRefSelect');
    sel.innerHTML = '<option value="">Cargando…</option>';
    try {
      const rows = await MasterDB.getByBrand(currentBrandId, currentGama);
      if (!rows.length) {
        sel.innerHTML = '<option value="">Sin tarifa importada para esta marca/gama</option>';
        renderResult(null);
        return;
      }
      sel.innerHTML = '<option value="">Elige una referencia…</option>'
        + rows.map(r => `<option value="${escapeHtml(r.ref)}">${escapeHtml(r.ref)} — ${escapeHtml(r.description || '')}</option>`).join('');
    } catch (e) {
      sel.innerHTML = '<option value="">Error leyendo el maestro</option>';
      console.error(e);
    }
  }

  async function renderResult(ref) {
    currentRef = ref;
    const el = $('compareResult');
    if (!ref) { el.innerHTML = ''; return; }
    if (!EquivalenceIndex.isLoaded()) {
      el.innerHTML = '<p class="muted">Carga primero la base de conocimiento de equivalencias.</p>';
      return;
    }
    if (!reverseAlias) buildReverseAlias();
    const brand = findBrand(currentBrandId);
    const idKey = `${currentBrandId}:${currentGama}`;
    const brandKey = reverseAlias[idKey];
    if (!brandKey) {
      el.innerHTML = `<p class="muted">Esta marca/gama todavía no está mapeada en los ficheros de equivalencias (ver EQUIV_BRAND_ALIASES).</p>`;
      return;
    }
    const bareRef = brand.refPrefix && ref.startsWith(brand.refPrefix) ? ref.slice(brand.refPrefix.length) : ref;
    const group = EquivalenceIndex.findEquivalents(brandKey, bareRef);
    if (!group) {
      el.innerHTML = `<p class="muted">Sin equivalencia encontrada para <strong>${escapeHtml(ref)}</strong> en la base de conocimiento.</p>`;
      return;
    }

    const rowsHtml = [];
    for (const m of group.members) {
      const memberIdKey = EQUIV_BRAND_ALIASES[(m.brandKey || '').toUpperCase()];
      if (!memberIdKey) {
        rowsHtml.push(`<div class="compare-row"><div>${escapeHtml(m.brandKey)}</div><div class="no-tarifa">marca no mapeada</div><div></div><div></div></div>`);
        continue;
      }
      const [mBrandId, mGama] = memberIdKey.split(':');
      const mBrand = findBrand(mBrandId);
      const prefixedRef = (mBrand ? mBrand.refPrefix : '') + m.ref;
      const masterRow = await MasterDB.getByRef(mBrandId, mGama, prefixedRef);
      if (!masterRow) {
        rowsHtml.push(`<div class="compare-row"><div>${escapeHtml(mBrand ? mBrand.label : mBrandId)}</div><div>${escapeHtml(prefixedRef)}</div><div class="no-tarifa">sin tarifa importada</div><div></div></div>`);
        continue;
      }
      const level = loadPvpLevel(mBrandId, mGama);
      const c = Pricing.compute(masterRow, level);
      rowsHtml.push(`
        <div class="compare-row">
          <div>${escapeHtml(mBrand ? mBrand.label : mBrandId)}</div>
          <div>${escapeHtml(masterRow.description || prefixedRef)}</div>
          <div>${formatEur(masterRow.costFactura)}</div>
          <div><strong>${c.pvp != null ? formatEur(c.pvp) : '—'}</strong></div>
        </div>
      `);
    }

    el.innerHTML = `
      <h4>Equivalencias de ${escapeHtml(ref)}</h4>
      <div class="compare-row" style="font-weight:600; color: var(--pico-muted-color); font-size:0.8rem;">
        <div>MARCA</div><div>PRODUCTO</div><div>COSTE</div><div>PVP</div>
      </div>
      ${rowsHtml.join('')}
    `;
  }

  function setupListeners() {
    $('btnLoadKb').addEventListener('click', () => $('kbFileInput').click());
    $('kbFileInput').addEventListener('change', (e) => handleKbFiles(e.target.files));
    $('compareBrandSelect').addEventListener('change', (e) => { currentBrandId = e.target.value; renderGamaSelect(); });
    $('compareGamaSelect').addEventListener('change', (e) => { currentGama = e.target.value; renderRefOptions(); });
    $('compareRefSelect').addEventListener('change', (e) => renderResult(e.target.value || null));
    Store.on('rules:changed', () => { if (currentRef) renderResult(currentRef); });
    Store.on('screen:changed', (screen) => { if (screen === 'compare') { renderKbStatus(); renderBrandSelect(); } });
  }

  function init() {
    renderKbStatus();
    renderBrandSelect();
    setupListeners();
  }

  return { init };
})();
