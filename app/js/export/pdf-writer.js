/* ============================================================================
   MÓDULO: pdfWriter  (listado de precios "bonito para imprimir", ver ADR 0031)
   ============================================================================
   A diferencia de los Excel de exportSkritV2/exportSkritLean (documentos de
   trabajo/auditoría, con coste y margen), este PDF es para entregar a un
   cliente o comercial: solo Referencia/Producto/Litros/PVP, sin ningún coste
   interno. Usa jsPDF + jspdf-autotable (CDN, ver index.html).
   ============================================================================ */
const PdfWriter = (() => {
  // Color de cabecera específico de este PDF (ver ADR 0033) — independiente de
  // `brand.color` (usado en otras partes de la UI, ej. la tarjeta de Importación),
  // porque Yako lo pidió solo "para la selección PVP (Imprimir)". Las marcas sin
  // entrada aquí (hoy solo Castrol) caen a `brand.color` de siempre.
  const HEADER_COLOR_BY_BRAND = {
    ad_parts_aceite: '#3b82f6', // azul AD
    repsol: '#f97316',          // naranja Repsol
    shell: '#eab308',           // amarillo Shell
    eni: '#38bdf8',             // azul claro Eni Live
    racing_oil: '#6b7280'       // gris medio
  };

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [51, 65, 85];
  }

  function formatEurPdf(v) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  /** `rows` ya vienen filtradas por pantalla y con `_printPvp` calculado (WYSIWYG, ver
   *  ADR 0023) — aquí solo se maqueta. `gamaLabel` es null/'' para "Todas las gamas".
   *  `opts.title`/`opts.columns` permiten reusar el mismo maquetado para "PVP (Bonus)"
   *  (ver ADR 0039) sin duplicar la función — por defecto, el de "PVP (Imprimir)". */
  function exportPriceListPdf(rows, brand, gamaLabel, tariffDate, typeLabel, opts) {
    const cfg = opts || {};
    const title = cfg.title || 'Tarifa de venta';
    const columns = cfg.columns || ['Referencia', 'Producto', 'Litros', 'PVP'];
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const accent = hexToRgb(HEADER_COLOR_BY_BRAND[brand.id] || brand.color);
    const dateStr = tariffDate || new Date().toISOString().slice(0, 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text(`${title} — ${brand.label}`, 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(`${gamaLabel ? gamaLabel + ' · ' : ''}Vigente a ${dateStr} · Recambios Ibiza`, 14, 24);

    // Mayúsculas y ref sin espacios (ver ADR 0034) — homogeneiza entre marcas que
    // entran con distinta capitalización/espaciado.
    const body = rows.map(r => [
      Parser.upperRef(r.ref),
      Parser.upperOut(r.description || ''),
      r.liters != null ? Parser.formatLabel(r.liters) : '—',
      formatEurPdf(r._printPvp)
    ]);

    doc.autoTable({
      startY: 30,
      head: [columns],
      body,
      styles: { fontSize: 9, cellPadding: 2.2 },
      headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 247, 249] },
      columnStyles: {
        0: { cellWidth: 32 },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' }
      },
      margin: { top: 30 }
    });

    // Numeración de página en una pasada aparte, DESPUÉS de que autoTable haya
    // terminado — dentro de un callback didDrawPage el total de páginas todavía no es
    // definitivo mientras se están generando las siguientes.
    const totalPages = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 8);
    }

    const filename = ExcelWriter.buildFilename(brand.abbr, typeLabel, tariffDate, 'pdf');
    doc.save(filename);
    return filename;
  }

  // Etiquetas para el PDF de políticas de precios (ver ADR 0041) — mismos valores que
  // ya usan los <select> de Reglas (screen-rules.js), copiados aquí porque este módulo
  // no depende de ese fichero.
  const BASE_COST_LABELS = { factura: 'Coste factura', netoNeto: 'Coste neto-neto', tripleNeto: 'Coste triple neto' };
  const MODE_LABELS = { sale: 'Sobre venta', cost: 'Sobre compra' };
  const ROUNDING_LABELS = { none: 'Sin redondeo', '2dec': '2 decimales', psy99: 'Acabado en ,99', psy95: 'Acabado en ,95', step05: 'Múltiplo de 0,05 €', int: 'Entero' };

  /** Margen efectivo (y "beneficio" real tras redondeo) de un formato para un nivel —
   *  reusa `Pricing.compute` con una fila ficticia (coste 100 en los cuatro campos, para
   *  que cualquier `baseCostField`/`costCascade` encuentre coste y no se pierda por el
   *  hueco de "sin coste") en vez de duplicar aquí la prioridad
   *  formatModes > byFormat > defaultMargin. El propio precio resultante no importa — un
   *  documento de políticas explica la REGLA (%), no un PVP en €, que depende del coste
   *  real de cada producto. Incluye `costPerPack` (bug real encontrado al construir ADR
   *  0064): un nivel PVP recién sintetizado o con "Coste factura" elegido a mano tiene
   *  `baseCostField: 'costPerPack'`, no `'costFactura'` (ver
   *  `Migration.synthesizePvpLevel`/`screen-rules.js updateLevelField`) — sin este campo,
   *  `resolveCost` no encontraba coste y el margen salía "—" para el caso más común. */
  function effectiveMarginInfo(lvl, formatKey) {
    const liters = formatKey === '?' ? null : parseFloat(formatKey);
    const fakeRow = { ref: '__policy_preview__', formatKey, liters, costPerPack: 100, costFactura: 100, costNetoNeto: 100, costTripleNeto: 100 };
    const c = Pricing.compute(fakeRow, lvl);
    return { pct: c.marginPct, realPct: c.realMarginPct, mode: (lvl.formatModes && lvl.formatModes[formatKey]) || '' };
  }

  /** Fila de la tabla PVP para un formato, columnas exactas pedidas por el jefe de Yako
   *  (ver ADR 0064 v2): Formato / Coste / Tipo de margen / Margen / Beneficio / 1+2 /
   *  Bidones y Cubas — esta última NO es la clasificación de exportación
   *  (`cfg.bigContainerFormats`, ADR 0064 v1, columna aparte en los Excel) sino si el
   *  modo especial "PVP Neto" está activo para ese formato ("Neto") o no ("PVP") —
   *  petición explícita de Yako, aunque el nombre coincida con el otro concepto. */
  function pvpTableRow(pvp, f) {
    const info = effectiveMarginInfo(pvp, f.key);
    return [
      f.label,
      BASE_COST_LABELS[pvp.baseCost] || BASE_COST_LABELS.factura,
      MODE_LABELS[pvp.mode] || MODE_LABELS.sale,
      info.pct != null ? info.pct.toFixed(1) + '%' : '—',
      info.realPct != null ? info.realPct.toFixed(1) + '%' : '—',
      info.mode === '1x2' ? 'Sí (permitido)' : 'No (no permitido)',
      info.mode === 'pvp_neto' ? 'Neto' : 'PVP'
    ];
  }

  function bonusTableRow(bonus, f) {
    const info = effectiveMarginInfo(bonus, f.key);
    const premium = bonus.premiumByFormat && bonus.premiumByFormat[f.key];
    const printed = !!(bonus.printFormats && bonus.printFormats[f.key]);
    return [
      f.label,
      info.pct != null ? info.pct.toFixed(1) + '%' : '—',
      info.realPct != null ? info.realPct.toFixed(1) + '%' : '—',
      premium != null ? formatEurPdf(premium) : '—',
      printed ? 'Sí' : 'No'
    ];
  }

  function diffValue(a, b) {
    if (a === b) return false;
    if (a == null && b == null) return false;
    return true;
  }

  /** Líneas de "en qué se diferencia de la plantilla" para un mapa por formato
   *  (byFormat/formatModes/premiumByFormat/printFormats/bigContainerFormats) — compara
   *  clave a clave contra la plantilla, formateando cada valor con `fmt`. */
  function diffMapLines(label, mapFrom, mapTo, fmt) {
    const lines = [];
    const keys = new Set([...Object.keys(mapFrom || {}), ...Object.keys(mapTo || {})]);
    for (const k of [...keys].sort((a, b) => parseFloat(a) - parseFloat(b))) {
      const va = (mapFrom || {})[k];
      const vb = (mapTo || {})[k];
      if (diffValue(va, vb)) lines.push(`${label} — formato ${k}: ${fmt(va)} → ${fmt(vb)}.`);
    }
    return lines;
  }

  /** Explica, en frases, en qué difiere la configuración vigente (`cfg`) de la plantilla
   *  por defecto de la marca (`template`) — no un booleano, la diferencia real campo a
   *  campo (petición explícita del jefe de Yako, ver ADR 0064 v2). `null` si esta marca
   *  no tiene plantilla guardada todavía (no hay nada con qué comparar). */
  function computeTemplateDiff(template, cfg) {
    if (!template) return null;
    const lines = [];
    const tPvp = (template.priceLevels || []).find(l => l.id === 'pvp') || {};
    const cPvp = (cfg.priceLevels || []).find(l => l.id === 'pvp') || {};
    const tBonus = (template.priceLevels || []).find(l => l.id === 'netos_bonus') || {};
    const cBonus = (cfg.priceLevels || []).find(l => l.id === 'netos_bonus') || {};

    if (diffValue(tPvp.baseCost, cPvp.baseCost)) lines.push(`PVP — base de coste: ${BASE_COST_LABELS[tPvp.baseCost] || '—'} → ${BASE_COST_LABELS[cPvp.baseCost] || '—'}.`);
    if (diffValue(tPvp.mode, cPvp.mode)) lines.push(`PVP — modo de margen: ${MODE_LABELS[tPvp.mode] || '—'} → ${MODE_LABELS[cPvp.mode] || '—'}.`);
    if (diffValue(tPvp.defaultMargin, cPvp.defaultMargin)) lines.push(`PVP — margen por defecto: ${tPvp.defaultMargin}% → ${cPvp.defaultMargin}%.`);
    if (diffValue(tPvp.rounding, cPvp.rounding)) lines.push(`PVP — redondeo: ${ROUNDING_LABELS[tPvp.rounding] || '—'} → ${ROUNDING_LABELS[cPvp.rounding] || '—'}.`);
    lines.push(...diffMapLines('PVP — margen', tPvp.byFormat, cPvp.byFormat, v => v != null ? v + '%' : 'por defecto'));
    lines.push(...diffMapLines('PVP — modo especial', tPvp.formatModes, cPvp.formatModes, v => v === '1x2' ? '1+2' : v === 'pvp_neto' ? 'PVP Neto' : 'ninguno'));

    if (diffValue(tBonus.defaultMargin, cBonus.defaultMargin)) lines.push(`Netos Bonus — margen por defecto: ${tBonus.defaultMargin}% → ${cBonus.defaultMargin}%.`);
    if (diffValue(tBonus.rounding, cBonus.rounding)) lines.push(`Netos Bonus — redondeo: ${ROUNDING_LABELS[tBonus.rounding] || '—'} → ${ROUNDING_LABELS[cBonus.rounding] || '—'}.`);
    lines.push(...diffMapLines('Netos Bonus — margen', tBonus.byFormat, cBonus.byFormat, v => v != null ? v + '%' : 'por defecto'));
    lines.push(...diffMapLines('Netos Bonus — obsequio', tBonus.premiumByFormat, cBonus.premiumByFormat, v => v != null ? formatEurPdf(v) : 'sin obsequio'));
    lines.push(...diffMapLines('Netos Bonus — salida impresa', tBonus.printFormats, cBonus.printFormats, v => v ? 'Sí' : 'No'));

    lines.push(...diffMapLines('Bidones y Cubas', template.bigContainerFormats, cfg.bigContainerFormats, v => v ? 'marcado' : 'sin marcar'));

    return lines;
  }

  /** Dibuja la política de UNA marca+gama en el `doc` ya posicionado en la página
   *  actual (usado tanto por `exportPolicyPdf` como, marca a marca, por
   *  `exportAllPoliciesPdf` — ver ADR 0064 v2, "una hoja por cada marca"). */
  function renderBrandPolicyPage(doc, policy) {
    const { brand, gamaLabel, formats, pvp, bonus, cfg, template } = policy;
    const todayStr = new Date().toISOString().slice(0, 10);
    const pageWidth = doc.internal.pageSize.getWidth();
    const accent = hexToRgb(HEADER_COLOR_BY_BRAND[brand.id] || brand.color);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30, 30, 30);
    doc.text(`Políticas de precios de la marca ${brand.label} para la gama ${gamaLabel} a día de ${todayStr}`, 14, 16, { maxWidth: pageWidth - 28 });
    let y = 24;

    const tableStyles = { fontSize: 8.5, cellPadding: 1.8 };
    const headStyles = { fillColor: accent, textColor: 255, fontStyle: 'bold' };
    const altStyles = { fillColor: [246, 247, 249] };

    if (!formats.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(130, 130, 130);
      doc.text('Esta marca/gama no tiene ninguna tarifa importada todavía — no hay formatos que resumir.', 14, y + 6);
      y += 14;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(60, 60, 60);
      doc.text('PVP (va a Skrit)', 14, y);
      doc.autoTable({
        startY: y + 3,
        head: [['Formato', 'Coste', 'Tipo de margen', 'Margen', 'Beneficio', '1+2', 'Bidones y Cubas']],
        body: formats.map(f => pvpTableRow(pvp, f)),
        styles: tableStyles, headStyles, alternateRowStyles: altStyles,
        margin: { left: 14, right: 14 }
      });
      y = doc.lastAutoTable.finalY + 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(60, 60, 60);
      doc.text('Netos Bonus (uso interno — coste el más bajo disponible: triple-neto → neto-neto → factura)', 14, y, { maxWidth: pageWidth - 28 });
      doc.autoTable({
        startY: y + 3,
        head: [['Formato', 'Margen', 'Beneficio', 'Obsequio', 'Salida impresa']],
        body: formats.map(f => bonusTableRow(bonus, f)),
        styles: tableStyles, headStyles, alternateRowStyles: altStyles,
        margin: { left: 14, right: 14 }
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    const diff = computeTemplateDiff(template, cfg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(60, 60, 60);
    doc.text('Diferencia con la plantilla por defecto', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    const pageHeight = doc.internal.pageSize.getHeight();
    const noteLines = diff == null
      ? [`${brand.label} todavía no tiene una plantilla por defecto guardada.`]
      : diff.length === 0
        ? ['Sin diferencias — la configuración vigente coincide con la plantilla por defecto.']
        : diff;
    for (const line of noteLines) {
      const wrapped = doc.splitTextToSize(`•  ${line}`, pageWidth - 28);
      for (const w of wrapped) {
        if (y > pageHeight - 14) { doc.addPage(); y = 18; }
        doc.text(w, 14, y);
        y += 5;
      }
    }
  }

  /** Documento de referencia (no una tarifa): tabla, formato a formato, de qué regla
   *  aplica HOY para PVP y Netos Bonus de una marca+gama concreta, más en qué difiere de
   *  la plantilla por defecto de la marca — sin precios en €, que dependen del coste
   *  real de cada producto, solo la fórmula (ver ADR 0041, rehecho en ADR 0064 a
   *  petición del jefe de Yako). A4 vertical. */
  function exportPolicyPdf(policy) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    renderBrandPolicyPage(doc, policy);

    const totalPages = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 8);
    }

    const filename = `Política de Precios ${ExcelWriter.fileBrandLabel(policy.brand.abbr)} ${policy.gamaLabel} ${ExcelWriter.dateSlug()}.pdf`;
    doc.save(filename);
    return filename;
  }

  /** Una hoja (o varias, si hay muchos formatos) POR MARCA, mismo detalle que
   *  `exportPolicyPdf` — pedido explícito de Yako: "no quiero un resumen, quiero una
   *  hoja por cada marca" (ver ADR 0064 v2, reemplaza el resumen compacto de ADR 0041). */
  function exportAllPoliciesPdf(brandPolicies) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    brandPolicies.forEach((policy, i) => {
      if (i > 0) doc.addPage();
      renderBrandPolicyPage(doc, policy);
    });

    const totalPages = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 8);
    }

    const filename = `Política de Precios Todas las Marcas ${ExcelWriter.dateSlug()}.pdf`;
    doc.save(filename);
    return filename;
  }

  return { exportPriceListPdf, exportPolicyPdf, exportAllPoliciesPdf };
})();
