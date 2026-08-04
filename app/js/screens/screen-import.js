/* ============================================================================
   PANTALLA: IMPORTACIÓN
   ============================================================================
   Cuadrícula de tarjetas por marca (estado de la última tarifa importada,
   leído de los metadatos `import_meta_*` en localStorage) + el flujo de carga
   de una tarifa concreta, que es el mismo de v0.1-v0.3.0 (drop zone, tabla de
   preview, configuración de margen, pestañas de gama, export legacy).
   Cada importación con éxito además persiste sus filas en MasterDB
   (IndexedDB) para que la pantalla de Comparación tenga datos multi-marca.
*/
const ScreenImport = (() => {

  const state = {
    supplier: null,
    supplierId: null,    // id del perfil (repsol, ad_parts_aceite, eni…) — clave de storage
    gamas: ['default'],  // gamas presentes en la tarifa cargada (normal/standard/sportcar/quimico/default)
    activeGama: 'default',
    allRows: [],          // todas las filas leídas, de todas las gamas
    rows: [],            // filas de la gama activa (lo que ya consumen render/pricing/export)
    config: {
      defaultMargin: 30,
      byFormat: {},      // { '1': 35, '5': 30, '20': 25, ... }
      rounding: '2dec',
      marginMode: 'sale', // 'sale' (sobre venta) | 'cost' (sobre compra)
      manualPvp: {}      // { [ref]: pvp } — override manual por fila (ver Pricing.compute)
    },
    filter: { text: '', format: '', status: '' },
    tariffDate: '',
    diff: null           // resultado de History.diff cargado al importar
  };

  /* ----- elementos del DOM ----- */
  const $ = (id) => document.getElementById(id);

  /* ----- persistencia config: una clave por (proveedor, gama) -----
     Repsol mantiene su clave histórica 'config_repsol' (gama 'default' no
     añade sufijo) para no perder la configuración ya guardada en v0.2.2. */
  function configKeyFor() {
    return state.activeGama === 'default'
      ? `config_${state.supplierId}`
      : `config_${state.supplierId}_${state.activeGama}`;
  }
  function defaultConfig() {
    return { defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualPvp: {} };
  }
  function loadConfig() {
    state.config = defaultConfig();
    const saved = Storage.get(configKeyFor());
    if (saved) Object.assign(state.config, saved);
    if (!state.config.manualPvp) state.config.manualPvp = {};
  }
  function saveConfig() {
    Storage.set(configKeyFor(), state.config);
  }
  /** Identificador para History — reutiliza History.keyFor tal cual, solo compone el nombre. */
  function historyIdentifier() {
    return state.activeGama === 'default' ? state.supplier : `${state.supplier} ${state.activeGama}`;
  }
  function importMetaKey(gama) {
    return `import_meta_${state.supplierId}_${gama}_factura`;
  }
  /** Cruce ref antigua↔nueva por rebranding (ver RebrandMap / ADR 0009), si hay uno cargado para este proveedor. */
  function rebrandPairs() {
    return RebrandMap.load(state.supplierId);
  }

  /* ----- render: cuadrícula de tarjetas por marca ----- */
  function renderBrandCards() {
    const el = $('brandGrid');
    if (!el) return;
    el.innerHTML = BRANDS.map(b => {
      const icon = `<div class="brand-icon" style="background:${escapeHtml(b.color || '#94a3b8')}">${escapeHtml(b.abbr || '')}</div>`;
      if (b.pending) {
        return `<div class="brand-card pending"><div class="brand-card-head">${icon}<h4>${escapeHtml(b.label)}</h4></div><div class="line">Próximamente</div></div>`;
      }
      const gamaLines = b.separateFiles
        ? b.gamas.map(g => {
            const meta = Storage.get(`import_meta_${b.id}_${g}_factura`, null);
            const label = GAMA_LABELS[g] || (g.charAt(0).toUpperCase() + g.slice(1));
            const status = meta
              ? `<span class="status-ok">${meta.rowCount} refs · ${escapeHtml(meta.tariffDate || meta.importedAt)}</span>`
              : `<span class="status-none">sin importar</span>`;
            return `<div class="line">${escapeHtml(label)}: ${status}</div>`;
          }).join('')
        : (() => {
            // Todas las gamas llegan juntas en el mismo Excel (una pestaña por
            // gama) — una sola línea resumen en vez de una por gama.
            let totalRows = 0, latestDate = null, anyImported = false;
            for (const g of b.gamas) {
              const meta = Storage.get(`import_meta_${b.id}_${g}_factura`, null);
              if (!meta) continue;
              anyImported = true;
              totalRows += meta.rowCount || 0;
              const d = meta.tariffDate || meta.importedAt;
              if (d && (!latestDate || d > latestDate)) latestDate = d;
            }
            const status = anyImported
              ? `<span class="status-ok">${totalRows} refs · ${escapeHtml(latestDate || '')}</span>`
              : `<span class="status-none">sin importar</span>`;
            return `<div class="line">Tarifa general: ${status}</div>`;
          })();
      const dropZone = `
        <div class="brand-drop" data-brand-drop="${escapeHtml(b.id)}" title="Arrastra o elige la tarifa de ${escapeHtml(b.label)}">
          Arrastra tarifa o pulsa
          <input type="file" class="brand-drop-input" data-brand-input="${escapeHtml(b.id)}" accept=".xlsx,.xls" hidden>
        </div>`;
      return `<div class="brand-card"><div class="brand-card-head">${icon}<h4>${escapeHtml(b.label)}</h4></div>${gamaLines}${dropZone}</div>`;
    }).join('');
  }

  /* ----- render: panel de formatos ----- */
  function renderFormatConfig() {
    // Contar refs por formatKey, ordenar por litros ascendente
    const counts = {};
    for (const r of state.rows) {
      counts[r.formatKey] = (counts[r.formatKey] || 0) + 1;
    }
    const keys = Object.keys(counts).sort((a, b) => {
      if (a === '?') return 1; if (b === '?') return -1;
      return parseFloat(a) - parseFloat(b);
    });

    const container = $('formatConfig');
    container.innerHTML = '';
    for (const key of keys) {
      const liters = key === '?' ? null : parseFloat(key);
      const label = Parser.formatLabel(liters);
      const value = state.config.byFormat[key] != null ? state.config.byFormat[key] : '';
      const placeholder = state.config.defaultMargin;

      const row = document.createElement('div');
      row.className = 'format-row';
      row.innerHTML = `
        <label>${label}</label>
        <input type="number" min="0" max="500" step="0.5" data-format="${escapeHtml(key)}" placeholder="${placeholder}" value="${value}">
        <span class="count">${counts[key]} refs</span>
      `;
      container.appendChild(row);
    }
    // NOTA: los listeners de estos inputs se manejan por event delegation en
    // setupConfigListeners() sobre el contenedor #formatConfig — así sobreviven
    // a cualquier re-render sin necesidad de re-enganchar cada vez.
  }

  /* ----- render: filtro de formato ----- */
  function renderFormatFilter() {
    const sel = $('formatFilter');
    const keys = [...new Set(state.rows.map(r => r.formatKey))].sort((a, b) => {
      if (a === '?') return 1; if (b === '?') return -1;
      return parseFloat(a) - parseFloat(b);
    });
    sel.innerHTML = '<option value="">Todos los formatos</option>'
      + keys.map(k => {
          const l = k === '?' ? null : parseFloat(k);
          return `<option value="${escapeHtml(k)}">${Parser.formatLabel(l)}</option>`;
        }).join('');
  }

  /* ----- render: pestañas de gama (Normal / Standard / Sport Car…) ----- */
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
  function renderGamaTabs() {
    const el = $('gamaTabs');
    if (!state.gamas || state.gamas.length <= 1) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = state.gamas.map(g => `
      <button type="button" class="mode-btn ${g === state.activeGama ? 'active' : ''}" data-gama="${escapeHtml(g)}" aria-pressed="${g === state.activeGama}">
        ${escapeHtml(GAMA_LABELS[g] || g)}
      </button>
    `).join('');
  }

  /** Cambia la gama activa: recarga config/historial propios de esa gama sin perder las demás. */
  function switchGama(gama) {
    if (gama === state.activeGama || !state.gamas.includes(gama)) return;
    state.activeGama = gama;
    state.rows = state.allRows.filter(r => r.gama === gama);
    loadConfig();
    $('defaultMargin').value = state.config.defaultMargin;
    $('rounding').value = state.config.rounding;
    const previous = History.load(historyIdentifier());
    state.diff = History.diff(state.rows, previous, rebrandPairs());
    renderFormula();
    renderGamaTabs();
    renderFormatConfig();
    renderFormatFilter();
    renderHistoryBanner();
    renderTable();
    renderKpis();
  }

  /* ----- filtrado ----- */
  function visibleRows() {
    const txt = state.filter.text.toLowerCase().trim();
    const fmt = state.filter.format;
    const status = state.filter.status;
    return state.rows.filter(r => {
      if (txt) {
        const hay = (r.ref + ' ' + r.description).toLowerCase();
        if (!hay.includes(txt)) return false;
      }
      if (fmt && r.formatKey !== fmt) return false;
      if (status === 'new'    && r._status !== 'new')    return false;
      if (status === 'stable' && r._status !== 'stable') return false;
      return true;
    });
  }

  /* ----- render: tabla preview ----- */
  function renderTable() {
    const tbody = $('previewBody');
    const rows = visibleRows();
    $('visibleCount').textContent = rows.length;
    $('totalCount').textContent = state.rows.length;

    // Render por chunks para performance (>500 filas)
    const MAX = 500;
    const slice = rows.slice(0, MAX);

    const frag = document.createDocumentFragment();
    for (const r of slice) {
      const c = Pricing.compute(r, state.config);
      const tr = document.createElement('tr');

      // Clases visuales — bandeo por rango de tamaño
      const classes = [];
      if (!r.litersDetected) classes.push('warn');
      if (!r.costPerPack || r.costPerPack <= 0) classes.push('err');
      if (r.liters != null) {
        const band = r.liters >= 500 ? 1000 : r.liters >= 100 ? 208 : r.liters >= 30 ? 60 : r.liters >= 10 ? 20 : r.liters >= 3 ? 5 : 1;
        classes.push('fmt-' + band);
      }
      tr.className = classes.join(' ');

      // Chip de estado (NUEVA / vacío para estable)
      let statusChip = '';
      if (r._status === 'new') statusChip = '<span class="status-chip new">NUEVA</span>';
      else if (r._rebrandedFrom) statusChip = `<span class="status-chip stable" title="Antes: ${escapeHtml(r._rebrandedFrom)}">REBRAND</span>`;
      else if (r._status === 'stable') statusChip = '';
      if (r._status === 'new') classes.push('status-new');

      // Tooltip precio anterior si hay
      const costTitle = r._prevCost != null
        ? `Anterior: ${r._prevCost.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2})} €`
        : '';

      const manualVal = state.config.manualPvp ? state.config.manualPvp[r.ref] : null;
      const pvpTitle = c.isManual ? 'PVP fijado manualmente' : '';

      tr.innerHTML = `
        <td>${escapeHtml(r.ref)}</td>
        <td>${statusChip}</td>
        <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(r.description, 60))}</td>
        <td class="num liters"><input type="number" step="0.01" value="${r.liters ?? ''}" data-ref="${escapeHtml(r.ref)}" data-field="liters"></td>
        <td class="num" title="${escapeHtml(costTitle)}">${formatEur(r.costPerPack)}</td>
        <td class="num">${c.marginPct.toFixed(1)}%</td>
        <td class="num" title="${escapeHtml(pvpTitle)}"><strong${c.isManual ? ' style="color:#1a6bcf;"' : ''}>${formatEur(c.pvp)}</strong></td>
        <td class="num"><input type="number" step="0.01" value="${manualVal ?? ''}" placeholder="auto" data-ref="${escapeHtml(r.ref)}" data-field="manualPvp" style="width:74px;text-align:right;padding:0.1rem 0.3rem;margin:0;font-size:0.8rem;"></td>
        <td class="num">${formatEur(c.gain)}</td>
        <td class="num">${c.realMarginPct.toFixed(1)}%</td>
      `;
      frag.appendChild(tr);
    }
    tbody.innerHTML = '';
    tbody.appendChild(frag);

    // Listeners de edición de litros inline
    tbody.querySelectorAll('input[data-field="liters"]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const ref = e.target.dataset.ref;
        const v = parseFloat(e.target.value);
        const row = state.rows.find(r => r.ref === ref);
        if (row) {
          row.liters = isFinite(v) ? v : null;
          row.formatKey = Parser.formatKey(row.liters);
          row.litersDetected = row.liters != null;
          renderFormatConfig();
          renderFormatFilter();
          renderTable();
          renderKpis();
        }
      });
    });

    // Listeners de PVP manual inline — sobrescribe el cálculo por margen para esa ref.
    tbody.querySelectorAll('input[data-field="manualPvp"]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const ref = e.target.dataset.ref;
        const raw = e.target.value;
        if (!state.config.manualPvp) state.config.manualPvp = {};
        if (raw === '' || raw == null) {
          delete state.config.manualPvp[ref];
        } else {
          const v = parseFloat(raw);
          if (isFinite(v) && v > 0) state.config.manualPvp[ref] = v;
          else delete state.config.manualPvp[ref];
        }
        saveConfig();
        renderTable();
        renderKpis();
      });
    });

    // Aviso si hay más de MAX filas
    if (rows.length > MAX) {
      const note = document.createElement('tr');
      note.innerHTML = `<td colspan="10" style="text-align:center; padding:0.6rem; color: var(--pico-muted-color); font-style: italic;">
        Mostrando ${MAX} primeras filas (de ${rows.length}). Usa el buscador o los filtros para acotar.
      </td>`;
      tbody.appendChild(note);
    }
  }

  /* ----- render: banner de contexto histórico ----- */
  function renderHistoryBanner() {
    const b = $('historyBanner');
    const d = state.diff;
    if (!d) { b.classList.add('hidden'); return; }
    if (!d.hasPrevious) {
      b.className = 'history-banner first-time';
      b.innerHTML = `⚠ Sin tarifa anterior guardada para <strong>${escapeHtml(state.supplier)}</strong>. Todas las referencias se marcan como nuevas. Al exportar (o pulsar "Establecer como vigente") esta tarifa quedará como referencia para futuras comparaciones.`;
    } else {
      b.className = 'history-banner';
      const dt = d.previousTariffDate || d.previousDate;
      b.innerHTML = `📊 Comparando con la tarifa vigente de <strong>${escapeHtml(state.supplier)}</strong> del <strong>${escapeHtml(dt)}</strong>.`;
    }
    b.classList.remove('hidden');
  }

  /* ----- render: KPIs comparativos ----- */
  function renderKpis() {
    const d = state.diff || {
      total: state.rows.length, stable: 0, new: state.rows.length, obsolete: 0, obsoleteRefs: []
    };
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

    const noLiters = state.rows.filter(r => !r.litersDetected).length;
    if (noLiters > 0) {
      $('warningChip').classList.remove('hidden');
      $('warningText').textContent = `${noLiters} refs sin litros detectados`;
    } else {
      $('warningChip').classList.add('hidden');
    }
  }

  /* ----- render: modal refs obsoletas ----- */
  window.__openObsoleteModal = function() {
    const d = state.diff;
    if (!d || !d.obsoleteRefs || d.obsoleteRefs.length === 0) return;
    const ul = $('obsoleteList');
    ul.innerHTML = d.obsoleteRefs.map(r => {
      const desc = r.description ? escapeHtml(r.description) : '<em class="muted">(sin descripción)</em>';
      const cost = r.cost != null ? ` — ${formatEur(r.cost)}` : '';
      return `<li><strong>${escapeHtml(r.ref)}</strong>: ${desc}${cost}</li>`;
    }).join('');
    $('modalObsolete').classList.remove('hidden');
  };

  /* ----- render: fórmula según modo ----- */
  function renderFormula() {
    $('formulaText').textContent = Pricing.formulaText(state.config.marginMode);
    document.querySelectorAll('#screen-import .mode-btn[data-mode]').forEach(btn => {
      const active = btn.dataset.mode === state.config.marginMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    // Ampliar límite en el input por defecto cuando el modo es 'cost' (permite markups altos)
    const dm = $('defaultMargin');
    dm.max = state.config.marginMode === 'cost' ? 500 : 95;
  }

  /* ----- helpers ----- */
  function formatEur(v) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /** Persiste en el maestro (IndexedDB) las filas de esta importación, gama a gama. */
  function persistToMaster() {
    for (const gama of state.gamas) {
      const gamaRows = state.allRows.filter(r => r.gama === gama);
      if (!gamaRows.length) continue;
      MasterDB.putRows(state.supplierId, gama, gamaRows, 'factura')
        .then(() => {
          Storage.set(importMetaKey(gama), {
            importedAt: new Date().toISOString().slice(0, 10),
            tariffDate: state.tariffDate,
            rowCount: gamaRows.length
          });
          renderBrandCards();
        })
        .catch(err => console.error('MasterDB.putRows error', err));
    }
  }

  /* ----- handlers ----- */
  /** Carga una tarifa de proveedor soltada/elegida en la tarjeta de una marca concreta
   *  (ver ADR pendiente de UI por tarjeta). Si el proveedor detectado no coincide con la
   *  tarjeta donde se soltó, se avisa antes de continuar (fichero equivocado en la marca
   *  equivocada) — se carga igualmente bajo el proveedor real detectado, no bajo la marca
   *  de la tarjeta. */
  function handleBrandFiles(files, brandId) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const targetBrand = findBrand(brandId);
    $('loadStatus').classList.remove('hidden');
    $('loadStatus').innerHTML = `<small class="muted">Leyendo <strong>${escapeHtml(file.name)}</strong>…</small>`;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = ExcelReader.read(e.target.result, file.name);
        if (result.id && result.id !== brandId) {
          const detectedBrand = findBrand(result.id);
          const detectedLabel = detectedBrand ? detectedBrand.label : result.supplier;
          const targetLabel = targetBrand ? targetBrand.label : brandId;
          const proceed = confirm(`El fichero parece ser de ${detectedLabel}, no de ${targetLabel}. ¿Continuar de todos modos?`);
          if (!proceed) {
            $('loadStatus').innerHTML = `<small class="muted">Importación cancelada.</small>`;
            return;
          }
        }
        state.supplier = result.supplier;
        state.supplierId = result.id;
        state.gamas = (result.gamas && result.gamas.length) ? result.gamas : ['default'];
        state.allRows = result.rows;
        state.activeGama = state.gamas[0];
        state.rows = state.allRows.filter(r => r.gama === state.activeGama);

        // Comparar contra la tarifa vigente guardada (si existe), para la gama activa
        const previous = History.load(historyIdentifier());
        state.diff = History.diff(state.rows, previous, rebrandPairs());

        $('loadStatus').innerHTML = `<small class="muted">✓ <strong>${state.allRows.length}</strong> referencias cargadas de <strong>${escapeHtml(state.supplier)}</strong> (hoja <code>${escapeHtml(result.sheetUsed)}</code>).</small>`;
        $('mainLayout').classList.remove('hidden');
        loadConfig();
        $('defaultMargin').value = state.config.defaultMargin;
        $('rounding').value = state.config.rounding;
        if (!state.tariffDate) {
          state.tariffDate = new Date().toISOString().slice(0, 10);
          $('tariffDate').value = state.tariffDate;
        }
        renderFormula();
        renderGamaTabs();
        renderFormatConfig();
        renderFormatFilter();
        renderHistoryBanner();
        renderTable();
        renderKpis();
        persistToMaster();
      } catch (err) {
        console.error(err);
        $('loadStatus').innerHTML = `<small style="color: var(--pico-del-color);">❌ ${escapeHtml(err.message)}</small>`;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /** Zona central: reservada solo para el Excel de cruce de rebranding (SIRDI antigua ↔
   *  nueva, ver ADR 0009) — las tarifas de proveedor se cargan desde la tarjeta de su
   *  marca (ver handleBrandFiles). */
  function handleFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    $('loadStatus').classList.remove('hidden');
    $('loadStatus').innerHTML = `<small class="muted">Leyendo <strong>${escapeHtml(file.name)}</strong>…</small>`;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const testWb = XLSX.read(e.target.result, { type: 'array' });
        const bySupplier = RebrandMap.readRebrandExcel(testWb, null);
        if (Object.keys(bySupplier).length) {
          applyRebrandMap(bySupplier, file.name);
        } else {
          $('loadStatus').innerHTML = `<small style="color: var(--pico-del-color);">❌ No se han encontrado columnas de cruce de rebranding reconocibles en <strong>${escapeHtml(file.name)}</strong>. Para cargar una tarifa de proveedor, usa la zona de la tarjeta de esa marca.</small>`;
        }
      } catch (err) {
        console.error(err);
        $('loadStatus').innerHTML = `<small style="color: var(--pico-del-color);">❌ ${escapeHtml(err.message)}</small>`;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function setupDropZone() {
    const dz = $('dropZone');
    const input = $('fileInput');
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => handleFiles(e.target.files));
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('hover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('hover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('hover');
      handleFiles(e.dataTransfer.files);
    });
  }

  /** Zonas de carga por tarjeta de marca — event delegation sobre #brandGrid, ya que las
   *  tarjetas se regeneran por completo en cada renderBrandCards(). */
  function setupBrandDropZones() {
    const grid = $('brandGrid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const drop = e.target.closest('.brand-drop');
      if (!drop || e.target.matches('.brand-drop-input')) return;
      const input = drop.querySelector('.brand-drop-input');
      if (input) input.click();
    });
    grid.addEventListener('change', (e) => {
      const input = e.target.closest('.brand-drop-input');
      if (!input) return;
      handleBrandFiles(input.files, input.dataset.brandInput);
      input.value = '';
    });
    grid.addEventListener('dragover', (e) => {
      const drop = e.target.closest('.brand-drop');
      if (!drop) return;
      e.preventDefault();
      drop.classList.add('hover');
    });
    grid.addEventListener('dragleave', (e) => {
      const drop = e.target.closest('.brand-drop');
      if (!drop) return;
      drop.classList.remove('hover');
    });
    grid.addEventListener('drop', (e) => {
      const drop = e.target.closest('.brand-drop');
      if (!drop) return;
      e.preventDefault();
      drop.classList.remove('hover');
      handleBrandFiles(e.dataTransfer.files, drop.dataset.brandDrop);
    });
  }

  function setupConfigListeners() {
    // Toggle modo Venta / Compra
    document.querySelectorAll('#screen-import .mode-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.config.marginMode = btn.dataset.mode;
        saveConfig();
        renderFormula();
        renderTable();
        renderKpis();
      });
    });

    // Event delegation para inputs de margen por formato — sobrevive a re-renders.
    // Se escuchan 'input' (tecla a tecla) y 'change' (blur/enter) para máxima cobertura.
    const applyFormatMargin = (target) => {
      if (!target || !target.matches('input[data-format]')) return;
      const k = target.dataset.format;
      const raw = target.value;
      if (raw === '' || raw == null) {
        delete state.config.byFormat[k];
      } else {
        const v = parseFloat(raw);
        if (isFinite(v)) state.config.byFormat[k] = v;
        else delete state.config.byFormat[k];
      }
      saveConfig();
      renderTable();
      renderKpis();
    };
    $('formatConfig').addEventListener('input',  (e) => applyFormatMargin(e.target));
    $('formatConfig').addEventListener('change', (e) => applyFormatMargin(e.target));

    $('defaultMargin').addEventListener('input', (e) => {
      state.config.defaultMargin = parseFloat(e.target.value) || 0;
      saveConfig(); renderFormatConfig(); renderTable(); renderKpis();
    });
    $('rounding').addEventListener('change', (e) => {
      state.config.rounding = e.target.value;
      saveConfig(); renderTable(); renderKpis();
    });
    $('tariffDate').addEventListener('change', (e) => { state.tariffDate = e.target.value; });
    $('searchInput').addEventListener('input', (e) => { state.filter.text = e.target.value; renderTable(); });
    $('formatFilter').addEventListener('change', (e) => { state.filter.format = e.target.value; renderTable(); });
    $('statusFilter').addEventListener('change', (e) => { state.filter.status = e.target.value; renderTable(); });

    $('btnExport').addEventListener('click', () => {
      try {
        const gamaLabel = state.activeGama !== 'default' ? ` ${GAMA_LABELS[state.activeGama] || state.activeGama}` : '';
        const exportName = `${state.supplier || 'proveedor'}${gamaLabel}`;
        const fname = ExcelWriter.exportSkrit(state.rows, state.config, exportName, state.tariffDate);
        // Auto-guardar como tarifa vigente al exportar (por gama activa)
        if (state.supplier && state.rows.length > 0) {
          History.save(historyIdentifier(), state.rows, state.tariffDate);
          // Refrescar diff con el nuevo estado guardado (ahora será "sin cambios pendientes")
          state.diff = History.diff(state.rows, History.load(historyIdentifier()), rebrandPairs());
          renderHistoryBanner(); renderKpis();
        }
        $('loadStatus').classList.remove('hidden');
        $('loadStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> y guardado como tarifa vigente.</small>`;
      } catch (err) {
        $('loadStatus').innerHTML = `<small style="color: var(--pico-del-color);">❌ Error al exportar: ${escapeHtml(err.message)}</small>`;
      }
    });

    $('btnSetCurrent').addEventListener('click', () => {
      if (!state.supplier || state.rows.length === 0) return;
      const label = state.activeGama !== 'default' ? `${state.supplier} (${GAMA_LABELS[state.activeGama] || state.activeGama})` : state.supplier;
      if (!confirm(`¿Establecer esta tarifa como la vigente para ${label}?\n\nLa próxima tarifa que cargues se comparará contra esta.`)) return;
      History.save(historyIdentifier(), state.rows, state.tariffDate);
      state.diff = History.diff(state.rows, History.load(historyIdentifier()), rebrandPairs());
      renderHistoryBanner(); renderKpis(); renderTable();
      $('loadStatus').classList.remove('hidden');
      $('loadStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Tarifa vigente de ${escapeHtml(label)} actualizada.</small>`;
    });

    // Pestañas de gama (Normal / Standard / Sport Car…)
    $('gamaTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-gama]');
      if (!btn) return;
      switchGama(btn.dataset.gama);
    });

    $('btnSaveProfile').addEventListener('click', () => {
      const name = prompt('Nombre del perfil (ej: "Repsol estándar 2026"):');
      if (!name) return;
      const profiles = Storage.get('profiles', {});
      profiles[name] = JSON.parse(JSON.stringify(state.config));
      Storage.set('profiles', profiles);
      alert('Perfil guardado: ' + name);
    });
    $('btnLoadProfile').addEventListener('click', () => {
      const profiles = Storage.get('profiles', {});
      const names = Object.keys(profiles);
      if (names.length === 0) { alert('No hay perfiles guardados.'); return; }
      const choice = prompt('Perfiles disponibles:\n\n' + names.map((n, i) => `${i + 1}. ${n}`).join('\n') + '\n\nEscribe el número del perfil a cargar:');
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= names.length) return;
      Object.assign(state.config, profiles[names[idx]]);
      saveConfig();
      $('defaultMargin').value = state.config.defaultMargin;
      $('rounding').value = state.config.rounding;
      renderFormula();
      renderFormatConfig(); renderTable(); renderKpis();
    });
    $('btnReset').addEventListener('click', () => {
      state.rows = [];
      state.allRows = [];
      state.supplier = null;
      state.supplierId = null;
      state.gamas = ['default'];
      state.activeGama = 'default';
      state.diff = null;
      $('mainLayout').classList.add('hidden');
      $('loadStatus').classList.add('hidden');
      $('fileInput').value = '';
    });
  }

  /** Guarda un Excel de cruce de rebranding (ver RebrandMap) ya parseado por marca. */
  function applyRebrandMap(bySupplier, filename) {
    const brands = Object.keys(bySupplier);
    for (const brand of brands) {
      RebrandMap.save(brand, bySupplier[brand]);
    }
    $('loadStatus').innerHTML = brands.length
      ? `<small class="muted">✓ Mapa de rebranding cargado de <strong>${escapeHtml(filename)}</strong>: ${escapeHtml(brands.map(b => `${b} (${bySupplier[b].length})`).join(', '))}.</small>`
      : `<small style="color: var(--pico-del-color);">❌ No se han encontrado columnas de cruce reconocibles en <strong>${escapeHtml(filename)}</strong>.</small>`;
    // Si la tarifa activa es de una marca recién cargada, recalcula el diff en vivo.
    if (state.supplierId && bySupplier[state.supplier?.toUpperCase()]) {
      const previous = History.load(historyIdentifier());
      state.diff = History.diff(state.rows, previous, rebrandPairs());
      renderHistoryBanner(); renderKpis(); renderTable();
    }
  }

  function init() {
    renderBrandCards();
    setupDropZone();
    setupBrandDropZones();
    setupConfigListeners();
    loadConfig();
    $('defaultMargin').value = state.config.defaultMargin;
    $('rounding').value = state.config.rounding;
    renderFormula();
    state.tariffDate = new Date().toISOString().slice(0, 10);
    $('tariffDate').value = state.tariffDate;
  }

  return { init, renderBrandCards };
})();
