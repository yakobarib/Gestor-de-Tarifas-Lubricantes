/* ============================================================================
   PANTALLA: EXPORTACIÓN
   ============================================================================
   Elegir marca + gama + tipo de exportación, revisar el listado final
   calculado (con las mismas reglas de REGLAS) en una tabla en pantalla, y
   exportar exactamente esas filas — filtradas por los mismos filtros de
   búsqueda/formato/estado que se vean en pantalla (ver ADR 0031). "Tipo de
   exportación" es una lista plana: el nivel PVP en 3 salidas (Venta = tabla
   rica editable; Skrit = Excel mínimo de 6 columnas listo para subir; Imprimir
   = PDF sin coste para cliente/comercial), Netos Bonus (mismo formato Skrit
   de 9 columnas de siempre, pero solo los formatos marcados "Salida impresa",
   ver ADR 0026 v2), y los listados simples sin margen (Neto Factura,
   Neto-Neto, Triple Neto, y "Valor Regalo 1+1" cuando algún formato de PVP
   tiene el modo "1+2" activado). Gama admite "Todas" (por defecto) además de
   cada gama suelta — para niveles, se resuelve fila a fila según la gama real
   de cada fila, porque cada gama puede tener ese mismo nivel configurado con
   un margen distinto (ver ADR 0021/0022).
*/
const ScreenExport = (() => {
  const $ = (id) => document.getElementById(id);
  let currentBrandId = '';
  let currentGama = 'default';
  let currentOption = ''; // 'level:<id>' | 'skrit:pvp' | 'print:pvp' | 'list:neto_factura' | 'list:neto_neto'
  let rows = [];
  let filter = { text: '', format: '', status: '' };

  const GAMA_LABELS = { normal: 'Normal', standard: 'Standard', sportcar: 'Sport Car', quimico: 'Químicos', default: 'General', automocion: 'Automoción', industria: 'Industria', 'productos-de-mantenimiento': 'Productos de Mantenimiento', marinos: 'Marinos', grasas: 'Grasas', alimentarios: 'Alimentarios', 'v-ligero': 'V. Ligero', 'v-pesado': 'V. Pesado', agricola: 'Agrícola', transmision: 'Transmisión', hidraulicos: 'Hidráulicos', grasa: 'Grasa', moto: 'Moto', classic: 'Classic', marina: 'Marina', anticogelante: 'Anticongelante', aditivos: 'Aditivos', advance: 'Advance', 'air-tool': 'Air Tool', corena: 'Corena', diala: 'Diala', gadinia: 'Gadinia', gadus: 'Gadus', 'heat-transfer': 'Heat Transfer', helix: 'Helix', hydraulic: 'Hydraulic', morlina: 'Morlina', omala: 'Omala', ondina: 'Ondina', 'paper-mach': 'Paper Mach', refrigeration: 'Refrigeration', rimula: 'Rimula', sirius: 'Sirius', spirax: 'Spirax', tegula: 'Tegula', tellus: 'Tellus', tonna: 'Tonna', transmission: 'Transmission', turbo: 'Turbo', 'vacuum-pump': 'Vacuum Pump', other: 'Other', crb: 'CRB', edge: 'EDGE', gtx: 'GTX', 'gtx-5w': 'GTX 5W', magnatec: 'Magnatec', 'castrol-on': 'Castrol ON', transmax: 'Transmax', vecton: 'Vecton' };

  // "Neto Factura" / "Neto-Neto" son listados simples (sin cálculo de margen, ver
  // conversación con Yako 2026-07-31) — no usan `priceLevels`, solo el coste tal cual.
  // `columnHeader` (si difiere de `label`) es el texto de la columna de coste, en
  // pantalla y en el Excel (ahí en mayúsculas) — pedido explícito de Yako para
  // diferenciar el propio coste ("Neto-Neto") de la columna que lo muestra ("Compra
  // Neto-Neto"), ver ADR 0035.
  const PRICE_LIST_TYPES = {
    neto_factura: { costField: 'costFactura', label: 'Neto Factura', columnHeader: 'Compra Factura' },
    neto_neto: { costField: 'costNetoNeto', label: 'Neto-Neto', columnHeader: 'Compra Neto-Neto' },
    triple_neto: { costField: 'costTripleNeto', label: 'Triple Neto', columnHeader: 'Compra Triple-Neto' }
  };

  /** Nombre de "tipo" tal como debe aparecer en el fichero exportado — distinto, en
   *  algunos casos, de la etiqueta que se ve en el desplegable o en la cabecera del
   *  Excel (ej. "Triple Neto" en pantalla, "Triple-Neto" en el fichero) — ver ADR 0035.
   *  Clave = valor de `currentOption` ("kind:key"). */
  const EXPORT_FILE_TYPE_LABELS = {
    'level:pvp': 'PVP Venta',
    'skrit:pvp': 'PVP SKRIT',
    'print:pvp': 'PVP Comerciales',
    'print:netos_bonus': 'PVP Bonus',
    'level:netos_gasolineras': 'Neto Gasolineras',
    'list:neto_factura': 'Neto Factura',
    'list:neto_neto': 'Neto-Neto',
    'list:triple_neto': 'Triple-Neto',
    'list:regalo_1x1': 'Valor Regalo 1+1'
  };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatEur(v) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  /** Descripción renombrada (ej. Repsol, ver ADR 0013) si existe, si no la original —
   *  la que de verdad sale en cualquier tarifa de salida (Skrit, Excel o PDF), en
   *  mayúsculas (ver ADR 0034 — homogeneiza entre marcas que entran en minúsculas). */
  function exportDescription(r) { return Parser.upperOut(r.descriptionExport || r.description || ''); }
  /** Referencia de salida sin el prefijo de marca, mayúsculas y sin espacios (ADR 0034). */
  function exportRef(r, brandAbbr) {
    const upper = Parser.upperRef(r.ref);
    return upper.startsWith(brandAbbr) ? upper.slice(brandAbbr.length) : upper;
  }

  /** Input de "PVP manual" — ver ADR 0066: disponible en cualquier vista previa con
   *  PVP (no solo "PVP (Ventas)"), fijar un precio a mano es la misma acción tenga la
   *  pestaña que tenga el usuario delante. Resaltado (`is-manual`) cuando ya hay un
   *  valor puesto — dinero, no debe pasar desapercibido. */
  function manualPvpInputHtml(ref, gama, levelId, manualVal) {
    return `<input type="number" step="0.01" value="${manualVal ?? ''}" placeholder="auto" data-ref="${escapeHtml(ref)}" data-gama="${escapeHtml(gama)}" data-level="${escapeHtml(levelId)}" data-field="manualPvp" class="manual-pvp-input${manualVal != null ? ' is-manual' : ''}" style="width:74px;text-align:right;padding:0.1rem 0.3rem;margin:0;font-size:0.8rem;">`;
  }

  /** Conecta todos los inputs de "PVP manual" de una tabla ya pintada — mismo mecanismo
   *  para las 3 vistas previas que lo ofrecen (Skrit, Ventas, Netos Bonus). */
  function bindManualPvpInputs(tbody) {
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

  /** Acumula "huecos" de datos (litros/descripción/precio) de las filas visibles del
   *  tipo de exportación activo — ver ADR 0034. Un mismo array de errores se reutiliza
   *  fila a fila en cada rama de `renderPreviewTable`. */
  function newErrorTally() { return { noLiters: 0, noDescription: 0, noPrice: 0 }; }
  function trackRowErrors(tally, r, priceMissing) {
    if (r.liters == null) tally.noLiters++;
    if (!r.description || !String(r.description).trim()) tally.noDescription++;
    if (priceMissing) tally.noPrice++;
  }
  /** Recuento de filas visibles: verde pastel si coincide con el total (sin filtrar),
   *  amarillo pastel si hay un filtro reduciendo lo que se ve — ver ADR 0034. */
  function updateCountBox(visibleLen, totalLen) {
    $('exportVisibleCount').textContent = visibleLen;
    const box = $('exportVisibleCount').closest('.export-count-box');
    if (box) box.classList.toggle('filtered', visibleLen !== totalLen);
  }
  function renderErrorsBox(tally) {
    const el = $('exportErrorsBox');
    if (!el) return;
    const parts = [];
    if (tally.noLiters) parts.push(`${tally.noLiters} sin litros`);
    if (tally.noDescription) parts.push(`${tally.noDescription} sin descripción`);
    if (tally.noPrice) parts.push(`${tally.noPrice} sin precio`);
    const hasErrors = parts.length > 0;
    el.classList.toggle('has-errors', hasErrors);
    el.innerHTML = hasErrors
      ? `⚠ Errores en la tarifa: <strong>${parts.join(', ')}</strong>`
      : 'Sin errores detectados en la tarifa.';
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
    let cfg = RulesStore.load(brandId, gama);
    let isNew = false;
    if (!cfg) { cfg = { defaultMargin: 30, byFormat: {}, rounding: '2dec', marginMode: 'sale', manualPvp: {} }; isNew = true; }
    if (!cfg.priceLevels || !cfg.priceLevels.length) { cfg.priceLevels = [Migration.synthesizePvpLevel(cfg)]; isNew = true; }
    let level = cfg.priceLevels.find(l => l.id === levelId);
    if (!level && levelId === 'pvp') { level = Migration.synthesizePvpLevel(cfg); cfg.priceLevels.unshift(level); isNew = true; }
    if (isNew) RulesStore.save(brandId, gama, cfg);
    return level ? { cfg, level } : null;
  }

  function loadLevels(brandId, gama) {
    const cfg = RulesStore.load(brandId, gama);
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

  /** "Bidones y Cubas" para exportar (ver ADR 0064, adenda): no es una clasificación
   *  aparte — es literalmente el interruptor "PVP Neto en Bidones y Cubas" del nivel PVP
   *  (Yako confirmó que ambos conceptos son el mismo, tras probar una casilla separada).
   *  `{formatKey: true}` para cada formato con ese modo activo en esa marca/gama. */
  function bigContainerFormatsFor(brandId, gama) {
    const pvp = loadLevels(brandId, gama).find(l => l.id === 'pvp');
    const map = {};
    if (pvp && pvp.formatModes) {
      for (const [k, v] of Object.entries(pvp.formatModes)) {
        if (v === 'pvp_neto') map[k] = true;
      }
    }
    return map;
  }

  function bigContainerFormatsByGama(brandId, gamas) {
    const map = {};
    for (const g of gamas) map[g] = bigContainerFormatsFor(brandId, g);
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
    const { cfg, level } = found;
    if (!level.manualOverride) level.manualOverride = {};
    if (value == null) delete level.manualOverride[ref];
    else level.manualOverride[ref] = value;
    RulesStore.save(brandId, gama, cfg);
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
    // El nivel "pvp" se ofrece en 3 variantes con distinta salida (ver ADR 0031): la
    // vista rica de siempre para revisar/ajustar ("Venta"), un Excel mínimo listo para
    // Skrit sin columnas de auditoría ("Skrit"), y un PDF sin coste para entregar a
    // cliente/comercial ("Imprimir"). Los demás niveles (Netos Bonus) siguen igual.
    const entries = [];
    for (const l of levels) {
      if (l.id === 'pvp') {
        entries.push({ value: 'skrit:pvp', label: 'PVP (Skrit)' });
        entries.push({ value: 'level:pvp', label: 'PVP (Datos)' });
        entries.push({ value: 'print:pvp', label: 'PVP (Imprimir)' });
      } else if (l.id === 'netos_bonus') {
        // Consolidado en una sola opción (ver ADR 0072): antes había "Netos Bonus (uso
        // interno)" (Excel rico) Y "PVP (Bonus)" (PDF, ver ADR 0039) por separado — ahora
        // Netos Bonus usa siempre el formato PDF, "PVP (Bonus)" desaparece del desplegable.
        entries.push({ value: 'print:netos_bonus', label: `${l.label} (uso interno)` });
      } else {
        entries.push({ value: `level:${l.id}`, label: `${l.label}${l.goesToSkrit ? ' (Venta)' : ' (uso interno)'}` });
      }
    }
    for (const [key, spec] of Object.entries(PRICE_LIST_TYPES)) {
      entries.push({ value: `list:${key}`, label: `${spec.label} (Compra)` });
    }
    // "Valor Regalo 1+1" solo se ofrece si algún formato de PVP tiene el modo "1+2"
    // activado en al menos una gama de esta marca (en "Todas") o en la gama elegida.
    if (has1x2) {
      entries.push({ value: 'list:regalo_1x1', label: 'Valor Regalo 1+1 (Compra)' });
    }
    // Orden alfabético por etiqueta (pedido por Yako) — así el desplegable se reordena
    // solo si en el futuro se añade/renombra algún tipo de exportación, sin tocar aquí.
    entries.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    sel.innerHTML = entries.map(e => `<option value="${e.value}">${escapeHtml(e.label)}</option>`).join('');
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
    // Reconstruir las opciones deja el select sin selección — el resaltado verde debe
    // reflejar eso, no un filtro anterior que ya no aplica (ver ADR 0034).
    sel.classList.toggle('filter-active', !!sel.value);
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
      // Sin columna Estado: el Excel exportado tampoco la tiene (ver ADR 0034, WYSIWYG).
      thead.innerHTML = `<tr><th>Marca</th><th>Referencia</th><th>Producto</th><th class="num liters">Litros</th><th class="num">Valor Regalo 1+1</th></tr>`;
      updateCountBox(visible.length, rows.length);
      const levelCache = {};
      const levelFor = (gama) => (gama in levelCache) ? levelCache[gama] : (levelCache[gama] = pvpLevelFor(currentBrandId, gama));
      const tally = newErrorTally();
      const frag = document.createDocumentFragment();
      for (const r of visible.slice(0, 500)) {
        const level = levelFor(currentGama === '__all__' ? r.gama : currentGama);
        const value = regaloValueFor(r, level);
        r._regaloValue = value; // se reutiliza tal cual al exportar (WYSIWYG)
        trackRowErrors(tally, r, value == null);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(brand.abbr)}</td>
          <td>${escapeHtml(exportRef(r, brand.abbr))}</td>
          <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(exportDescription(r), 60))}</td>
          <td class="num liters">${r.liters ?? '—'}</td>
          <td class="num">${formatEur(value)}</td>
        `;
        if (value == null) tr.className = 'warn';
        frag.appendChild(tr);
      }
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      renderErrorsBox(tally);
      return;
    }

    if (kind === 'list') {
      const spec = PRICE_LIST_TYPES[key];
      // Sin columna Estado: el Excel exportado tampoco la tiene (ver ADR 0034, WYSIWYG).
      thead.innerHTML = `<tr><th>Marca</th><th>Referencia</th><th>Producto</th><th class="num liters">Litros</th><th class="num">${escapeHtml(spec.columnHeader || spec.label)}</th></tr>`;
      updateCountBox(visible.length, rows.length);
      const tally = newErrorTally();
      const frag = document.createDocumentFragment();
      for (const r of visible.slice(0, 500)) {
        const cost = r[spec.costField];
        trackRowErrors(tally, r, cost == null);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(brand.abbr)}</td>
          <td>${escapeHtml(exportRef(r, brand.abbr))}</td>
          <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(exportDescription(r), 60))}</td>
          <td class="num liters">${r.liters ?? '—'}</td>
          <td class="num">${formatEur(cost)}</td>
        `;
        if (cost == null) tr.className = 'warn';
        frag.appendChild(tr);
      }
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      renderErrorsBox(tally);
      return;
    }

    if (kind === 'skrit') {
      thead.innerHTML = `<tr><th>Marca</th><th>Referencia</th><th>Producto</th><th class="num liters">Litros</th><th>Familia</th><th>Bidones y Cubas</th><th class="num">Coste factura</th><th class="num">PVP</th><th class="num">PVP manual</th></tr>`;
      const byGama = currentGama === '__all__' ? loadLevelsByGama(currentBrandId, brand.gamas) : null;
      const levelCache = {};
      const levelFor = (gama) => {
        if (levelCache[gama]) return levelCache[gama];
        const lvl = byGama ? (byGama[gama] || []).find(l => l.id === 'pvp') : loadLevels(currentBrandId, currentGama).find(l => l.id === 'pvp');
        levelCache[gama] = lvl || null;
        return levelCache[gama];
      };
      const bigContainerCache = {};
      const bigContainerFor = (gama) => {
        if (bigContainerCache[gama]) return bigContainerCache[gama];
        return (bigContainerCache[gama] = bigContainerFormatsFor(currentBrandId, currentGama === '__all__' ? gama : currentGama));
      };
      updateCountBox(visible.length, rows.length);
      const tally = newErrorTally();
      const frag = document.createDocumentFragment();
      for (const r of visible.slice(0, 500)) {
        const level = levelFor(r.gama);
        const c = level ? Pricing.compute(r, level) : { pvp: null };
        const cost = level ? Pricing.resolveCost(r, level) : null;
        const isBigContainer = !!bigContainerFor(r.gama)[r.formatKey];
        trackRowErrors(tally, r, c.pvp == null);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(brand.abbr)}</td>
          <td>${escapeHtml(exportRef(r, brand.abbr))}</td>
          <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(exportDescription(r), 60))}</td>
          <td class="num liters">${r.liters ?? '—'}</td>
          <td>${escapeHtml(Parser.upperOut(r.fam) || '—')}</td>
          <td>${isBigContainer ? 'Sí' : '—'}</td>
          <td class="num">${formatEur(cost)}</td>
          <td class="num"><strong>${formatEur(c.pvp)}</strong></td>
          <td class="num">${manualPvpInputHtml(r.ref, r.gama, 'pvp', level && level.manualOverride ? level.manualOverride[r.ref] : null)}</td>
        `;
        if (c.pvp == null) tr.className = 'warn';
        frag.appendChild(tr);
      }
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      renderErrorsBox(tally);
      bindManualPvpInputs(tbody);
      return;
    }

    if (kind === 'print') {
      // "PVP (Imprimir)" usa siempre el nivel "pvp"; "PVP (Bonus)" (ver ADR 0039) usa
      // "netos_bonus" y, como su Excel, solo entran los formatos con "Salida impresa"
      // marcada — mismo criterio que la rama `key === 'netos_bonus'` de más abajo.
      const isBonus = key === 'netos_bonus';
      thead.innerHTML = isBonus
        ? `<tr><th>Referencia</th><th>Descripción</th><th class="num liters">Litros</th><th class="num">PVP Bonus</th></tr>`
        : `<tr><th>Referencia</th><th>Producto</th><th class="num liters">Litros</th><th class="num">PVP</th></tr>`;
      const byGama = currentGama === '__all__' ? loadLevelsByGama(currentBrandId, brand.gamas) : null;
      const levelCache = {};
      const levelFor = (gama) => {
        if (levelCache[gama]) return levelCache[gama];
        const lvl = byGama ? (byGama[gama] || []).find(l => l.id === key) : loadLevels(currentBrandId, currentGama).find(l => l.id === key);
        levelCache[gama] = lvl || null;
        return levelCache[gama];
      };
      if (isBonus) {
        visible = visible.filter(r => {
          const lvl = levelFor(r.gama);
          return lvl && lvl.printFormats && lvl.printFormats[r.formatKey];
        });
      }
      updateCountBox(visible.length, rows.length);
      const tally = newErrorTally();
      const frag = document.createDocumentFragment();
      for (const r of visible.slice(0, 500)) {
        const level = levelFor(r.gama);
        const c = level ? Pricing.compute(r, level) : { pvp: null };
        r._printPvp = c.pvp; // se reutiliza tal cual al generar el PDF (WYSIWYG)
        trackRowErrors(tally, r, c.pvp == null);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(Parser.upperRef(r.ref))}</td>
          <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(exportDescription(r), 60))}</td>
          <td class="num liters">${r.liters ?? '—'}</td>
          <td class="num"><strong>${formatEur(c.pvp)}</strong></td>
        `;
        if (c.pvp == null) tr.className = 'warn';
        frag.appendChild(tr);
      }
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      renderErrorsBox(tally);
      return;
    }

    // kind === 'level' && key en {'netos_bonus', 'netos_gasolineras'}: vista mínima
    // igual que el Excel exportado (ver ADR 0034) — sin Estado/margen/ganancia, que son
    // ayudas de edición exclusivas de PVP (Datos). "PVP manual" sí está disponible aquí
    // también (ver ADR 0066 — fijar un precio a mano ya no es exclusivo de esa vista).
    // Netos Gasolineras copia el patrón de Netos Bonus tal cual (ver ADR 0070).
    if (key === 'netos_bonus' || key === 'netos_gasolineras') {
      thead.innerHTML = `
        <tr>
          <th>Marca</th><th>Referencia</th><th>Producto</th><th class="num liters">Litros</th><th>Familia</th><th>Bidones y Cubas</th>
          <th class="num">Coste factura</th><th class="num">Coste neto-neto</th><th class="num">Coste triple neto</th><th class="num">PVP</th><th class="num">PVP manual</th>
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
      const bigContainerCache = {};
      const bigContainerFor = (gama) => {
        if (bigContainerCache[gama]) return bigContainerCache[gama];
        return (bigContainerCache[gama] = bigContainerFormatsFor(currentBrandId, currentGama === '__all__' ? gama : currentGama));
      };
      // Hoja impresa: solo entran los formatos marcados como "Salida impresa" en Reglas
      // para la gama real de cada fila (ver ADR 0026 v2).
      visible = visible.filter(r => {
        const lvl = levelFor(r.gama);
        return lvl && lvl.printFormats && lvl.printFormats[r.formatKey];
      });
      updateCountBox(visible.length, rows.length);
      const tally = newErrorTally();
      const frag = document.createDocumentFragment();
      for (const r of visible.slice(0, 500)) {
        const level = levelFor(r.gama);
        const c = level ? Pricing.compute(r, level) : { pvp: null };
        const isBigContainer = !!bigContainerFor(r.gama)[r.formatKey];
        trackRowErrors(tally, r, c.pvp == null);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(brand.abbr)}</td>
          <td>${escapeHtml(exportRef(r, brand.abbr))}</td>
          <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(exportDescription(r), 60))}</td>
          <td class="num liters">${r.liters ?? '—'}</td>
          <td>${escapeHtml(Parser.upperOut(r.fam) || '—')}</td>
          <td>${isBigContainer ? 'Sí' : '—'}</td>
          <td class="num">${formatEur(r.costFactura)}</td>
          <td class="num">${formatEur(r.costNetoNeto)}</td>
          <td class="num">${formatEur(r.costTripleNeto)}</td>
          <td class="num"><strong>${formatEur(c.pvp)}</strong></td>
          <td class="num">${manualPvpInputHtml(r.ref, r.gama, key, level && level.manualOverride ? level.manualOverride[r.ref] : null)}</td>
        `;
        if (c.pvp == null) tr.className = 'warn';
        frag.appendChild(tr);
      }
      tbody.innerHTML = '';
      tbody.appendChild(frag);
      renderErrorsBox(tally);
      bindManualPvpInputs(tbody);
      return;
    }

    // kind === 'level' && key === 'pvp' — vista rica para revisar/ajustar antes de
    // exportar (margen, PVP manual, ganancia y margen real no salen en el Excel — única
    // exención al WYSIWYG estricto, decisión explícita de Yako, ver ADR 0034).
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
    updateCountBox(visible.length, rows.length);

    const tally = newErrorTally();
    const frag = document.createDocumentFragment();
    for (const r of visible.slice(0, 500)) {
      const level = levelFor(r.gama);
      const tr = document.createElement('tr');
      if (!level) {
        trackRowErrors(tally, r, true);
        tr.innerHTML = `<td>${escapeHtml(Parser.upperRef(r.ref))}</td><td></td><td title="${escapeHtml(r.description)}">${escapeHtml(truncate(exportDescription(r), 60))}</td><td class="num liters">${r.liters ?? '—'}</td><td class="num">${formatEur(r.costFactura)}</td><td colspan="5" class="muted" style="font-style:italic;">nivel no configurado en esta gama</td>`;
        frag.appendChild(tr);
        continue;
      }
      const c = Pricing.compute(r, level);
      trackRowErrors(tally, r, c.pvp == null);
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
        <td>${escapeHtml(Parser.upperRef(r.ref))}</td>
        <td>${statusChip}</td>
        <td title="${escapeHtml(r.description)}">${escapeHtml(truncate(exportDescription(r), 60))}</td>
        <td class="num liters">${r.liters ?? '—'}</td>
        <td class="num">${formatEur(r.costFactura)}</td>
        <td class="num">${c.marginPct != null ? c.marginPct.toFixed(1) + '%' : '—'}</td>
        <td class="num" title="${escapeHtml(pvpTitle)}"><strong${c.isManual ? ' style="color:#1a6bcf;"' : ''}>${formatEur(c.pvp)}</strong></td>
        <td class="num">${manualPvpInputHtml(r.ref, r.gama, key, manualVal)}</td>
        <td class="num">${formatEur(c.gain)}</td>
        <td class="num">${c.realMarginPct != null ? c.realMarginPct.toFixed(1) + '%' : '—'}</td>
      `;
      frag.appendChild(tr);
    }
    tbody.innerHTML = '';
    tbody.appendChild(frag);
    renderErrorsBox(tally);
    bindManualPvpInputs(tbody);
  }

  async function doExport() {
    const brand = findBrand(currentBrandId);
    if (!brand) { alert('Elige una marca antes de exportar.'); return; }
    if (!currentOption) { alert('Elige un tipo de exportación.'); return; }
    if (!rows.length) { alert('No hay tarifa importada para esta marca/gama en el maestro.'); return; }
    const tariffDate = $('exportTariffDate').value || new Date().toISOString().slice(0, 10);
    const [kind, key] = currentOption.split(':');
    // Se exporta lo mismo que se ve filtrado en pantalla (búsqueda/formato/estado) — no
    // el maestro completo de esa marca/gama. Ver ADR 0031.
    const filtered = visibleRows();
    if (!filtered.length) { alert('No hay filas visibles con los filtros actuales.'); return; }

    if (kind === 'list' && key === 'regalo_1x1') {
      const withValue = filtered.filter(r => typeof r._regaloValue === 'number' && isFinite(r._regaloValue));
      if (!withValue.length) { alert('Ninguna referencia visible tiene el modo "1+2" activado en PVP y con coste auditado.'); return; }
      const fname = await ExcelWriter.exportPriceList(filtered, brand.abbr, '_regaloValue', 'Valor Regalo 1+1', tariffDate, EXPORT_FILE_TYPE_LABELS[currentOption]);
      $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${withValue.length} filas).</small>`;
      return;
    }

    if (kind === 'list') {
      const spec = PRICE_LIST_TYPES[key];
      const withCost = filtered.filter(r => typeof r[spec.costField] === 'number' && isFinite(r[spec.costField]));
      if (!withCost.length) { alert(`Ninguna referencia visible tiene "${spec.label}" auditado todavía.`); return; }
      const fname = await ExcelWriter.exportPriceList(filtered, brand.abbr, spec.costField, spec.label, tariffDate, EXPORT_FILE_TYPE_LABELS[currentOption], spec.columnHeader);
      $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${withCost.length} filas).</small>`;
      return;
    }

    // 'skrit' y 'print' usan el nivel de `key` ("pvp" para Skrit/Imprimir, "netos_bonus"
    // para "PVP (Bonus)", ver ADR 0039) — en "Todas" se resuelve fila a fila según la
    // gama real de cada fila, igual que 'level'.
    if (kind === 'skrit' || kind === 'print') {
      const byGama = currentGama === '__all__' ? loadLevelsByGama(currentBrandId, brand.gamas) : null;
      const levelForGama = (gama) => byGama ? (byGama[gama] || []).find(l => l.id === key) : loadLevels(currentBrandId, currentGama).find(l => l.id === key);
      const resolver = currentGama === '__all__' ? (row) => levelForGama(row.gama) : levelForGama(currentGama);
      if (kind === 'skrit') {
        const bigContainerByGama = currentGama === '__all__' ? bigContainerFormatsByGama(currentBrandId, brand.gamas) : null;
        const bigContainerResolver = currentGama === '__all__' ? (row) => bigContainerByGama[row.gama] : bigContainerFormatsFor(currentBrandId, currentGama);
        const fname = await ExcelWriter.exportSkritLean(filtered, brand.abbr, resolver, tariffDate, EXPORT_FILE_TYPE_LABELS[currentOption], bigContainerResolver);
        $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${filtered.length} filas).</small>`;
        return;
      }
      // 'print': solo las filas con PVP calculado (mismo criterio que la previsualización).
      // Se recalcula `_printPvp` aquí en vez de fiarse del último render de la tabla, por
      // si los filtros cambiaron sin repintar. "PVP (Bonus)" además solo incluye los
      // formatos marcados "Salida impresa" — mismo criterio que su Excel (ADR 0026 v2).
      const resolveLevel = typeof resolver === 'function' ? resolver : () => resolver;
      const isBonus = key === 'netos_bonus';
      let printable = filtered.filter(r => {
        const level = resolveLevel(r);
        const pvp = level ? Pricing.compute(r, level).pvp : null;
        r._printPvp = pvp;
        return pvp != null;
      });
      if (isBonus) {
        printable = printable.filter(r => {
          const lvl = resolveLevel(r);
          return lvl && lvl.printFormats && lvl.printFormats[r.formatKey];
        });
      }
      if (!printable.length) { alert(isBonus ? 'Ningún formato visible está marcado con "Salida impresa" en Netos Bonus.' : 'Ninguna referencia visible tiene PVP calculado.'); return; }
      const gamaLabel = currentGama === '__all__' ? '' : (GAMA_LABELS[currentGama] || currentGama);
      const pdfOpts = isBonus ? { title: 'Tarifa Netos Bonus', columns: ['Referencia', 'Descripción', 'Litros', 'PVP Bonus'] } : undefined;
      const fname = PdfWriter.exportPriceListPdf(printable, brand, gamaLabel, tariffDate, EXPORT_FILE_TYPE_LABELS[currentOption], pdfOpts);
      $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${printable.length} filas).</small>`;
      return;
    }

    // kind === 'level' — en "Todas" cada gama puede tener ese nivel con un margen
    // distinto, así que se resuelve fila a fila según la gama real de cada fila.
    const byGama = currentGama === '__all__' ? loadLevelsByGama(currentBrandId, brand.gamas) : null;
    const levelForGama = (gama) => byGama ? (byGama[gama] || []).find(l => l.id === key) : loadLevels(currentBrandId, currentGama).find(l => l.id === key);
    // Netos Bonus/Netos Gasolineras son hojas impresas: solo se exportan los formatos
    // marcados como "Salida impresa" para la gama real de cada fila (WYSIWYG con la
    // previsualización) — mismo patrón para las dos (ver ADR 0070).
    let exportRows = filtered;
    if (key === 'netos_bonus' || key === 'netos_gasolineras') {
      const levelLabel = key === 'netos_bonus' ? 'Netos Bonus' : 'Netos Gasolineras';
      exportRows = filtered.filter(r => { const lvl = levelForGama(r.gama); return lvl && lvl.printFormats && lvl.printFormats[r.formatKey]; });
      if (!exportRows.length) { alert(`Ningún formato visible está marcado con "Salida impresa" en ${levelLabel}.`); return; }
    }
    if (currentGama === '__all__') {
      const anyLevel = brand.gamas.map(g => levelForGama(g)).find(Boolean);
      // exportSkritV2 llama al resolver con la FILA, no con la gama — a diferencia de
      // levelForGama (que usamos arriba directamente con un string de gama para filtrar
      // por printFormats).
      const resolver = (row) => levelForGama(row.gama);
      const bigContainerByGama = bigContainerFormatsByGama(currentBrandId, brand.gamas);
      const bigContainerResolver = (row) => bigContainerByGama[row.gama];
      const fname = await ExcelWriter.exportSkritV2(exportRows, brand.abbr, resolver, tariffDate, EXPORT_FILE_TYPE_LABELS[currentOption], bigContainerResolver);
      $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${exportRows.length} filas, nivel "${escapeHtml(anyLevel ? anyLevel.label : key)}", todas las gamas).</small>`;
      return;
    }
    const level = levelForGama(currentGama);
    if (!level) { alert('Ese nivel ya no existe para esta marca/gama.'); return; }
    const bigContainerResolver = bigContainerFormatsFor(currentBrandId, currentGama);
    const fname = await ExcelWriter.exportSkritV2(exportRows, brand.abbr, level, tariffDate, EXPORT_FILE_TYPE_LABELS[currentOption], bigContainerResolver);
    $('exportStatus').innerHTML = `<small style="color: var(--pico-ins-color);">✓ Exportado: <strong>${escapeHtml(fname)}</strong> (${exportRows.length} filas, nivel "${escapeHtml(level.label)}").</small>`;
  }

  function setupListeners() {
    $('exportBrandSelect').addEventListener('change', (e) => { currentBrandId = e.target.value; renderGamaSelect(); });
    $('exportGamaSelect').addEventListener('change', (e) => { currentGama = e.target.value; renderExportOptions(); });
    $('exportTypeSelect').addEventListener('change', (e) => { currentOption = e.target.value; renderPreview(); });
    $('exportSearchInput').addEventListener('input', (e) => { filter.text = e.target.value; renderPreviewTable(); });
    $('exportFormatFilter').addEventListener('change', (e) => {
      filter.format = e.target.value;
      e.target.classList.toggle('filter-active', !!e.target.value);
      renderPreviewTable();
    });
    $('exportStatusFilter').addEventListener('change', (e) => {
      filter.status = e.target.value;
      e.target.classList.toggle('filter-active', !!e.target.value);
      renderPreviewTable();
    });
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
