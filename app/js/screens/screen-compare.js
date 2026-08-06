/* ============================================================================
   PANTALLA: COMPARACIÓN
   ============================================================================
   Carga (una vez, se cachea) los 5 Excel de equivalencias de
   BASE DE CONOCIMIENTO/ y permite, dada una ref importada de una marca,
   encontrar su grupo de equivalencia y comparar coste(s) y PVP(s) calculados
   de cada marca miembro que ya tenga tarifa en el maestro. Dos formas de
   buscar: una casilla libre (acepta la ref con o sin el prefijo de marca,
   ej. "ADP32005" o "32005") que la busca en TODO el maestro, o el cascada
   Marca/Gama/Referencia de siempre. Reacciona en vivo a cambios de márgenes
   en la pantalla REGLAS vía Store. Ver ADR 0024.
*/
const ScreenCompare = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = null;
  let currentGama = 'default';
  let currentRef = null;
  let lastShown = null; // { brand, gama, ref } — para refrescar en vivo con Store.on('rules:changed')

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatEur(v) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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

  /** Todos los niveles que van a Skrit (PVP, Bidones y Cubas Neto, Netos Bonus…) — antes
   *  solo se mostraba "pvp"; ahora se comparan todos los que esa marca/gama tenga
   *  configurados, con su propia etiqueta. */
  function loadLevelsFor(brandId, gama) {
    const cfg = Storage.get(configKeyFor(brandId, gama));
    const raw = (cfg && cfg.priceLevels && cfg.priceLevels.length)
      ? cfg.priceLevels
      : [Migration.synthesizePvpLevel(cfg || { defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualPvp: {} })];
    return raw.filter(l => l.goesToSkrit).map(forMaster);
  }

  /** Todas las entradas de EQUIV_BRAND_ALIASES para un brandId, con su gama declarada. Un
   *  brandId puede tener más de una (AD Parts: "AD PARTS" para Normal, "AD STANDARD" para
   *  Standard — el resto solo tiene una, la gama declarada ahí es orientativa, no una
   *  restricción real: los ficheros de equivalencias no distinguen gama salvo para AD Parts). */
  function brandKeysFor(brandId) {
    return Object.entries(EQUIV_BRAND_ALIASES)
      .filter(([, idKey]) => idKey.split(':')[0] === brandId)
      .map(([brandKey, idKey]) => ({ brandKey, declaredGama: idKey.split(':')[1] }));
  }
  function brandKeyForRow(brandId, gama) {
    const candidates = brandKeysFor(brandId);
    if (!candidates.length) return null;
    const exact = candidates.find(c => c.declaredGama === gama);
    return (exact || candidates[0]).brandKey;
  }

  /** Busca una ref en TODO el maestro (todas las marcas, todas las gamas) — primero tal
   *  cual (sirve para marcas sin prefijo, o si ya se escribió con prefijo), luego probando
   *  el prefijo de cada marca que tenga uno (AD Parts, Castrol) por si se escribió la ref
   *  "pelada" (ej. "32005" en vez de "ADP32005"). */
  async function resolveRefAcrossBrands(typed) {
    const clean = typed.trim();
    if (!clean) return null;
    const upper = clean.toUpperCase();
    const brands = BRANDS.filter(b => !b.pending);
    for (const b of brands) {
      const rows = await MasterDB.getByBrand(b.id, null);
      const hit = rows.find(r => r.ref.toUpperCase() === upper);
      if (hit) return { brand: b, row: hit };
    }
    for (const b of brands) {
      if (!b.refPrefix) continue;
      const candidate = (b.refPrefix + clean).toUpperCase();
      const rows = await MasterDB.getByBrand(b.id, null);
      const hit = rows.find(r => r.ref.toUpperCase() === candidate);
      if (hit) return { brand: b, row: hit };
    }
    return null;
  }

  /** Busca la fila de un miembro del grupo en TODAS las gamas de su marca — el alias de
   *  EQUIV_BRAND_ALIASES declara una gama "representativa", pero casi ninguna marca
   *  distingue de verdad por gama en los ficheros de equivalencias (solo AD Parts) — sin
   *  este fallback, un miembro real se reportaba "sin tarifa importada" solo porque su
   *  ref vivía en otra gama de la misma marca. */
  async function findMemberRow(mBrandId, declaredGama, prefixedRef) {
    const direct = await MasterDB.getByRef(mBrandId, declaredGama, prefixedRef);
    if (direct) return direct;
    const all = await MasterDB.getByBrand(mBrandId, null);
    return all.find(r => r.ref === prefixedRef) || null;
  }

  function costChipsHtml(row) {
    const chips = [];
    if (row.costFactura != null) chips.push(`<span class="chip">Factura: ${formatEur(row.costFactura)}</span>`);
    if (row.costNetoNeto != null) chips.push(`<span class="chip">Neto-Neto: ${formatEur(row.costNetoNeto)}</span>`);
    if (row.costTripleNeto != null) chips.push(`<span class="chip">Triple Neto: ${formatEur(row.costTripleNeto)}</span>`);
    return chips.join('') || '<span class="muted">sin coste auditado</span>';
  }

  function memberRowHtml(brandLabel, ref, bodyHtml) {
    return `
      <div class="compare-member">
        <div class="compare-member-head"><strong>${escapeHtml(brandLabel)}</strong>${ref ? `<span class="muted">${escapeHtml(ref)}</span>` : ''}</div>
        ${bodyHtml}
      </div>
    `;
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
      const labels = { normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General', automocion: 'Automoción', industria: 'Industria', 'productos-de-mantenimiento': 'Productos de Mantenimiento', marinos: 'Marinos', grasas: 'Grasas', alimentarios: 'Alimentarios', 'v-ligero': 'V. Ligero', 'v-pesado': 'V. Pesado', agricola: 'Agrícola', transmision: 'Transmisión', hidraulicos: 'Hidráulicos', grasa: 'Grasa', moto: 'Moto', classic: 'Classic', marina: 'Marina', anticogelante: 'Anticongelante', aditivos: 'Aditivos', advance: 'Advance', 'air-tool': 'Air Tool', corena: 'Corena', diala: 'Diala', gadinia: 'Gadinia', gadus: 'Gadus', 'heat-transfer': 'Heat Transfer', helix: 'Helix', hydraulic: 'Hydraulic', morlina: 'Morlina', omala: 'Omala', ondina: 'Ondina', 'paper-mach': 'Paper Mach', refrigeration: 'Refrigeration', rimula: 'Rimula', sirius: 'Sirius', spirax: 'Spirax', tegula: 'Tegula', tellus: 'Tellus', tonna: 'Tonna', transmission: 'Transmission', turbo: 'Turbo', 'vacuum-pump': 'Vacuum Pump', other: 'Other', crb: 'CRB', edge: 'EDGE', gtx: 'GTX', 'gtx-5w': 'GTX 5W', magnatec: 'Magnatec', 'castrol-on': 'Castrol ON', transmax: 'Transmax', vecton: 'Vecton' };
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
        $('compareResult').innerHTML = '';
        return;
      }
      sel.innerHTML = '<option value="">Elige una referencia…</option>'
        + rows.map(r => `<option value="${escapeHtml(r.ref)}">${escapeHtml(r.ref)} — ${escapeHtml(r.description || '')}</option>`).join('');
    } catch (e) {
      sel.innerHTML = '<option value="">Error leyendo el maestro</option>';
      console.error(e);
    }
  }

  /** Núcleo de la comparación — usado tanto por la casilla libre como por el cascada de
   *  selects, para que ambas formas de buscar den exactamente el mismo resultado. */
  async function renderGroupFor(brand, gama, ref) {
    lastShown = { brand, gama, ref };
    const el = $('compareResult');
    if (!EquivalenceIndex.isLoaded()) {
      el.innerHTML = '<p class="muted">Carga primero la base de conocimiento de equivalencias.</p>';
      return;
    }
    const brandKey = brandKeyForRow(brand.id, gama);
    if (!brandKey) {
      el.innerHTML = `<p class="muted">Esta marca todavía no está mapeada en los ficheros de equivalencias (ver EQUIV_BRAND_ALIASES).</p>`;
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
      if (m.note === 'otros_formatos') {
        rowsHtml.push(memberRowHtml(m.brandKey, null, '<span class="no-tarifa">en otros formatos</span>'));
        continue;
      }
      const memberIdKey = EQUIV_BRAND_ALIASES[(m.brandKey || '').toUpperCase()];
      if (!memberIdKey) {
        rowsHtml.push(memberRowHtml(m.brandKey, null, '<span class="no-tarifa">marca no mapeada</span>'));
        continue;
      }
      const [mBrandId, mGama] = memberIdKey.split(':');
      const mBrand = findBrand(mBrandId);
      const prefixedRef = (mBrand ? mBrand.refPrefix : '') + m.ref;
      const masterRow = await findMemberRow(mBrandId, mGama, prefixedRef);
      if (!masterRow) {
        rowsHtml.push(memberRowHtml(mBrand ? mBrand.label : mBrandId, prefixedRef, '<span class="no-tarifa">sin tarifa importada</span>'));
        continue;
      }
      const levels = loadLevelsFor(mBrandId, masterRow.gama);
      const pvpsHtml = levels.length
        ? levels.map(l => {
            const c = Pricing.compute(masterRow, l);
            return c.pvp != null ? `<span class="chip pvp">${escapeHtml(l.label)}: <strong>${formatEur(c.pvp)}</strong></span>` : '';
          }).join('')
        : '<span class="muted">sin niveles configurados</span>';
      rowsHtml.push(memberRowHtml(mBrand ? mBrand.label : mBrandId, prefixedRef, `
        <div>${escapeHtml(masterRow.description || '')}</div>
        <div class="compare-member-costs">${costChipsHtml(masterRow)}</div>
        <div class="compare-member-pvps">${pvpsHtml}</div>
      `));
    }

    el.innerHTML = `<h4>Equivalencias de ${escapeHtml(ref)}</h4>${rowsHtml.join('')}`;
  }

  async function handleFreeSearch() {
    const input = $('compareRefInput');
    const typed = input.value;
    if (!typed.trim()) return;
    $('compareResult').innerHTML = '<p class="muted">Buscando…</p>';
    const found = await resolveRefAcrossBrands(typed);
    if (!found) {
      $('compareResult').innerHTML = `<p class="muted">No se ha encontrado ninguna referencia <strong>${escapeHtml(typed)}</strong> importada en el maestro (probado tal cual y con el prefijo de cada marca).</p>`;
      return;
    }
    await renderGroupFor(found.brand, found.row.gama, found.row.ref);
  }

  function setupListeners() {
    $('btnLoadKb').addEventListener('click', () => $('kbFileInput').click());
    $('kbFileInput').addEventListener('change', (e) => handleKbFiles(e.target.files));
    $('btnCompareSearch').addEventListener('click', handleFreeSearch);
    $('compareRefInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFreeSearch(); } });
    $('compareBrandSelect').addEventListener('change', (e) => { currentBrandId = e.target.value; renderGamaSelect(); });
    $('compareGamaSelect').addEventListener('change', (e) => { currentGama = e.target.value; renderRefOptions(); });
    $('compareRefSelect').addEventListener('change', (e) => {
      currentRef = e.target.value || null;
      if (currentRef) renderGroupFor(findBrand(currentBrandId), currentGama, currentRef);
      else $('compareResult').innerHTML = '';
    });
    Store.on('rules:changed', () => { if (lastShown) renderGroupFor(lastShown.brand, lastShown.gama, lastShown.ref); });
    Store.on('screen:changed', (screen) => { if (screen === 'compare') { renderKbStatus(); renderBrandSelect(); } });
  }

  function init() {
    renderKbStatus();
    renderBrandSelect();
    setupListeners();
  }

  return { init };
})();
