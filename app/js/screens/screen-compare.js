/* ============================================================================
   PANTALLA: COMPARACIÓN
   ============================================================================
   Carga (una vez, se cachea) los 5 Excel de equivalencias de
   BASE DE CONOCIMIENTO/ y permite, dada una ref importada de una marca,
   encontrar su grupo de equivalencia y comparar coste(s) y PVP(s) calculados
   de cada marca miembro que ya tenga tarifa en el maestro. Dos formas de
   buscar: una casilla libre (busca la ref tal cual, sin prefijo de marca —
   ver ADR 0056) en TODO el maestro, o el cascada Marca/Gama/Referencia de
   siempre. Reacciona en vivo a cambios de márgenes en la pantalla REGLAS vía
   Store. Ver ADR 0024.

   Segundo modo, "Ranking completo" (ver ADR 0083): en vez de una equivalencia
   a la vez, recorre TODOS los grupos de `EquivalenceIndex` y pinta una tabla
   con una fila por producto y una columna por marca (PVP + coste de factura),
   resaltando el más barato/caro de cada fila. Solo 5 marcas (ADP, Repsol,
   Castrol, Eni Live, Shell) — Racing Oil queda fuera a petición de Yako.
*/
const ScreenCompare = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = null;
  let currentGama = 'default';
  let currentRef = null;
  let lastShown = null; // { brand, gama, ref } — para refrescar en vivo con Store.on('rules:changed')

  let compareMode = 'individual';
  let rankingRows = null; // null = aún no calculado en esta visita a la pantalla
  let rankingFilter = { text: '', category: '' };

  const RANK_BRAND_COLUMNS = [
    { id: 'ad_parts_aceite', label: 'AD Parts' },
    { id: 'repsol', label: 'Repsol' },
    { id: 'castrol', label: 'Castrol' },
    { id: 'eni', label: 'Eni Live' },
    { id: 'shell', label: 'Shell' }
  ];
  const RANK_CATEGORY_LABELS = {
    aceites: 'Motor Ligero', grasas: 'Grasas', hidraulicos: 'Hidráulicos',
    motor_industrial: 'Motor Industrial', transmision_ejes: 'Transmisión y Ejes',
    desconocida: 'Otros'
  };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatEur(v) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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
    const cfg = RulesStore.load(brandId, gama);
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

  /** AD Parts tiene DOS alias por gama (ej. normal → "AD PARTS" en el fichero de Aceites,
   *  "ADP" en los 4 ficheros "block") — `brandKeyForRow` solo probaba uno (el primero
   *  declarado), así que buscar desde el lado de AD Parts un producto de Grasas/
   *  Hidráulicos/Motor VI/Transmisión no encontraba nada aunque el grupo existiera. Se
   *  prueban TODOS los alias de esa marca/gama (la gama exacta primero) hasta que uno
   *  encuentre grupo. */
  function findEquivalentsForRow(brandId, gama, ref) {
    const candidates = brandKeysFor(brandId);
    const ordered = [...candidates].sort((a, b) => (a.declaredGama === gama ? 0 : 1) - (b.declaredGama === gama ? 0 : 1));
    for (const c of ordered) {
      const group = EquivalenceIndex.findEquivalents(c.brandKey, ref);
      if (group) return group;
    }
    return null;
  }

  /** Busca una ref en TODO el maestro (todas las marcas, todas las gamas) — ninguna marca
   *  lleva prefijo interno (ver ADR 0056), así que basta con comparar tal cual. */
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

  /** El fichero "spec" (aceites) no trae descripción por marca, solo columnas de spec
   *  técnica compartidas (VISCO/ACEA/ILSAC/LITROS, ver EquivalenceReader) — cuando ninguna
   *  marca del ranking tiene esa ref en el maestro, es la única pista real que queda para
   *  titular la fila con algo mejor que "categoría — ref". "SIN ACEA"/"SIN ILSAC" se
   *  descarta (no aporta nada, es la forma de marcar "no aplica" en el Excel). */
  function specLabelFor(specs) {
    if (!specs) return null;
    const visco = specs.VISCO || specs.SAE || null;
    const grade = [...new Set([specs.ACEA, specs.ILSAC, specs.API, specs.NLGI, specs.DIN].filter(v => v && !/^SIN\b/i.test(String(v))))].join(' / ');
    const size = specs.LITROS != null ? `${specs.LITROS} L` : (specs.KG != null ? `${specs.KG} kg` : null);
    const parts = [visco, grade || null, size].filter(Boolean);
    return parts.length ? parts.join(' ') : null;
  }

  /** A qué columna del ranking corresponde un brandKey de los ficheros de equivalencias
   *  (ej. "AD STANDARD" → misma columna que "AD PARTS") — -1 si es una marca que no
   *  entra en el ranking (Racing Oil, o una marca sin mapear). */
  function rankColumnIndexForBrandKey(brandKey) {
    const idKey = EQUIV_BRAND_ALIASES[(brandKey || '').toUpperCase()];
    if (!idKey) return -1;
    const brandId = idKey.split(':')[0];
    return RANK_BRAND_COLUMNS.findIndex(c => c.id === brandId);
  }

  /** Recorre TODOS los grupos de equivalencia y calcula, por marca del ranking, el PVP y
   *  el coste de factura — una sola pasada por marca (`MasterDB.getByBrand` + `Map` por
   *  ref) en vez de repetir el escaneo completo por cada miembro de cada grupo, que es
   *  lo que hace `findMemberRow` (pensado para una comparación a la vez, no para cientos
   *  de grupos de golpe). */
  async function buildRankingRows() {
    if (!EquivalenceIndex.isLoaded()) return null;
    const { groups } = EquivalenceIndex.load();

    const rowsByBrand = {};
    for (const col of RANK_BRAND_COLUMNS) {
      const all = await MasterDB.getByBrand(col.id, null);
      const map = new Map();
      for (const r of all) map.set(String(r.ref).toUpperCase(), r);
      rowsByBrand[col.id] = map;
    }

    const levelCache = {}; // `${brandId}:${gama}` → nivel PVP (o null si esa gama no tiene)
    function pvpLevelFor(brandId, gama) {
      const key = `${brandId}:${gama}`;
      if (key in levelCache) return levelCache[key];
      const level = loadLevelsFor(brandId, gama).find(l => l.id === 'pvp') || null;
      levelCache[key] = level;
      return level;
    }

    const rows = [];
    for (const group of groups) {
      const cols = RANK_BRAND_COLUMNS.map(() => ({ state: 'sin_equivalencia' }));
      for (const m of group.members) {
        const colIdx = rankColumnIndexForBrandKey(m.brandKey);
        if (colIdx < 0 || cols[colIdx].state !== 'sin_equivalencia') continue; // fuera del ranking, o columna ya resuelta
        if (m.note === 'otros_formatos') { cols[colIdx] = { state: 'otros_formatos', description: m.description || null }; continue; }
        const brandId = RANK_BRAND_COLUMNS[colIdx].id;
        const row = rowsByBrand[brandId].get(String(m.ref).toUpperCase());
        // El fichero "block" (Grasas/Hidráulicos/Motor VI/Transmisión, ver EquivalenceReader)
        // trae su propia descripción por miembro — se conserva aquí en TODOS los estados,
        // no solo "ok", para poder titular la fila aunque ninguna marca tenga tarifa
        // importada todavía (antes solo se miraba `row.description`, y una fila sin
        // ninguna marca resuelta salía con "categoría — ref" en vez del producto real).
        if (!row) { cols[colIdx] = { state: 'sin_tarifa', ref: m.ref, description: m.description || null }; continue; }
        const level = pvpLevelFor(brandId, row.gama);
        const computed = level ? Pricing.compute(row, level) : null;
        if (!computed || computed.pvp == null) { cols[colIdx] = { state: 'sin_nivel', ref: m.ref, description: row.description || m.description || null }; continue; }
        cols[colIdx] = { state: 'ok', ref: m.ref, description: row.description || m.description || null, pvp: computed.pvp, costFactura: row.costFactura };
      }

      const anyMatched = cols.some(c => c.state !== 'sin_equivalencia');
      if (!anyMatched) continue; // grupo solo con marcas fuera del ranking (ej. únicamente Racing Oil)

      const withData = cols.filter(c => c.state === 'ok');
      let cheapestIdx = -1, priciestIdx = -1;
      if (withData.length >= 2) {
        let min = Infinity, max = -Infinity;
        cols.forEach((c, i) => {
          if (c.state !== 'ok') return;
          if (c.pvp < min) { min = c.pvp; cheapestIdx = i; }
          if (c.pvp > max) { max = c.pvp; priciestIdx = i; }
        });
        if (cheapestIdx === priciestIdx) { cheapestIdx = -1; priciestIdx = -1; } // todos iguales, nada que resaltar
      }

      let description = cols.map(c => c.description).find(Boolean) || null;
      if (!description) {
        const specLabel = specLabelFor(group.specs);
        const anyRef = cols.map(c => c.ref).find(Boolean);
        if (specLabel && anyRef) description = `${specLabel} (${anyRef})`;
        else if (specLabel) description = specLabel;
        else if (anyRef) description = `${RANK_CATEGORY_LABELS[group.category] || group.category} — ${anyRef}`;
        else description = RANK_CATEGORY_LABELS[group.category] || group.category;
      }
      rows.push({ groupId: group.groupId, category: group.category, description, cols, cheapestIdx, priciestIdx });
    }
    return rows;
  }

  function rankingRowMatchesFilter(row) {
    if (rankingFilter.category && row.category !== rankingFilter.category) return false;
    if (!rankingFilter.text) return true;
    const needle = rankingFilter.text.toLowerCase();
    if (row.description && row.description.toLowerCase().includes(needle)) return true;
    return row.cols.some(c => c.ref && String(c.ref).toLowerCase().includes(needle));
  }

  function rankingCellHtml(cell, cls) {
    if (cell.state === 'ok') {
      return `<td class="ranking-cell ${cls}"><div class="pvp">${formatEur(cell.pvp)}</div><div class="cost muted">${formatEur(cell.costFactura)}</div></td>`;
    }
    if (cell.state === 'otros_formatos') return `<td class="ranking-cell"><span class="no-tarifa" title="Esta marca tiene el producto, pero no en este tamaño">otro formato</span></td>`;
    if (cell.state === 'sin_tarifa') return `<td class="ranking-cell"><span class="no-tarifa" title="Ref ${escapeHtml(cell.ref)} sin tarifa importada">sin tarifa</span></td>`;
    if (cell.state === 'sin_nivel') return `<td class="ranking-cell"><span class="no-tarifa" title="Sin nivel PVP configurado en Reglas">sin PVP</span></td>`;
    return `<td class="ranking-cell"><span class="muted">—</span></td>`;
  }

  function renderRankingCategorySelect(rows) {
    const sel = $('compareRankingCategory');
    const cats = [...new Set(rows.map(r => r.category))];
    const keep = cats.includes(rankingFilter.category) ? rankingFilter.category : '';
    sel.innerHTML = '<option value="">Todas las categorías</option>'
      + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(RANK_CATEGORY_LABELS[c] || c)}</option>`).join('');
    sel.value = keep;
    rankingFilter.category = keep;
  }

  function renderRankingTable() {
    if (!rankingRows) return;
    const visible = rankingRows.filter(rankingRowMatchesFilter);
    $('compareRankingBody').innerHTML = visible.map(row => `
      <tr>
        <td class="prod" title="${escapeHtml(row.description || '')}">${escapeHtml(row.description || '(sin descripción)')}</td>
        ${row.cols.map((c, i) => rankingCellHtml(c, i === row.cheapestIdx ? 'cheapest' : i === row.priciestIdx ? 'priciest' : '')).join('')}
      </tr>
    `).join('');
    $('compareRankingCount').textContent = `Mostrando ${visible.length} de ${rankingRows.length} productos`;
  }

  async function renderRankingView(forceRebuild) {
    if (!EquivalenceIndex.isLoaded()) {
      $('compareRankingBody').innerHTML = '<tr><td colspan="6" class="muted">Carga primero los Excel de cruces de referencias entre marcas, desde Importación.</td></tr>';
      $('compareRankingCount').textContent = '';
      return;
    }
    if (!rankingRows || forceRebuild) {
      $('compareRankingCount').textContent = 'Calculando…';
      rankingRows = await buildRankingRows();
      renderRankingCategorySelect(rankingRows || []);
    }
    renderRankingTable();
  }

  function setCompareMode(mode) {
    compareMode = mode;
    document.querySelectorAll('.mode-btn[data-compare-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.compareMode === mode);
    });
    $('compareIndividualView').classList.toggle('hidden', mode !== 'individual');
    $('compareRankingView').classList.toggle('hidden', mode !== 'ranking');
    if (mode === 'ranking') renderRankingView();
  }

  function renderBrandSelect() {
    const sel = $('compareBrandSelect');
    sel.innerHTML = '<option value="">Ninguna</option>'
      + BRANDS.filter(b => !b.pending).map(b => `<option value="${b.id}">${escapeHtml(b.label)}</option>`).join('');
    sel.value = currentBrandId || '';
    renderGamaSelect();
  }

  function renderGamaSelect() {
    const brand = findBrand(currentBrandId);
    const sel = $('compareGamaSelect');
    // Sin marca elegida ("Ninguna"): ni gama ni referencia tienen sentido todavía.
    if (!currentBrandId) {
      sel.innerHTML = `<option value="">—</option>`;
      sel.disabled = true;
      $('compareRefSelect').innerHTML = '<option value="">Elige una marca primero</option>';
      $('compareRefSelect').disabled = true;
      return;
    }
    $('compareRefSelect').disabled = false;
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
        + rows.map(r => `<option value="${escapeHtml(r.ref)}">${escapeHtml(r.ref)} — ${escapeHtml(r.description || '')} (${escapeHtml(Parser.formatLabel(r.liters))})</option>`).join('');
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
      el.innerHTML = '<p class="muted">Carga primero los Excel de cruces de referencias entre marcas, desde Importación.</p>';
      return;
    }
    const brandKey = brandKeyForRow(brand.id, gama);
    if (!brandKey) {
      el.innerHTML = `<p class="muted">Esta marca todavía no está mapeada en los ficheros de equivalencias (ver EQUIV_BRAND_ALIASES).</p>`;
      return;
    }
    const group = findEquivalentsForRow(brand.id, gama, ref);
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
      const prefixedRef = m.ref;
      const masterRow = await findMemberRow(mBrandId, mGama, prefixedRef);
      if (!masterRow) {
        rowsHtml.push(memberRowHtml(mBrand ? mBrand.label : mBrandId, prefixedRef, '<span class="no-tarifa">sin tarifa importada</span>'));
        continue;
      }
      const levels = loadLevelsFor(mBrandId, masterRow.gama);
      const computed = levels.map(l => ({ level: l, c: Pricing.compute(masterRow, l) })).filter(x => x.c.pvp != null);
      const pvpsHtml = computed.length
        ? computed.map(({ level, c }) => `<span class="chip pvp">${escapeHtml(level.label)}: <strong>${formatEur(c.pvp)}</strong></span>`).join('')
        : '<span class="muted">sin niveles configurados</span>';
      // Beneficio en € según la regla vigente en Reglas para esa marca/gama (ver ADR
      // 0066) — mismo `gain` que ya calcula Pricing.compute, no un cálculo aparte.
      const gainsHtml = computed.length
        ? computed.map(({ level, c }) => `<span class="chip gain">${escapeHtml(level.label)} beneficio: <strong>${formatEur(c.gain)}</strong></span>`).join('')
        : '';
      rowsHtml.push(memberRowHtml(mBrand ? mBrand.label : mBrandId, prefixedRef, `
        <div>${escapeHtml(masterRow.description || '')}</div>
        <div class="compare-member-costs">${costChipsHtml(masterRow)}</div>
        <div class="compare-member-pvps">${pvpsHtml}</div>
        ${gainsHtml ? `<div class="compare-member-gains">${gainsHtml}</div>` : ''}
      `));
    }

    el.innerHTML = `<h4>Equivalencias de ${escapeHtml(ref)}</h4><div class="compare-members-grid">${rowsHtml.join('')}</div>`;
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
    $('btnCompareSearch').addEventListener('click', handleFreeSearch);
    $('compareRefInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFreeSearch(); } });
    $('compareBrandSelect').addEventListener('change', (e) => { currentBrandId = e.target.value; renderGamaSelect(); });
    $('compareGamaSelect').addEventListener('change', (e) => { currentGama = e.target.value; renderRefOptions(); });
    $('compareRefSelect').addEventListener('change', (e) => {
      currentRef = e.target.value || null;
      if (currentRef) renderGroupFor(findBrand(currentBrandId), currentGama, currentRef);
      else $('compareResult').innerHTML = '';
    });
    document.querySelectorAll('.mode-btn[data-compare-mode]').forEach(b => {
      b.addEventListener('click', () => setCompareMode(b.dataset.compareMode));
    });
    $('compareRankingSearch').addEventListener('input', (e) => { rankingFilter.text = e.target.value.trim(); renderRankingTable(); });
    $('compareRankingCategory').addEventListener('change', (e) => { rankingFilter.category = e.target.value; renderRankingTable(); });
    Store.on('rules:changed', () => {
      if (lastShown) renderGroupFor(lastShown.brand, lastShown.gama, lastShown.ref);
      if (compareMode === 'ranking') renderRankingView(true);
    });
    // Reinicio completo al volver a Comparación (pedido por Yako): antes la marca
    // sobrevivía entre visitas pero gama/referencia se reseteaban y las tarjetas de la
    // búsqueda anterior se quedaban en pantalla — daba la impresión de que ese resultado
    // correspondía a los selects recién reseteados, cuando en realidad era de la
    // búsqueda de antes. Mejor pedir marca/gama/ref cada vez que dejar un estado a
    // medias que no coincide con lo que se ve.
    Store.on('screen:changed', (screen) => {
      if (screen !== 'compare') return;
      currentBrandId = null;
      currentGama = 'default';
      currentRef = null;
      lastShown = null;
      $('compareRefInput').value = '';
      $('compareResult').innerHTML = '';
      renderBrandSelect();
      // El ranking también se recalcula desde cero en cada visita — es una tabla
      // completa, no un filtro de sesión, y así nunca muestra datos de una maestro/
      // reglas que hayan cambiado mientras tanto en otra pestaña (mismo motivo que el
      // reinicio completo de arriba).
      rankingRows = null;
      rankingFilter = { text: '', category: '' };
      $('compareRankingSearch').value = '';
      setCompareMode('individual');
    });
  }

  function init() {
    renderBrandSelect();
    setupListeners();
  }

  return { init };
})();
