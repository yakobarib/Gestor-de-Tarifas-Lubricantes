/* ============================================================================
   PANTALLA: TARIFAS
   ============================================================================
   Muestra la tarifa recién cargada en Importación (`LoadedTariff`): tabla de
   preview, filtros, comparación contra la tarifa vigente anterior (KPIs) y
   edición de PVP manual por fila. El margen/nivel de precio (PVP, Bidones y
   Cubas Neto, Netos Bonus…) YA NO se configura aquí — vive solo en Reglas
   (mismo `priceLevels` que usan Comparación y Exportación, ver ADR pendiente
   de "Tarifas" screen); esta pantalla solo LEE el nivel "pvp" vigente de esa
   marca/gama para calcular el PVP y guardar los overrides manuales por ref.

   Pestaña de gama "Todas": distinto de las demás pantallas porque aquí cada
   gama puede tener el nivel "pvp" con un margen distinto — al ver "Todas" el
   PVP de cada fila se calcula con el nivel de SU PROPIA gama real, no con uno
   compartido (ver `levelForRealGama`).
*/
const ScreenTarifas = (() => {
  const $ = (id) => document.getElementById(id);

  const GAMA_LABELS = {
    normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General',
    'i-sint': 'i-Sint', 'i-sigma': 'i-Sigma', rotra: 'Rotra', industria: 'Industria',
    'i-ride': 'i-Ride', 'food-line': 'Food-Line', grasas: 'Grasas', forestal: 'Forestal',
    anticongelantes: 'Anticongelantes',
    automocion: 'Automoción', 'productos-de-mantenimiento': 'Productos de Mantenimiento',
    marinos: 'Marinos', alimentarios: 'Alimentarios',
    'v-ligero': 'V. Ligero', 'v-pesado': 'V. Pesado', agricola: 'Agrícola', transmision: 'Transmisión',
    hidraulicos: 'Hidráulicos', grasa: 'Grasa', moto: 'Moto', classic: 'Classic',
    marina: 'Marina', anticogelante: 'Anticongelante', aditivos: 'Aditivos',
    advance: 'Advance', 'air-tool': 'Air Tool', corena: 'Corena', diala: 'Diala',
    gadinia: 'Gadinia', gadus: 'Gadus', 'heat-transfer': 'Heat Transfer', helix: 'Helix',
    hydraulic: 'Hydraulic', morlina: 'Morlina', omala: 'Omala', ondina: 'Ondina',
    'paper-mach': 'Paper Mach', refrigeration: 'Refrigeration', rimula: 'Rimula',
    sirius: 'Sirius', spirax: 'Spirax', tegula: 'Tegula', tellus: 'Tellus', tonna: 'Tonna',
    transmission: 'Transmission', turbo: 'Turbo', 'vacuum-pump': 'Vacuum Pump',
    other: 'Other', crb: 'CRB', edge: 'EDGE', gtx: 'GTX', 'gtx-5w': 'GTX 5W',
    magnatec: 'Magnatec', 'castrol-on': 'Castrol ON', transmax: 'Transmax', vecton: 'Vecton'
  };

  let activeGama = 'default';      // gama real para "Establecer como vigente" cuando no se ve "Todas"
  let tableFilterGama = 'default'; // gama mostrada en la tabla — '__all__' = todas
  let filter = { text: '', format: '', status: '' };
  let diff = null;
  let rows = [];

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatEur(v) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function configKeyFor(supplierId, gama) {
    return gama === 'default' ? `config_${supplierId}` : `config_${supplierId}_${gama}`;
  }

  /** Nivel "pvp" vigente de una marca/gama concreta — el mismo que edita Reglas. Se
   *  sintetiza (y persiste) si esa marca/gama todavía no tiene config guardada. */
  function loadPvpLevel(supplierId, gama) {
    const key = configKeyFor(supplierId, gama);
    let cfg = Storage.get(key);
    let isNew = false;
    if (!cfg) { cfg = { defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualPvp: {} }; isNew = true; }
    if (!cfg.priceLevels || !cfg.priceLevels.length) { cfg.priceLevels = [Migration.synthesizePvpLevel(cfg)]; isNew = true; }
    let level = cfg.priceLevels.find(l => l.id === 'pvp');
    if (!level) { level = Migration.synthesizePvpLevel(cfg); cfg.priceLevels.unshift(level); isNew = true; }
    if (isNew) Storage.set(key, cfg);
    return { cfg, level, key };
  }

  function saveManualOverride(supplierId, gama, ref, value) {
    const { cfg, level, key } = loadPvpLevel(supplierId, gama);
    if (!level.manualOverride) level.manualOverride = {};
    if (value == null) delete level.manualOverride[ref];
    else level.manualOverride[ref] = value;
    Storage.set(key, cfg);
    Store.emit('rules:changed', { brandId: supplierId, gama });
  }

  function saveLitersEdit(row) {
    // Los litros son propiedad de la fila (LoadedTariff.allRows), no del nivel de precio
    // — no hace falta tocar Storage, solo re-renderizar con el nuevo formatKey.
    row.formatKey = Parser.formatKey(row.liters);
    row.litersDetected = row.liters != null;
  }

  function historyIdentifier(loaded, gama) {
    return gama === 'default' ? loaded.supplier : `${loaded.supplier} ${gama}`;
  }
  function rebrandPairs(loaded) {
    return RebrandMap.load(loaded.supplierId);
  }

  /** Diff agregado sumando el de cada gama real — usado solo en la vista "Todas", donde
   *  no hay una única "tarifa anterior" con la que comparar de golpe. */
  function computeAllGamasDiff(loaded) {
    let total = 0, stable = 0, neu = 0, obsolete = 0, obsoleteRefs = [], hasPrevious = false;
    for (const g of loaded.gamas) {
      const gRows = loaded.allRows.filter(r => r.gama === g);
      const previous = History.load(historyIdentifier(loaded, g));
      const d = History.diff(gRows, previous, rebrandPairs(loaded));
      total += d.total; stable += d.stable; neu += d.new; obsolete += d.obsolete;
      obsoleteRefs = obsoleteRefs.concat(d.obsoleteRefs || []);
      if (d.hasPrevious) hasPrevious = true;
    }
    return { total, stable, new: neu, obsolete, obsoleteRefs, hasPrevious, combined: true };
  }

  /* ----- render: pestañas de gama (+ "Todas") ----- */
  function renderGamaTabs() {
    const el = $('gamaTabs');
    const loaded = LoadedTariff.get();
    if (!loaded || !loaded.gamas || loaded.gamas.length <= 1) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    const allBtn = `<button type="button" class="mode-btn ${tableFilterGama === '__all__' ? 'active' : ''}" data-gama="__all__" aria-pressed="${tableFilterGama === '__all__'}">Todas</button>`;
    const gamaBtns = loaded.gamas.map(g => `
      <button type="button" class="mode-btn ${g === tableFilterGama ? 'active' : ''}" data-gama="${escapeHtml(g)}" aria-pressed="${g === tableFilterGama}">
        ${escapeHtml(GAMA_LABELS[g] || g)}
      </button>
    `).join('');
    el.innerHTML = allBtn + gamaBtns;
  }

  function switchGama(gama) {
    const loaded = LoadedTariff.get();
    if (!loaded || gama === tableFilterGama) return;
    if (gama === '__all__') {
      tableFilterGama = '__all__';
      rows = loaded.allRows.slice();
      diff = computeAllGamasDiff(loaded);
    } else {
      if (!loaded.gamas.includes(gama)) return;
      activeGama = gama;
      tableFilterGama = gama;
      rows = loaded.allRows.filter(r => r.gama === gama);
      const previous = History.load(historyIdentifier(loaded, gama));
      diff = History.diff(rows, previous, rebrandPairs(loaded));
    }
    renderGamaTabs();
    renderFormatFilter();
    renderHistoryBanner();
    renderTable();
    renderKpis();
  }

  /* ----- filtrado ----- */
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
    const sel = $('formatFilter');
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

  /* ----- render: tabla preview ----- */
  function renderTable() {
    const loaded = LoadedTariff.get();
    if (!loaded) return;
    const tbody = $('previewBody');
    const visible = visibleRows();
    $('visibleCount').textContent = visible.length;
    $('totalCount').textContent = rows.length;

    const MAX = 500;
    const slice = visible.slice(0, MAX);

    // Nivel "pvp" por gama real — cacheado por render para no releer Storage por fila.
    const levelCache = {};
    const levelFor = (gama) => levelCache[gama] || (levelCache[gama] = loadPvpLevel(loaded.supplierId, gama).level);

    const frag = document.createDocumentFragment();
    for (const r of slice) {
      const level = levelFor(tableFilterGama === '__all__' ? r.gama : activeGama);
      const c = Pricing.compute(r, level);
      const tr = document.createElement('tr');

      const classes = [];
      if (!r.litersDetected) classes.push('warn');
      if (!r.costPerPack || r.costPerPack <= 0) classes.push('err');
      if (r.liters != null) {
        const band = r.liters >= 500 ? 1000 : r.liters >= 100 ? 208 : r.liters >= 30 ? 60 : r.liters >= 10 ? 20 : r.liters >= 3 ? 5 : 1;
        classes.push('fmt-' + band);
      }

      let statusChip = '';
      if (r._status === 'new') { statusChip = '<span class="status-chip new">NUEVA</span>'; classes.push('status-new'); }
      else if (r._rebrandedFrom) statusChip = `<span class="status-chip stable" title="Antes: ${escapeHtml(r._rebrandedFrom)}">REBRAND</span>`;
      tr.className = classes.join(' ');

      const costTitle = r._prevCost != null
        ? `Anterior: ${r._prevCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
        : '';
      const manualVal = level.manualOverride ? level.manualOverride[r.ref] : null;
      const pvpTitle = c.isManual ? 'PVP fijado manualmente' : '';

      tr.innerHTML = `
        <td>${escapeHtml(r.ref)}</td>
        <td>${statusChip}</td>
        <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(r.description, 60))}</td>
        <td class="num liters"><input type="number" step="0.01" value="${r.liters ?? ''}" data-ref="${escapeHtml(r.ref)}" data-field="liters"></td>
        <td class="num" title="${escapeHtml(costTitle)}">${formatEur(r.costPerPack)}</td>
        <td class="num">${c.marginPct != null ? c.marginPct.toFixed(1) + '%' : '—'}</td>
        <td class="num" title="${escapeHtml(pvpTitle)}"><strong${c.isManual ? ' style="color:#1a6bcf;"' : ''}>${formatEur(c.pvp)}</strong></td>
        <td class="num"><input type="number" step="0.01" value="${manualVal ?? ''}" placeholder="auto" data-ref="${escapeHtml(r.ref)}" data-gama="${escapeHtml(r.gama)}" data-field="manualPvp" style="width:74px;text-align:right;padding:0.1rem 0.3rem;margin:0;font-size:0.8rem;"></td>
        <td class="num">${formatEur(c.gain)}</td>
        <td class="num">${c.realMarginPct != null ? c.realMarginPct.toFixed(1) + '%' : '—'}</td>
      `;
      frag.appendChild(tr);
    }
    tbody.innerHTML = '';
    tbody.appendChild(frag);

    tbody.querySelectorAll('input[data-field="liters"]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const ref = e.target.dataset.ref;
        const v = parseFloat(e.target.value);
        const row = rows.find(r => r.ref === ref);
        if (row) {
          row.liters = isFinite(v) ? v : null;
          saveLitersEdit(row);
          renderFormatFilter();
          renderTable();
          renderKpis();
        }
      });
    });

    tbody.querySelectorAll('input[data-field="manualPvp"]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const ref = e.target.dataset.ref;
        const gama = e.target.dataset.gama;
        const raw = e.target.value;
        let v = null;
        if (raw !== '' && raw != null) {
          const parsed = parseFloat(raw);
          if (isFinite(parsed) && parsed > 0) v = parsed;
        }
        saveManualOverride(loaded.supplierId, gama, ref, v);
        renderTable();
        renderKpis();
      });
    });

    if (visible.length > MAX) {
      const note = document.createElement('tr');
      note.innerHTML = `<td colspan="10" style="text-align:center; padding:0.6rem; color: var(--pico-muted-color); font-style: italic;">
        Mostrando ${MAX} primeras filas (de ${visible.length}). Usa el buscador o los filtros para acotar.
      </td>`;
      tbody.appendChild(note);
    }
  }

  /* ----- render: banner de contexto histórico ----- */
  function renderHistoryBanner() {
    const b = $('historyBanner');
    const loaded = LoadedTariff.get();
    if (!loaded || !diff) { b.classList.add('hidden'); return; }
    if (tableFilterGama === '__all__') {
      b.className = 'history-banner';
      b.innerHTML = diff.hasPrevious
        ? `📊 Vista combinada de todas las gamas de <strong>${escapeHtml(loaded.supplier)}</strong> (cada gama comparada contra su propia tarifa vigente anterior).`
        : `⚠ Vista combinada de todas las gamas de <strong>${escapeHtml(loaded.supplier)}</strong>. Ninguna tiene todavía tarifa anterior guardada — todas las referencias se marcan como nuevas.`;
    } else if (!diff.hasPrevious) {
      b.className = 'history-banner first-time';
      b.innerHTML = `⚠ Sin tarifa anterior guardada para <strong>${escapeHtml(loaded.supplier)}</strong>. Todas las referencias se marcan como nuevas. Al pulsar "Establecer como vigente" esta tarifa quedará como referencia para futuras comparaciones.`;
    } else {
      b.className = 'history-banner';
      const dt = diff.previousTariffDate || diff.previousDate;
      b.innerHTML = `📊 Comparando con la tarifa vigente de <strong>${escapeHtml(loaded.supplier)}</strong> del <strong>${escapeHtml(dt)}</strong>.`;
    }
    b.classList.remove('hidden');
  }

  /* ----- render: KPIs comparativos ----- */
  function renderKpis() {
    const d = diff || { total: rows.length, stable: 0, new: rows.length, obsolete: 0, obsoleteRefs: [] };
    const total = d.total;
    const stablePct = total > 0 ? (d.stable / total * 100) : 0;
    const newPct    = total > 0 ? (d.new    / total * 100) : 0;
    const obsoleteLink = d.obsolete > 0
      ? `<div class="action"><a onclick="window.__openObsoleteModal()">ver lista →</a></div>`
      : '';

    $('kpis').innerHTML = `
      <div class="kpi">
        <div class="label">Referencias Totales</div>
        <div class="value">${total}</div>
      </div>
      <div class="kpi stable">
        <div class="label">Referencias Estables</div>
        <div class="value">${d.stable}<small>${stablePct.toFixed(0)}%</small></div>
      </div>
      <div class="kpi new">
        <div class="label">Referencias Nuevas</div>
        <div class="value">${d.new}<small>${newPct.toFixed(0)}%</small></div>
      </div>
      <div class="kpi obsolete">
        <div class="label">Referencias Desaparecidas</div>
        <div class="value">${d.obsolete}</div>
        ${obsoleteLink}
      </div>
    `;

    const noLiters = rows.filter(r => !r.litersDetected).length;
    if (noLiters > 0) {
      $('warningChip').classList.remove('hidden');
      $('warningText').textContent = `${noLiters} refs sin litros detectados`;
    } else {
      $('warningChip').classList.add('hidden');
    }
  }

  window.__openObsoleteModal = function() {
    const d = diff;
    if (!d || !d.obsoleteRefs || d.obsoleteRefs.length === 0) return;
    const ul = $('obsoleteList');
    ul.innerHTML = d.obsoleteRefs.map(r => {
      const desc = r.description ? escapeHtml(r.description) : '<em class="muted">(sin descripción)</em>';
      const cost = r.cost != null ? ` — ${formatEur(r.cost)}` : '';
      return `<li><strong>${escapeHtml(r.ref)}</strong>: ${desc}${cost}</li>`;
    }).join('');
    $('modalObsolete').classList.remove('hidden');
  };

  /* ----- carga/refresco desde LoadedTariff ----- */
  function refreshFromLoaded() {
    const loaded = LoadedTariff.get();
    if (!loaded) {
      $('tarifasEmpty').classList.remove('hidden');
      $('tarifasContent').classList.add('hidden');
      return;
    }
    $('tarifasEmpty').classList.add('hidden');
    $('tarifasContent').classList.remove('hidden');
    $('tarifasTitle').textContent = loaded.supplier;
    $('tariffDateTarifas').value = loaded.tariffDate || new Date().toISOString().slice(0, 10);
    activeGama = loaded.gamas[0];
    tableFilterGama = activeGama;
    rows = loaded.allRows.filter(r => r.gama === activeGama);
    const previous = History.load(historyIdentifier(loaded, activeGama));
    diff = History.diff(rows, previous, rebrandPairs(loaded));
    renderGamaTabs();
    renderFormatFilter();
    renderHistoryBanner();
    renderTable();
    renderKpis();
    $('loadStatusTarifas').classList.add('hidden');
  }

  function setupListeners() {
    $('gamaTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-gama]');
      if (!btn) return;
      switchGama(btn.dataset.gama);
    });
    $('searchInput').addEventListener('input', (e) => { filter.text = e.target.value; renderTable(); });
    $('formatFilter').addEventListener('change', (e) => { filter.format = e.target.value; renderTable(); });
    $('statusFilter').addEventListener('change', (e) => { filter.status = e.target.value; renderTable(); });
    $('tariffDateTarifas').addEventListener('change', (e) => {
      const loaded = LoadedTariff.get();
      if (loaded) loaded.tariffDate = e.target.value;
    });

    $('btnSetCurrent').addEventListener('click', () => {
      const loaded = LoadedTariff.get();
      if (!loaded || !rows.length) return;
      const combined = tableFilterGama === '__all__';
      const label = combined
        ? `${loaded.supplier} (todas las gamas)`
        : (activeGama !== 'default' ? `${loaded.supplier} (${GAMA_LABELS[activeGama] || activeGama})` : loaded.supplier);
      if (!confirm(`¿Establecer esta tarifa como la vigente para ${label}?\n\nLa próxima tarifa que cargues se comparará contra esta.`)) return;
      const gamasToSave = combined ? loaded.gamas : [activeGama];
      for (const g of gamasToSave) {
        const gRows = loaded.allRows.filter(r => r.gama === g);
        History.save(historyIdentifier(loaded, g), gRows, loaded.tariffDate);
      }
      diff = combined ? computeAllGamasDiff(loaded) : History.diff(rows, History.load(historyIdentifier(loaded, activeGama)), rebrandPairs(loaded));
      renderHistoryBanner(); renderKpis(); renderTable();
      $('loadStatusTarifas').classList.remove('hidden');
      $('loadStatusTarifas').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Tarifa vigente de ${escapeHtml(label)} actualizada.</small>`;
    });

    $('btnBackToImport').addEventListener('click', () => {
      LoadedTariff.clear();
      Router.show('import');
    });

    Store.on('tariff:loaded', () => { if (Router.current() === 'tarifas') refreshFromLoaded(); });
    Store.on('screen:changed', (screen) => { if (screen === 'tarifas') refreshFromLoaded(); });
    // Si se carga un mapa de rebranding para la marca que se está viendo, recalcula el
    // diff en vivo (los rebrands afectan a qué refs cuentan como "nuevas").
    Store.on('rebrand:loaded', (brands) => {
      const loaded = LoadedTariff.get();
      if (!loaded || !brands.includes((loaded.supplier || '').toUpperCase())) return;
      diff = tableFilterGama === '__all__' ? computeAllGamasDiff(loaded) : History.diff(rows, History.load(historyIdentifier(loaded, activeGama)), rebrandPairs(loaded));
      renderHistoryBanner(); renderKpis(); renderTable();
    });
  }

  function init() {
    setupListeners();
    refreshFromLoaded();
  }

  return { init };
})();
