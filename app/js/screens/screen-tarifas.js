/* ============================================================================
   PANTALLA: TARIFAS
   ============================================================================
   Selección de marca + gama (como Reglas/Comparación/Exportación) y lectura
   directa del maestro (MasterDB) — NO depende de haber importado algo en esta
   misma sesión: sirve para volver a ver la tarifa de cualquier marca ya
   importada en cualquier momento anterior, no solo la última. `LoadedTariff`
   (ver `loaded-tariff.js`) se usa solo como atajo de conveniencia: si se
   acaba de soltar un fichero en Importación, Tarifas salta automáticamente a
   esa marca/gama al llegar.

   Esta pantalla muestra la tarifa ENTRANTE tal cual llega del proveedor, sin
   ningún cálculo de margen — solo Referencia, Estado (nueva/estable/rebrand),
   Producto, Litros y Coste de envase. El margen/PVP se configura en Reglas y
   el listado final calculado (PVP, ganancia, margen real…) se ve en
   Exportación, según el tipo de exportación elegido (ver ADR 0022).
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

  let currentBrandId = '';
  let currentGama = 'default'; // gama real, o '__all__'
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

  function importMetaKey(brandId, gama) {
    return `import_meta_${brandId}_${gama}_factura`;
  }
  function historyIdentifierFor(brand, gama) {
    return gama === 'default' ? brand.label : `${brand.label} ${gama}`;
  }
  function tariffDateFor(brandId, gama) {
    const meta = Storage.get(importMetaKey(brandId, gama), null);
    return (meta && (meta.tariffDate || meta.importedAt)) || new Date().toISOString().slice(0, 10);
  }

  /** Filas del maestro para una marca/gama, con un alias `costPerPack` = `costFactura`
   *  (History.save/diff siguen comparando por ese campo, igual que en el resto de la
   *  app — ver ADR 0008/0020). */
  async function fetchMasterRows(brandId, gama) {
    const raw = await MasterDB.getByBrand(brandId, gama);
    return raw.map(r => Object.assign({}, r, { costPerPack: r.costFactura }));
  }

  /** Filas de una gama real YA anotadas con `_status`/`_rebrandedFrom`/`_prevCost` por
   *  `History.diff` (mutación en las mismas filas que se van a pintar — antes se hacía
   *  el diff sobre una copia distinta a la que se mostraba en pantalla, y la columna
   *  "Estado" se quedaba vacía). */
  async function loadRowsWithStatus(brand, gama) {
    const rows = await fetchMasterRows(brand.id, gama);
    const previous = History.load(historyIdentifierFor(brand, gama));
    const d = History.diff(rows, previous, RebrandMap.load(brand.id));
    return { rows, diff: d };
  }

  /** "Todas" las gamas de golpe: cada gama se compara contra su propia tarifa vigente
   *  anterior (no existe una única "anterior" combinada) y se agregan los totales. */
  async function loadAllGamasWithStatus(brand) {
    let total = 0, stable = 0, neu = 0, obsolete = 0, obsoleteRefs = [], hasPrevious = false;
    const allRows = [];
    for (const g of brand.gamas) {
      const { rows: gRows, diff: d } = await loadRowsWithStatus(brand, g);
      total += d.total; stable += d.stable; neu += d.new; obsolete += d.obsolete;
      obsoleteRefs = obsoleteRefs.concat(d.obsoleteRefs || []);
      if (d.hasPrevious) hasPrevious = true;
      allRows.push(...gRows);
    }
    return { rows: allRows, diff: { total, stable, new: neu, obsolete, obsoleteRefs, hasPrevious, combined: true } };
  }

  /* ----- render: selects de marca/gama ----- */
  function renderBrandSelect() {
    const sel = $('tarifasBrandSelect');
    sel.innerHTML = '<option value="">Ninguna</option>'
      + BRANDS.filter(b => !b.pending).map(b => `<option value="${b.id}">${escapeHtml(b.label)}</option>`).join('');
    sel.value = currentBrandId;
    loadTariffData();
  }

  /* ----- render: pestañas de gama (+ "Todas") ----- */
  function renderGamaTabs() {
    const el = $('gamaTabs');
    const brand = findBrand(currentBrandId);
    if (!brand || !brand.gamas || brand.gamas.length <= 1) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    const allBtn = `<button type="button" class="mode-btn ${currentGama === '__all__' ? 'active' : ''}" data-gama="__all__" aria-pressed="${currentGama === '__all__'}">Todas</button>`;
    const gamaBtns = brand.gamas.map(g => `
      <button type="button" class="mode-btn ${g === currentGama ? 'active' : ''}" data-gama="${escapeHtml(g)}" aria-pressed="${g === currentGama}">
        ${escapeHtml(GAMA_LABELS[g] || g)}
      </button>
    `).join('');
    el.innerHTML = allBtn + gamaBtns;
  }

  function switchGama(gama) {
    if (gama === currentGama) return;
    const brand = findBrand(currentBrandId);
    if (!brand) return;
    if (gama !== '__all__' && !brand.gamas.includes(gama)) return;
    currentGama = gama;
    loadTariffData();
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
    const tbody = $('previewBody');
    const visible = visibleRows();
    $('visibleCount').textContent = visible.length;
    $('totalCount').textContent = rows.length;

    const MAX = 500;
    const slice = visible.slice(0, MAX);

    const frag = document.createDocumentFragment();
    for (const r of slice) {
      const tr = document.createElement('tr');

      const classes = [];
      if (!r.litersDetected) classes.push('warn');
      if (!r.costFactura || r.costFactura <= 0) classes.push('err');
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

      tr.innerHTML = `
        <td>${escapeHtml(r.ref)}</td>
        <td>${statusChip}</td>
        <td title="${escapeHtml(Parser.upperOut(r.description))}">${escapeHtml(truncate(Parser.upperOut(r.description), 60))}</td>
        <td class="num liters"><input type="number" step="0.01" value="${r.liters ?? ''}" data-ref="${escapeHtml(r.ref)}" data-field="liters"></td>
        <td class="num" title="${escapeHtml(costTitle)}">${formatEur(r.costFactura)}</td>
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
          row.formatKey = Parser.formatKey(row.liters);
          row.litersDetected = row.liters != null;
          renderFormatFilter();
          renderTable();
          renderKpis();
        }
      });
    });

    if (visible.length > MAX) {
      const note = document.createElement('tr');
      note.innerHTML = `<td colspan="5" style="text-align:center; padding:0.6rem; color: var(--pico-muted-color); font-style: italic;">
        Mostrando ${MAX} primeras filas (de ${visible.length}). Usa el buscador o los filtros para acotar.
      </td>`;
      tbody.appendChild(note);
    }
  }

  /* ----- render: banner de contexto histórico ----- */
  function renderHistoryBanner() {
    const b = $('historyBanner');
    const brand = findBrand(currentBrandId);
    if (!brand || !diff) { b.classList.add('hidden'); return; }
    if (currentGama === '__all__') {
      b.className = 'history-banner';
      b.innerHTML = diff.hasPrevious
        ? `📊 Vista combinada de todas las gamas de <strong>${escapeHtml(brand.label)}</strong> (cada gama comparada contra su propia tarifa vigente anterior).`
        : `⚠ Vista combinada de todas las gamas de <strong>${escapeHtml(brand.label)}</strong>. Ninguna tiene todavía tarifa anterior guardada — todas las referencias se marcan como nuevas.`;
    } else if (!diff.hasPrevious) {
      b.className = 'history-banner first-time';
      b.innerHTML = `⚠ Sin tarifa anterior guardada para <strong>${escapeHtml(brand.label)}</strong>. Todas las referencias se marcan como nuevas. Al pulsar "Establecer como vigente" esta tarifa quedará como referencia para futuras comparaciones.`;
    } else {
      b.className = 'history-banner';
      const dt = diff.previousTariffDate || diff.previousDate;
      b.innerHTML = `📊 Comparando con la tarifa vigente de <strong>${escapeHtml(brand.label)}</strong> del <strong>${escapeHtml(dt)}</strong>.`;
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

  /* ----- maestro de descripciones verificadas (ver ADR 0043/0044) ----- */

  let descValidationTab = 'pending'; // 'pending' | 'validated'

  /** Filas de la marca/gama actual que no están en el maestro (de fábrica ni corregidas
   *  a mano en este navegador) — `descVerified` lo pone `MasterDB.putRows`. */
  function pendingDescRows() {
    return rows.filter(r => !r.descVerified);
  }
  function validatedDescRows() {
    return rows.filter(r => r.descVerified);
  }

  /** Quita cualquier tamaño ya escrito al final del texto (100X125ML, 5L, 20KG…) antes
   *  de añadir el sufijo canónico — así da igual lo que Yako haya tecleado o traído del
   *  proveedor, el resultado siempre acaba en el mismo formato. */
  function stripTrailingSizeToken(desc) {
    return desc.replace(/\s*\d+(?:[.,]\d+)?\s*(ML|MLS|L|LT|LTR|LTRS|LITROS?|KG|KGS|GR|GRS|G)\s*$/i, '').trim();
  }

  /** Sufijo de litros homogéneo para toda descripción verificada — "5L"/"1000L" (sin
   *  espacio, mayúscula) o "230ML" por debajo de 1L, igual que ya usa la mayoría del
   *  maestro de fábrica (ver ADR 0044: Yako pide que sea siempre igual, sin
   *  inconsistencias entre marcas). */
  function canonicalLitersSuffix(liters) {
    if (liters == null || !isFinite(liters)) return '';
    if (liters < 1) return `${Math.round(liters * 1000)}ML`;
    return `${Number.isInteger(liters) ? liters : liters.toFixed(2)}L`;
  }

  /** Banner parpadeante mientras queden referencias sin descripción verificada — se
   *  calma solo cuando `pendingDescRows()` llega a cero. Clicable: abre el modal. */
  function renderDescValidationBanner() {
    const el = $('descValidationBanner');
    const pending = pendingDescRows();
    if (pending.length === 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `⚠ ${pending.length} referencia${pending.length > 1 ? 's' : ''} sin descripción verificada — <a>validar ahora →</a>`;
    el.onclick = () => openDescValidationModal('pending');
  }

  function descValidationRowHtml(r) {
    return `
      <div class="desc-validation-row" data-ref="${escapeHtml(r.ref)}">
        <div class="ref-col">${escapeHtml(r.ref)}</div>
        <div class="raw-col" title="Descripción actual">${escapeHtml(r.description ? Parser.upperOut(r.description) : '(sin descripción)')}</div>
        <input type="text" data-field="desc" value="${escapeHtml(Parser.upperOut(r.description || ''))}" placeholder="Descripción correcta">
        <input type="number" step="0.01" data-field="liters" value="${r.liters ?? ''}" placeholder="Litros">
        <button type="button" class="secondary-btn" data-action="save-desc">Guardar</button>
        <button type="button" class="secondary-btn" data-action="discard-desc" title="Esta referencia no existe como producto real">Eliminar</button>
      </div>
    `;
  }

  /** Repinta la lista del modal según la pestaña activa ('pending'/'validated') y el
   *  texto de búsqueda (solo aplica en "Ya validadas" — pendientes suele ser una lista
   *  corta, no hace falta filtrarla). */
  function renderDescValidationList() {
    const isValidated = descValidationTab === 'validated';
    $('descValidationSearch').classList.toggle('hidden', !isValidated);
    let list = isValidated ? validatedDescRows() : pendingDescRows();
    if (isValidated) {
      const q = $('descValidationSearch').value.trim().toLowerCase();
      if (q) list = list.filter(r => (r.ref + ' ' + (r.description || '')).toLowerCase().includes(q));
    }
    $('descValidationList').innerHTML = list.length
      ? list.map(descValidationRowHtml).join('')
      : `<p class="muted" style="font-size:0.85rem;">${isValidated ? 'Ninguna referencia validada todavía.' : '¡Todas las referencias de esta marca/gama están validadas!'}</p>`;
  }

  function renderDescValidationTabs() {
    const pendingCount = pendingDescRows().length;
    const validatedCount = validatedDescRows().length;
    $('descValidationTabs').innerHTML = `
      <button type="button" class="mode-btn ${descValidationTab === 'pending' ? 'active' : ''}" data-tab="pending" aria-pressed="${descValidationTab === 'pending'}">Pendientes (${pendingCount})</button>
      <button type="button" class="mode-btn ${descValidationTab === 'validated' ? 'active' : ''}" data-tab="validated" aria-pressed="${descValidationTab === 'validated'}">Ya validadas (${validatedCount})</button>
    `;
  }

  function openDescValidationModal(tab) {
    descValidationTab = tab || 'pending';
    $('descValidationSearch').value = '';
    renderDescValidationTabs();
    renderDescValidationList();
    $('modalDescValidation').classList.remove('hidden');
  }

  /** Guarda directamente en el maestro compartido (Neon, ver ADR 0054) — a diferencia de
   *  la lectura al importar, esto nunca degrada en silencio: si falla (sin conexión,
   *  sesión caducada), se avisa con un error visible y NO se aplica el cambio en local,
   *  para no fingir que quedó guardado cuando en realidad no llegó a la fuente
   *  compartida. */
  async function saveDescValidation(rowEl) {
    const ref = rowEl.dataset.ref;
    const descInput = rowEl.querySelector('input[data-field="desc"]');
    const litersInput = rowEl.querySelector('input[data-field="liters"]');
    let description = descInput.value.trim();
    if (!description) { descInput.focus(); return; }
    const litersVal = litersInput.value.trim();
    const liters = litersVal === '' ? null : parseFloat(litersVal);
    const litersOk = isFinite(liters) ? liters : null;

    // Mayúsculas siempre, sin importar cómo lo haya escrito Yako (ver ADR 0034/0051).
    description = Parser.upperOut(description);
    // Siempre el mismo formato de sufijo de litros en el texto, sin importar lo que
    // hubiera escrito antes (ver ADR 0044).
    description = stripTrailingSizeToken(description);
    const suffix = canonicalLitersSuffix(litersOk);
    if (suffix) description = `${description} ${suffix}`.trim();

    try {
      await NeonMaster.upsert(currentBrandId, ref, description, litersOk, false);
    } catch (err) {
      alert(`No se pudo guardar en el maestro compartido: ${err.message}`);
      return;
    }
    MasterCache.setLocal(currentBrandId, ref, description, litersOk, false);

    const row = rows.find(r => r.ref === ref);
    if (row) {
      row.description = description;
      row.liters = litersOk;
      row.formatKey = Parser.formatKey(row.liters);
      row.litersDetected = row.liters != null;
      row.descVerified = true;
      await MasterDB.putRows(currentBrandId, row.gama, [{ ref }], null);
    }

    renderFormatFilter();
    renderTable();
    renderKpis();
    renderDescValidationBanner();
    renderDescValidationTabs();
    renderDescValidationList();
    if (descValidationTab === 'pending' && pendingDescRows().length === 0) $('modalDescValidation').classList.add('hidden');
  }

  /** Marca una referencia como inválida en el maestro compartido (ver ADR 0048/0054) —
   *  nunca se borra la fila de Neon, solo se marca `is_invalid`, para no perder rastro.
   *  Mismo criterio de "falla alto, no en silencio" que `saveDescValidation`. */
  async function discardDescValidation(rowEl) {
    const ref = rowEl.dataset.ref;
    if (!confirm(`¿Eliminar "${ref}" del maestro? Se borrará esta referencia de la tarifa y no volverá a importarse.`)) return;

    try {
      await NeonMaster.upsert(currentBrandId, ref, null, null, true);
    } catch (err) {
      alert(`No se pudo guardar en el maestro compartido: ${err.message}`);
      return;
    }
    MasterCache.setLocal(currentBrandId, ref, null, null, true);

    const row = rows.find(r => r.ref === ref);
    const gama = row ? row.gama : (currentGama === '__all__' ? null : currentGama);
    if (gama != null) await MasterDB.deleteRow(currentBrandId, gama, ref);

    rows = rows.filter(r => r.ref !== ref);

    renderFormatFilter();
    renderTable();
    renderKpis();
    renderDescValidationBanner();
    renderDescValidationTabs();
    renderDescValidationList();
  }

  window.__openObsoleteModal = function() {
    const d = diff;
    if (!d || !d.obsoleteRefs || d.obsoleteRefs.length === 0) return;
    const ul = $('obsoleteList');
    ul.innerHTML = d.obsoleteRefs.map(r => {
      const desc = r.description ? escapeHtml(Parser.upperOut(r.description)) : '<em class="muted">(sin descripción)</em>';
      const cost = r.cost != null ? ` — ${formatEur(r.cost)}` : '';
      return `<li><strong>${escapeHtml(r.ref)}</strong>: ${desc}${cost}</li>`;
    }).join('');
    $('modalObsolete').classList.remove('hidden');
  };

  /* ----- carga desde el maestro (MasterDB) para la marca/gama actuales ----- */
  async function loadTariffData() {
    const brand = findBrand(currentBrandId);
    if (!brand) {
      // "Ninguna" — deja la pantalla limpia.
      rows = []; diff = null;
      $('tarifasTitle').textContent = '—';
      $('tarifasEmptyText').textContent = 'Elige una marca arriba para ver su tarifa.';
      $('tarifasEmpty').classList.remove('hidden');
      $('tarifasContent').classList.add('hidden');
      return;
    }
    $('tarifasTitle').textContent = brand.label;

    if (currentGama === '__all__') {
      const result = await loadAllGamasWithStatus(brand);
      rows = result.rows;
      diff = result.diff;
      $('tariffDateTarifas').disabled = true;
    } else {
      const result = await loadRowsWithStatus(brand, currentGama);
      rows = result.rows;
      diff = result.diff;
      $('tariffDateTarifas').disabled = false;
      $('tariffDateTarifas').value = tariffDateFor(brand.id, currentGama);
    }

    const empty = rows.length === 0;
    if (empty) $('tarifasEmptyText').innerHTML = 'Sin tarifa importada para esta marca/gama todavía. Ve a <a href="#import">Importación</a> y suelta un fichero en su tarjeta.';
    $('tarifasEmpty').classList.toggle('hidden', !empty);
    $('tarifasContent').classList.toggle('hidden', empty);
    if (empty) return;

    renderGamaTabs();
    renderFormatFilter();
    renderHistoryBanner();
    renderTable();
    renderKpis();
    renderDescValidationBanner();
    $('loadStatusTarifas').classList.add('hidden');
  }

  /** Si se acaba de cargar una tarifa en Importación, salta directamente a esa marca
   *  — solo la primera vez que se visita Tarifas tras esa carga (se consume y se limpia),
   *  para no forzar el salto de vuelta si el usuario ya eligió ver otra marca/gama.
   *  "Todas" por defecto, igual que al cambiar de marca a mano (ver ADR 0050/0058) — una
   *  sola regla, sin excepciones para el caso de venir de Importación. */
  function jumpToLoaded() {
    const loaded = LoadedTariff.get();
    if (!loaded) return;
    LoadedTariff.clear();
    currentBrandId = loaded.supplierId;
    currentGama = loaded.gamas && loaded.gamas.length ? '__all__' : 'default';
    $('tarifasBrandSelect').value = currentBrandId;
    loadTariffData();
  }

  function setupListeners() {
    $('tarifasBrandSelect').addEventListener('change', (e) => {
      currentBrandId = e.target.value;
      const brand = findBrand(currentBrandId);
      // "Todas" por defecto para cualquier marca, no la primera gama de la lista — Yako
      // pide que no induzca a confusión (antes se abría en una gama concreta, distinta
      // según la marca, sin ningún indicio de que hubiera más).
      currentGama = brand && brand.gamas.length ? '__all__' : 'default';
      loadTariffData();
    });
    $('gamaTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-gama]');
      if (!btn) return;
      switchGama(btn.dataset.gama);
    });
    $('searchInput').addEventListener('input', (e) => { filter.text = e.target.value; renderTable(); });
    $('formatFilter').addEventListener('change', (e) => { filter.format = e.target.value; renderTable(); });
    $('statusFilter').addEventListener('change', (e) => { filter.status = e.target.value; renderTable(); });
    $('tariffDateTarifas').addEventListener('change', (e) => {
      if (currentGama === '__all__') return;
      const meta = Storage.get(importMetaKey(currentBrandId, currentGama), { rowCount: rows.length });
      meta.tariffDate = e.target.value;
      Storage.set(importMetaKey(currentBrandId, currentGama), meta);
    });

    $('btnSetCurrent').addEventListener('click', async () => {
      const brand = findBrand(currentBrandId);
      if (!brand || !rows.length) return;
      const combined = currentGama === '__all__';
      const label = combined
        ? `${brand.label} (todas las gamas)`
        : (currentGama !== 'default' ? `${brand.label} (${GAMA_LABELS[currentGama] || currentGama})` : brand.label);
      if (!confirm(`¿Establecer esta tarifa como la vigente para ${label}?\n\nLa próxima tarifa que cargues se comparará contra esta.`)) return;
      const gamasToSave = combined ? brand.gamas : [currentGama];
      for (const g of gamasToSave) {
        const gRows = combined ? await fetchMasterRows(brand.id, g) : rows;
        History.save(historyIdentifierFor(brand, g), gRows, tariffDateFor(brand.id, g));
      }
      const refreshed = combined ? await loadAllGamasWithStatus(brand) : await loadRowsWithStatus(brand, currentGama);
      rows = refreshed.rows;
      diff = refreshed.diff;
      renderHistoryBanner(); renderKpis(); renderTable();
      renderDescValidationBanner();
      $('loadStatusTarifas').classList.remove('hidden');
      $('loadStatusTarifas').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Tarifa vigente de ${escapeHtml(label)} actualizada.</small>`;
    });

    $('btnBackToImport').addEventListener('click', () => {
      Router.show('import');
    });

    $('descValidationList').addEventListener('click', async (e) => {
      const saveBtn = e.target.closest('[data-action="save-desc"]');
      if (saveBtn) {
        saveBtn.disabled = true;
        await saveDescValidation(saveBtn.closest('.desc-validation-row'));
        return;
      }
      const discardBtn = e.target.closest('[data-action="discard-desc"]');
      if (discardBtn) {
        await discardDescValidation(discardBtn.closest('.desc-validation-row'));
      }
    });
    $('descValidationTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      descValidationTab = btn.dataset.tab;
      renderDescValidationTabs();
      renderDescValidationList();
    });
    $('descValidationSearch').addEventListener('input', renderDescValidationList);

    $('btnExportPending').addEventListener('click', async () => {
      const pending = pendingDescRows();
      if (!pending.length) { alert('No hay referencias pendientes de validar en esta marca/gama.'); return; }
      const brand = findBrand(currentBrandId);
      await ExcelWriter.exportPendingValidation(pending, brand ? brand.label : currentBrandId);
    });

    Store.on('tariff:loaded', () => { if (Router.current() === 'tarifas') jumpToLoaded(); });
    Store.on('screen:changed', (screen) => { if (screen === 'tarifas') jumpToLoaded(); });
    // Si se carga un mapa de rebranding para la marca que se está viendo, recalcula el
    // diff en vivo (los rebrands afectan a qué refs cuentan como "nuevas").
    Store.on('rebrand:loaded', async (brands) => {
      const brand = findBrand(currentBrandId);
      if (!brand || !brands.includes(brand.label.toUpperCase())) return;
      const refreshed = currentGama === '__all__' ? await loadAllGamasWithStatus(brand) : await loadRowsWithStatus(brand, currentGama);
      rows = refreshed.rows;
      diff = refreshed.diff;
      renderHistoryBanner(); renderKpis(); renderTable();
    });
  }

  function init() {
    setupListeners();
    renderBrandSelect();
  }

  return { init };
})();
