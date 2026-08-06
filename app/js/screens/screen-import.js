/* ============================================================================
   PANTALLA: IMPORTACIÓN
   ============================================================================
   Solo la cuadrícula de tarjetas por marca (estado de la última tarifa
   importada, leído de los metadatos `import_meta_*` en localStorage) y la
   carga de ficheros: cada tarjeta tiene su propia zona de arrastre para la
   tarifa de esa marca; la zona central es solo para el Excel de cruce de
   rebranding (SIRDI antigua ↔ nueva, ver ADR 0009). La vista de la tarifa ya
   cargada (tabla, filtros, KPIs, margen) vive en la pantalla Tarifas — esta
   pantalla solo lee el fichero, persiste en MasterDB, y entrega el resultado
   a `LoadedTariff` para que Tarifas lo muestre.
*/
const ScreenImport = (() => {

  /* ----- elementos del DOM ----- */
  const $ = (id) => document.getElementById(id);

  /* ----- etiquetas de gama, para las líneas de estado de las tarjetas ----- */
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

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** "2026-08-04" -> "04/08/26" — más corto para que quepa en una línea en la tarjeta de marca. */
  function formatShortDate(iso) {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso;
  }

  function importMetaKey(brandId, gama) {
    return `import_meta_${brandId}_${gama}_factura`;
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
            const meta = Storage.get(importMetaKey(b.id, g), null);
            const label = GAMA_LABELS[g] || (g.charAt(0).toUpperCase() + g.slice(1));
            const status = meta
              ? `<span class="status-ok">${meta.rowCount} refs · ${escapeHtml(formatShortDate(meta.tariffDate || meta.importedAt))}</span>`
              : `<span class="status-none">sin importar</span>`;
            return `<div class="line">${escapeHtml(label)}: ${status}</div>`;
          }).join('')
        : (() => {
            // Todas las gamas llegan juntas en el mismo Excel (una pestaña por
            // gama) — una sola línea resumen en vez de una por gama.
            let totalRows = 0, latestDate = null, anyImported = false;
            for (const g of b.gamas) {
              const meta = Storage.get(importMetaKey(b.id, g), null);
              if (!meta) continue;
              anyImported = true;
              totalRows += meta.rowCount || 0;
              const d = meta.tariffDate || meta.importedAt;
              if (d && (!latestDate || d > latestDate)) latestDate = d;
            }
            const status = anyImported
              ? `<span class="status-ok">${totalRows} refs · ${escapeHtml(formatShortDate(latestDate))}</span>`
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

  /** Persiste en el maestro (IndexedDB) las filas de esta importación, gama a gama, y
   *  actualiza los metadatos de la tarjeta de marca. */
  function persistToMaster(supplierId, gamas, allRows, tariffDate) {
    for (const gama of gamas) {
      const gamaRows = allRows.filter(r => r.gama === gama);
      if (!gamaRows.length) continue;
      MasterDB.putRows(supplierId, gama, gamaRows, 'factura')
        .then(() => {
          Storage.set(importMetaKey(supplierId, gama), {
            importedAt: new Date().toISOString().slice(0, 10),
            tariffDate,
            rowCount: gamaRows.length
          });
          renderBrandCards();
        })
        .catch(err => console.error('MasterDB.putRows error', err));
    }
  }

  /* ----- handlers ----- */
  /** Carga una tarifa de proveedor soltada/elegida en la tarjeta de una marca concreta.
   *  Si el proveedor detectado no coincide con la tarjeta donde se soltó, se avisa antes
   *  de continuar (fichero equivocado en la marca equivocada) — se carga igualmente bajo
   *  el proveedor real detectado, no bajo la marca de la tarjeta. */
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
        const gamas = (result.gamas && result.gamas.length) ? result.gamas : ['default'];
        const tariffDate = new Date().toISOString().slice(0, 10);
        $('loadStatus').innerHTML = `<small class="muted">✓ <strong>${result.rows.length}</strong> referencias cargadas de <strong>${escapeHtml(result.supplier)}</strong> (hoja <code>${escapeHtml(result.sheetUsed)}</code>). Abriendo en Tarifas…</small>`;
        persistToMaster(result.id, gamas, result.rows, tariffDate);
        LoadedTariff.set({
          supplier: result.supplier,
          supplierId: result.id,
          gamas,
          allRows: result.rows,
          tariffDate,
          sheetUsed: result.sheetUsed
        });
        Router.show('tarifas');
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

  /** Cruces de referencias ENTRE marcas (base de conocimiento de equivalencias, usada
   *  por Comparación) — se puede recargar aquí en vez de depender de recordar hacerlo
   *  desde esa pantalla cada vez que se actualiza o se abre en otro ordenador. Misma
   *  lógica que `ScreenCompare.handleKbFiles`. */
  function renderEquivStatus() {
    const el = $('equivStatus');
    if (!el) return;
    if (EquivalenceIndex.isLoaded()) {
      const idx = EquivalenceIndex.load();
      el.innerHTML = `<span class="status-ok">Base de conocimiento cargada: ${idx.groups.length} grupos (actualizada ${escapeHtml(idx.builtAt)}).</span>`;
    } else {
      el.innerHTML = `<span class="status-none">Base de conocimiento no cargada — necesaria para la pestaña Comparación.</span>`;
    }
  }

  async function handleEquivFiles(files) {
    if (!files || !files.length) return;
    $('equivStatus').innerHTML = '<small class="muted">Leyendo ficheros de equivalencias…</small>';
    try {
      const categories = [];
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const workbook = XLSX.read(buf, { type: 'array' });
        categories.push(EquivalenceReader.readKnownFile(file.name, workbook));
      }
      EquivalenceIndex.build(categories);
      renderEquivStatus();
    } catch (err) {
      console.error(err);
      $('equivStatus').innerHTML = `<small style="color: var(--pico-del-color);">❌ ${escapeHtml(err.message)}</small>`;
    }
  }

  function setupEquivDropZone() {
    const dz = $('equivDropZone');
    const input = $('equivFileInput');
    if (!dz || !input) return;
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => { handleEquivFiles(e.target.files); input.value = ''; });
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('hover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('hover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('hover');
      handleEquivFiles(e.dataTransfer.files);
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

  /** Guarda un Excel de cruce de rebranding (ver RebrandMap) ya parseado por marca. */
  function applyRebrandMap(bySupplier, filename) {
    const brands = Object.keys(bySupplier);
    for (const brand of brands) {
      RebrandMap.save(brand, bySupplier[brand]);
    }
    $('loadStatus').innerHTML = brands.length
      ? `<small class="muted">✓ Mapa de rebranding cargado de <strong>${escapeHtml(filename)}</strong>: ${escapeHtml(brands.map(b => `${b} (${bySupplier[b].length})`).join(', '))}.</small>`
      : `<small style="color: var(--pico-del-color);">❌ No se han encontrado columnas de cruce reconocibles en <strong>${escapeHtml(filename)}</strong>.</small>`;
    Store.emit('rebrand:loaded', brands);
  }

  function init() {
    renderBrandCards();
    setupDropZone();
    setupBrandDropZones();
    setupEquivDropZone();
    renderEquivStatus();
    Store.on('screen:changed', (screen) => { if (screen === 'import') { renderBrandCards(); renderEquivStatus(); } });
  }

  return { init, renderBrandCards };
})();
