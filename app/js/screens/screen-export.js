/* ============================================================================
   PANTALLA: EXPORTACIÓN
   ============================================================================
   Elegir marca + gama + tipo de exportación, revisar el listado final
   calculado (con las mismas reglas de REGLAS) en una tabla en pantalla, y
   exportar exactamente esas filas. "Tipo de exportación" es una lista plana
   que mezcla los dos niveles configurados en REGLAS (PVP, formato Skrit de
   9 columnas; Netos Bonus, mismo formato pero solo los formatos marcados
   "Salida impresa", ver ADR 0026 v2) con los listados simples sin margen
   (Neto Factura, Neto-Neto, Triple Neto, y "Valor Regalo 1+1" cuando algún
   formato de PVP tiene el modo "1+2" activado). Gama admite "Todas" (por
   defecto) además de cada gama suelta — para niveles, se resuelve fila a
   fila según la gama real de cada fila, porque cada gama puede tener ese
   mismo nivel configurado con un margen distinto (ver ADR 0021/0022).
*/
const ScreenExport = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = '';
  let currentGama = 'default';
  let currentOption = ''; // 'level:<id>' | 'list:neto_factura' | 'list:neto_neto'
  let rows = [];
  let filter = { text: '', format: '', status: '' };

  const GAMA_LABELS = { normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General', automocion: 'Automoción', industria: 'Industria', 'productos-de-mantenimiento': 'Productos de Mantenimiento', marinos: 'Marinos', grasas: 'Grasas', alimentarios: 'Alimentarios', 'v-ligero': 'V. Ligero', 'v-pesado': 'V. Pesado', agricola: 'Agrícola', transmision: 'Transmisión', hidraulicos: 'Hidráulicos', grasa: 'Grasa', moto: 'Moto', classic: 'Classic', marina: 'Marina', anticogelante: 'Anticongelante', aditivos: 'Aditivos', advance: 'Advance', 'air-tool': 'Air Tool', corena: 'Corena', diala: 'Diala', gadinia: 'Gadinia', gadus: 'Gadus', 'heat-transfer': 'Heat Transfer', helix: 'Helix', hydraulic: 'Hydraulic', morlina: 'Morlina', omala: 'Omala', ondina: 'Ondina', 'paper-mach': 'Paper Mach', refrigeration: 'Refrigeration', rimula: 'Rimula', sirius: 'Sirius', spirax: 'Spirax', tegula: 'Tegula', tellus: 'Tellus', tonna: 'Tonna', transmission: 'Transmission', turbo: 'Turbo', 'vacuum-pump': 'Vacuum Pump', other: 'Other', crb: 'CRB', edge: 'EDGE', gtx: 'GTX', 'gtx-5w': 'GTX 5W', magnatec: 'Magnatec', 'castrol-on': 'Castrol ON', transmax: 'Transmax', vecton: 'Vecton' };

  // "Neto Factura" / "Neto-Neto" son listados simples (sin cálculo de margen, ver
  // conversación con Yako 2026-07-31) — no usan `priceLevels`, solo el coste tal cual.
  const PRICE_LIST_TYPES = {
    neto_factura: { costField: 'costFactura', label: 'Neto Factura' },
    neto_neto: { costField: 'costNetoNeto', label: 'Neto-Neto' },
    triple_neto: { costField: 'costTripleNeto', label: 'Triple Neto' }
  };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatEur(v) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function configKeyFor(brandId, gama) {
    return gama === 'default' ? `config_${brandId}` : `config_${brandId}_${gama}`;
  }
  function historyIdentifierFor(brand, gama) {
    return gama === 'default' ? brand.label : `${brand.label} ${gama}`;
  }

  /** Las filas del maestro usan costFactura/costNetoNeto, no costPerPack (ver ADR 0008) —
   *  se remapea baseCostField a partir de baseCost antes de pasarlo a Pricing.compute. */
  function forMaster(level) {
    const baseCostField = level.baseCost === 'tripleNeto' ? 'costTripleNeto'
                        : level.baseCost === 'netoNeto' ? 'costNetoNeto'
                        : 'costFactura';
    return Object.assign({}, level, { baseCostField });
  }

  /** Nivel SIN remapear (mismo shape que persiste Reglas) — usar para leer/escribir el
   *  override manual; envolver con `forMaster()` antes de pasarlo a Pricing.compute. */
  function loadRawLevel(brandId, gama, levelId) {
    const key = configKeyFor(brandId, gama);
    let cfg = Storage.get(key);
    let isNew = false;
    if (!cfg) { cfg = { defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualPvp: {} }; isNew = true; }
    if (!cfg.priceLevels || !cfg.priceLevels.length) { cfg.priceLevels = [Migration.synthesizePvpLevel(cfg)]; isNew = true; }
    let level = cfg.priceLevels.find(l => l.id === levelId);
    if (!level && levelId === 'pvp') { level = Migration.synthesizePvpLevel(cfg); cfg.priceLevels.unshift(level); isNew = true; }
    if (isNew) Storage.set(key, cfg);
    return level ? { cfg, level, key } : null;
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

  /** El nivel "pvp" de esta marca/gama (siempre existe, ver ADR 0026 v2). */
  function pvpLevelFor(brandId, gama) {
    return loadLevels(brandId, gama).find(l => l.id === 'pvp') || null;
  }

  /** Valor en € del "regalo" de un 1+1: el coste (factura/neto-neto/triple neto, el que
   *  use el PVP de esa gama) de la caja que se regala — no la calculamos con
   *  Pricing.compute porque eso daría el PVP, no el coste, y el override manual de PVP
   *  no debe afectar a este valor. null si ese formato no tiene el modo "1+2" activado
   *  en PVP para esa gama (ver ADR 0026 v2). */
  function regaloValueFor(row, pvpLevel) {
    if (!pvpLevel) return null;
    if (!pvpLevel.formatModes || pvpLevel.formatModes[row.formatKey] !== '1x2') return null;
    const cost = Pricing.resolveCost(row, pvpLevel);
    return (typeof cost === 'number' && isFinite(cost)) ? cost : null;
  }

  function saveManualOverride(brandId, gama, levelId, ref, value) {
    const found = loadRawLevel(brandId, gama, levelId);
    if (!found) return;
    const { cfg, level, key } = found;
    if (!level.manualOverride) level.manualOverride = {};
    if (value == null) delete level.manualOverride[ref];
    else level.manualOverride[ref] = value;
    Storage.set(key, cfg);
    Store.emit('rules:changed', { brandId, gama });
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
      // "Todas" por defecto — es lo más habitual de exportar (pedido por Yako).
      sel.innerHTML = '<option value="__all__">Todas</option>'
        + brand.gamas.map(g => `<option value="${g}">${escapeHtml(GAMA_LABELS[g] || g)}</option>`).join('');
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
      renderPreview();
      return;
    }
    const brand = findBrand(currentBrandId);
    // "pvp" (va a Skrit) y "netos_bonus" (no va a Skrit, uso interno) siempre existen y
    // siempre se ofrecen los dos — a diferencia de antes, ya no hay niveles opcionales
    // que añadir/quitar (ver ADR 0026 v2).
    let levels, has1x2;
    if (currentGama === '__all__') {
      const byGama = loadLevelsByGama(currentBrandId, brand.gamas);
      const seen = new Map();
      for (const g of brand.gamas) {
        for (const l of byGama[g]) if (!seen.has(l.id)) seen.set(l.id, l);
      }
      levels = [...seen.values()];
      has1x2 = brand.gamas.some(g => {
        const pvp = (byGama[g] || []).find(l => l.id === 'pvp');
        return pvp && pvp.formatModes && Object.values(pvp.formatModes).includes('1x2');
      });
    } else {
      levels = loadLevels(currentBrandId, currentGama);
      const pvp = levels.find(l => l.id === 'pvp');
      has1x2 = !!(pvp && pvp.formatModes && Object.values(pvp.formatModes).includes('1x2'));
    }
    const levelOptions = levels.map(l => `<option value="level:${escapeHtml(l.id)}">${escapeHtml(l.label)}${l.goesToSkrit ? ' (Venta)' : ' (uso interno)'}</option>`);
    const listOptions = Object.entries(PRICE_LIST_TYPES).map(([key, spec]) => `<option value="list:${key}">${escapeHtml(spec.label)} (Compra)</option>`);
    // "Valor Regalo 1+1" solo se ofrece si algún formato de PVP tiene el modo "1+2"
    // activado en al menos una gama de esta marca (en "Todas") o en la gama elegida.
    if (has1x2) {
      listOptions.push('<option value="list:regalo_1x1">Valor Regalo 1+1 (Compra)</option>');
    }
    sel.innerHTML = levelOptions.concat(listOptions).join('');
    currentOption = sel.value || '';
    renderPreview();
  }

  /** Filas del maestro con `_status`/`_rebrandedFrom` ya anotados por History.diff — para
   *  "Todas" se concatena el diff de cada gama real (cada gama compara contra su propia
   *  tarifa vigente anterior, no existe una única "anterior" combinada). */
  async function loadRowsWithStatus(brand, gama) {
    if (gama === '__all__') {
      const chunks = await Promise.all(brand.gamas.map(g => loadRowsWithStatus(brand, g)));
      return chunks.flat();
    }
    const raw = await MasterDB.getByBrand(brand.id, gama);
    const withAlias = raw.map(r => Object.assign({}, r, { costPerPack: r.costFactura }));
    const previous = History.load(historyIdentifierFor(brand, gama));
    History.diff(withAlias, previous, RebrandMap.load(brand.id)); // anota _status in situ
    return withAlias;
  }

  function visibleRows() {
    const txt = filter.text.toLowerCase().trim();
    return rows.filter(r => {
      if (txt) {
        const hay = (r.ref + ' ' + r.description).toLowerCase();
        if (!hay.includes(txt)) return false;
      }
      if (filter.format && r.formatKey !== filter.format) return false;
      if (filter.status === 'new'    && r._status !== 'new')    return false;
      if (filter.status === 'stable' && r._status !== 'stable') return false;
      return true;
    });
  }

  function renderFormatFilter() {
    const sel = $('exportFormatFilter');
    const keys = [...new Set(rows.map(r => r.formatKey))].sort((a, b) => {
      if (a === '?') return 1; if (b === '?') return -1;
      return parseFloat(a) - parseFloat(b);
    });
    sel.innerHTML = '<option value="">Todos los formatos</option>'
      + keys.map(k => {
          const l = k === '?' ? null : parseFloat(k);
          return `<option value="${escapeHtml(k)}">${Parser.formatLabel(l)}</option>`;
        }).join('');
  }

  /** Carga las filas de la marca/gama/tipo elegidos y las deja listas en `rows` para
   *  pintar la tabla Y para exportar (WYSIWYG: se exporta exactamente lo que se ve aquí). */
  async function renderPreview() {
    const brand = findBrand(currentBrandId);
    const wrap = $('exportPreviewWrap');
    if (!brand || !currentOption) {
      rows = [];
      wrap.classList.add('hidden');
      $('exportPreviewEmpty').classList.remove('hidden');
      $('exportPreviewEmpty').textContent = !brand ? 'Elige una marca para ver el listado.' : 'Elige un tipo de exportación.';
      return;
    }
    rows = await loadRowsWithStatus(brand, currentGama);
    if (!rows.length) {
      wrap.classList.add('hidden');
      $('exportPreviewEmpty').classList.remove('hidden');
      $('exportPreviewEmpty').textContent = 'No hay tarifa importada para esta marca/gama en el maestro.';
      return;
    }
    $('exportPreviewEmpty').classList.add('hidden');
    wrap.classList.remove('hidden');
    renderFormatFilter();
    renderPreviewTable();
  }

  function renderPreviewTable() {
    const [kind, key] = currentOption.split(':');
    const brand = findBrand(currentBrandId);
    const thead = $('exportPreviewTable').querySelector('thead');
    const tbody = $('exportPreviewBody');
    let visible = visibleRows();
    $('exportTotalCount').textContent = rows.length;

    if (kind === 'list' && key === 'regalo_1x1') {
      thead.innerHTML = `<tr><th>Ref</th><th>Estado</th><th>Producto</th><th class="num liters">Litros</th><th class="num">Valor Regalo 1+1</th></tr>`;
      $('exportVisibleCount').textContent = visible.length;
      const levelCache = {};
      const levelFor = (gama) => (gama in levelCache) ? levelCache[gama] : (levelCache[gama] = pvpLevelFor(currentBrandId, gama));
      const frag = document.createDocumentFragment();
      for (const r of visible.slice(0, 500)) {
        const level = levelFor(currentGama === '__all__' ? r.gama : currentGama);
        const value = regaloValueFor(r, level);
        r._regaloValue = value; // se reutiliza tal cual al exportar (WYSIWYG)
        const tr = document.createElement('tr');
        let statusChip = '';
        if (r._status === 'new') statusChip = '<span class="status-chip new">NUEVA</span>';
        else if (r._rebrandedFrom) statusChip = `<span class="status-chip stable" title="Antes: ${escapeHtml(r._rebrandedFrom)}">REBRAND</span>`;
        tr.innerHTML = `
          <td>${escapeHtml(r.ref)}</td>
          <td>${statusChip}</td>
          <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(r.description || '', 60))}</td>
          <td class="num liters">${r.liters ?? '—'}</td>
          <td class="num">${formatEur(value)}</td>
        `;
        if (value == null) tr.className = 'warn';
        frag.appendChild(tr);
      }
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      return;
    }

    if (kind === 'list') {
      const spec = PRICE_LIST_TYPES[key];
      thead.innerHTML = `<tr><th>Ref</th><th>Estado</th><th>Producto</th><th class="num liters">Litros</th><th class="num">${escapeHtml(spec.label)}</th></tr>`;
      $('exportVisibleCount').textContent = visible.length;
      const frag = document.createDocumentFragment();
      for (const r of visible.slice(0, 500)) {
        const tr = document.createElement('tr');
        let statusChip = '';
        if (r._status === 'new') statusChip = '<span class="status-chip new">NUEVA</span>';
        else if (r._rebrandedFrom) statusChip = `<span class="status-chip stable" title="Antes: ${escapeHtml(r._rebrandedFrom)}">REBRAND</span>`;
        const cost = r[spec.costField];
        tr.innerHTML = `
          <td>${escapeHtml(r.ref)}</td>
          <td>${statusChip}</td>
          <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(r.description || '', 60))}</td>
          <td class="num liters">${r.liters ?? '—'}</td>
          <td class="num">${formatEur(cost)}</td>
        `;
        if (cost == null) tr.className = 'warn';
        frag.appendChild(tr);
      }
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      return;
    }

    // kind === 'level'
    thead.innerHTML = `
      <tr>
        <th>Ref</th><th>Estado</th><th>Producto</th><th class="num liters">Litros</th>
        <th class="num">Coste/envase</th><th class="num">% Margen</th><th class="num">PVP envase</th>
        <th class="num">PVP manual</th><th class="num">Ganancia €</th><th class="num">Margen real</th>
      </tr>`;
    const byGama = currentGama === '__all__' ? loadLevelsByGama(currentBrandId, brand.gamas) : null;
    const levelCache = {};
    const levelFor = (gama) => {
      if (levelCache[gama]) return levelCache[gama];
      const lvl = currentGama === '__all__'
        ? (byGama[gama] || []).find(l => l.id === key)
        : loadLevels(currentBrandId, currentGama).find(l => l.id === key);
      levelCache[gama] = lvl || null;
      return levelCache[gama];
    };
    // Netos Bonus es una hoja impresa: solo entran los formatos marcados como "Salida
    // impresa" en Reglas para la gama real de cada fila — a diferencia de PVP, que
    // siempre muestra todo lo que tenga coste (ver ADR 0026 v2).
    if (key === 'netos_bonus') {
      visible = visible.filter(r => {
        const lvl = levelFor(r.gama);
        return lvl && lvl.printFormats && lvl.printFormats[r.formatKey];
      });
    }
    $('exportVisibleCount').textContent = visible.length;

    const frag = document.createDocumentFragment();
    for (const r of visible.slice(0, 500)) {
      const level = levelFor(r.gama);
      const tr = document.createElement('tr');
      if (!level) {
        tr.innerHTML = `<td>${escapeHtml(r.ref)}</td><td></td><td title="${escapeHtml(r.description)}">${escapeHtml(truncate(r.description || '', 60))}</td><td class="num liters">${r.liters ?? '—'}</td><td class="num">${formatEur(r.costFactura)}</td><td colspan="5" class="muted" style="font-style:italic;">nivel no configurado en esta gama</td>`;
        frag.appendChild(tr);
        continue;
      }
      const c = Pricing.compute(r, level);
      const classes = [];
      if (!r.litersDetected) classes.push('warn');
      if (!r.costFactura || r.costFactura <= 0) classes.push('err');
      let statusChip = '';
      if (r._status === 'new') { statusChip = '<span class="status-chip new">NUEVA</span>'; classes.push('status-new'); }
      else if (r._rebrandedFrom) statusChip = `<span class="status-chip stable" title="Antes: ${escapeHtml(r._rebrandedFrom)}">REBRAND</span>`;
      tr.className = classes.join(' ');
      const manualVal = level.manualOverride ? level.manualOverride[r.ref] : null;
      const pvpTitle = c.isManual ? 'PVP fijado manualmente' : '';
      tr.innerHTML = `
        <td>${escapeHtml(r.ref)}</td>
        <td>${statusChip}</td>
        <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(r.description || '', 60))}</td>
        <td class="num liters">${r.liters ?? '—'}</td>
        <td class="num">${formatEur(r.costFactura)}</td>
        <td class="num">${c.marginPct != null ? c.marginPct.toFixed(1) + '%' : '—'}</td>
        <td class="num" title="${escapeHtml(pvpTitle)}"><strong${c.isManual ? ' style="color:#1a6bcf;"' : ''}>${formatEur(c.pvp)}</strong></td>
        <td class="num"><input type="number" step="0.01" value="${manualVal ?? ''}" placeholder="auto" data-ref="${escapeHtml(r.ref)}" data-gama="${escapeHtml(r.gama)}" data-level="${escapeHtml(key)}" data-field="manualPvp" style="width:74px;text-align:right;padding:0.1rem 0.3rem;margin:0;font-size:0.8rem;"></td>
        <td class="num">${formatEur(c.gain)}</td>
        <td class="num">${c.realMarginPct != null ? c.realMarginPct.toFixed(1) + '%' : '—'}</td>
      `;
      frag.appendChild(tr);
    }
    tbody.innerHTML = '';
    tbody.appendChild(frag);

    tbody.querySelectorAll('input[data-field="manualPvp"]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const ref = e.target.dataset.ref;
        const gama = e.target.dataset.gama;
        const levelId = e.target.dataset.level;
        const raw = e.target.value;
        let v = null;
        if (raw !== '' && raw != null) {
          const parsed = parseFloat(raw);
          if (isFinite(parsed) && parsed > 0) v = parsed;
        }
        saveManualOverride(currentBrandId, gama, levelId, ref, v);
        renderPreviewTable();
      });
    });
  }

  async function doExport() {
    const brand = findBrand(currentBrandId);
    if (!brand) { alert('Elige una marca antes de exportar.'); return; }
    if (!currentOption) { alert('Elige un tipo de exportación.'); return; }
    if (!rows.length) { alert('No hay tarifa importada para esta marca/gama en el maestro.'); return; }
    const tariffDate = $('exportTariffDate').value || new Date().toISOString().slice(0, 10);
    const [kind, key] = currentOption.split(':');

    if (kind === 'list' && key === 'regalo_1x1') {
      const withValue = rows.filter(r => typeof r._regaloValue === 'number' && isFinite(r._regaloValue));
      if (!withValue.length) { alert('Ninguna referencia de esta marca/gama tiene el modo "1+2" activado en PVP y con coste auditado.'); return; }
      const fname = ExcelWriter.exportPriceList(rows, brand.abbr, '_regaloValue', 'Valor Regalo 1+1', tariffDate);
      $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${withValue.length} filas).</small>`;
      return;
    }

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
    const byGama = currentGama === '__all__' ? loadLevelsByGama(currentBrandId, brand.gamas) : null;
    const levelForGama = (gama) => byGama ? (byGama[gama] || []).find(l => l.id === key) : loadLevels(currentBrandId, currentGama).find(l => l.id === key);
    // Netos Bonus es una hoja impresa: solo se exportan los formatos marcados como
    // "Salida impresa" para la gama real de cada fila (WYSIWYG con la previsualización).
    let exportRows = rows;
    if (key === 'netos_bonus') {
      exportRows = rows.filter(r => { const lvl = levelForGama(r.gama); return lvl && lvl.printFormats && lvl.printFormats[r.formatKey]; });
      if (!exportRows.length) { alert('Ningún formato de esta marca/gama está marcado con "Salida impresa" en Netos Bonus.'); return; }
    }
    if (currentGama === '__all__') {
      const anyLevel = brand.gamas.map(g => levelForGama(g)).find(Boolean);
      // exportSkritV2 llama al resolver con la FILA, no con la gama — a diferencia de
      // levelForGama (que usamos arriba directamente con un string de gama para filtrar
      // por printFormats).
      const resolver = (row) => levelForGama(row.gama);
      const fname = ExcelWriter.exportSkritV2(exportRows, brand.abbr, resolver, tariffDate, key);
      $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${exportRows.length} filas, nivel "${escapeHtml(anyLevel ? anyLevel.label : key)}", todas las gamas).</small>`;
      return;
    }
    const level = levelForGama(currentGama);
    if (!level) { alert('Ese nivel ya no existe para esta marca/gama.'); return; }
    const fname = ExcelWriter.exportSkritV2(exportRows, brand.abbr, level, tariffDate);
    $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${exportRows.length} filas, nivel "${escapeHtml(level.label)}").</small>`;
  }

  function setupListeners() {
    $('exportBrandSelect').addEventListener('change', (e) => { currentBrandId = e.target.value; renderGamaSelect(); });
    $('exportGamaSelect').addEventListener('change', (e) => { currentGama = e.target.value; renderExportOptions(); });
    $('exportTypeSelect').addEventListener('change', (e) => { currentOption = e.target.value; renderPreview(); });
    $('exportSearchInput').addEventListener('input', (e) => { filter.text = e.target.value; renderPreviewTable(); });
    $('exportFormatFilter').addEventListener('change', (e) => { filter.format = e.target.value; renderPreviewTable(); });
    $('exportStatusFilter').addEventListener('change', (e) => { filter.status = e.target.value; renderPreviewTable(); });
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
