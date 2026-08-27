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

  /** Margen efectivo de un formato para un nivel — reusa `Pricing.compute` con una fila
   *  ficticia (coste 100 en los cuatro campos, para que cualquier `baseCostField`/
   *  `costCascade` encuentre coste y no se pierda por el hueco de "sin coste") en vez de
   *  duplicar aquí la prioridad formatModes > byFormat > defaultMargin. El propio precio
   *  resultante no importa — un documento de políticas explica la REGLA (%), no un PVP
   *  en €, que depende del coste real de cada producto. Incluye `costPerPack` (bug real
   *  encontrado al construir ADR 0064): un nivel PVP recién sintetizado o con "Coste
   *  factura" elegido a mano tiene `baseCostField: 'costPerPack'`, no `'costFactura'`
   *  (ver `Migration.synthesizePvpLevel`/`screen-rules.js updateLevelField`) — sin este
   *  campo, `resolveCost` no encontraba coste y el margen salía "—" para el caso más
   *  común de todos. */
  function effectiveMarginInfo(lvl, formatKey) {
    const liters = formatKey === '?' ? null : parseFloat(formatKey);
    const fakeRow = { ref: '__policy_preview__', formatKey, liters, costPerPack: 100, costFactura: 100, costNetoNeto: 100, costTripleNeto: 100 };
    const c = Pricing.compute(fakeRow, lvl);
    const mode = lvl.formatModes && lvl.formatModes[formatKey];
    return { pct: c.marginPct, note: mode === '1x2' ? '1+2' : mode === 'pvp_neto' ? 'PVP Neto' : '' };
  }

  /** Línea narrativa de un formato en PVP: margen + qué modo especial está ACTIVO para
   *  ese formato en concreto (no solo "disponible" — un formato elegible para "1+2" que
   *  no lo tenga marcado no lo menciona), más si está marcado "Bidones y Cubas" (familia
   *  inventada por el equipo, ver ADR 0064 — independiente del modo de margen). */
  function pvpFormatLine(pvp, bigContainerFormats, f) {
    const info = effectiveMarginInfo(pvp, f.key);
    const parts = [`Margen ${(MODE_LABELS[pvp.mode] || MODE_LABELS.sale).toLowerCase()} ${info.pct != null ? info.pct.toFixed(1) + '%' : '—'}`];
    if (info.note) parts.push(`"${info.note}" permitido`);
    if (bigContainerFormats && bigContainerFormats[f.key]) parts.push('Bidones y Cubas');
    return `${f.label}: ${parts.join(', ')}.`;
  }

  function bonusFormatLine(bonus, f) {
    const info = effectiveMarginInfo(bonus, f.key);
    const premium = bonus.premiumByFormat && bonus.premiumByFormat[f.key];
    const printed = !!(bonus.printFormats && bonus.printFormats[f.key]);
    const parts = [
      `Margen sobre venta ${info.pct != null ? info.pct.toFixed(1) + '%' : '—'}`,
      premium != null ? `Obsequio ${formatEurPdf(premium)}` : 'Sin obsequio',
      `Salida impresa: ${printed ? 'Sí' : 'No'}`
    ];
    return `${f.label}: ${parts.join(', ')}.`;
  }

  /** Documento de referencia (no una tarifa): explica en prosa, formato a formato, qué
   *  regla aplica HOY para PVP y Netos Bonus de una marca+gama concreta — sin precios en
   *  €, que dependen del coste real de cada producto, solo la fórmula (ver ADR 0041,
   *  reescrito narrativo en ADR 0064 a petición del jefe de Yako, "para poder imprimir y
   *  recordar"). A4 vertical, con paginación automática si hay muchos formatos.
   *  `templateDiffers` es `true`/`false`/`null` (null = esta marca no tiene plantilla
   *  guardada todavía, no se menciona nada). */
  function exportPolicyPdf(brand, gamaLabel, formats, pvp, bonus, bigContainerFormats, templateDiffers) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const todayStr = new Date().toISOString().slice(0, 10);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 14;
    const marginRight = 14;
    const maxWidth = pageWidth - marginLeft - marginRight;
    let y = 18;

    function ensureSpace(lineHeight) {
      if (y + lineHeight > pageHeight - 14) { doc.addPage(); y = 18; }
    }
    function writeLines(text, opts) {
      const o = opts || {};
      doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
      doc.setFontSize(o.size || 10);
      doc.setTextColor.apply(doc, o.color || [40, 40, 40]);
      const lines = doc.splitTextToSize(text, maxWidth - (o.indent || 0));
      for (const line of lines) {
        ensureSpace(o.lineHeight || 5.5);
        doc.text(line, marginLeft + (o.indent || 0), y);
        y += o.lineHeight || 5.5;
      }
    }

    writeLines(`Políticas de precios de la marca ${brand.label} para la gama ${gamaLabel} a día de ${todayStr}`, { bold: true, size: 14, color: [30, 30, 30], lineHeight: 7 });
    y += 2;
    writeLines(`${BASE_COST_LABELS[pvp.baseCost] || BASE_COST_LABELS.factura} · Modo de margen: ${MODE_LABELS[pvp.mode] || MODE_LABELS.sale} · Redondeo: ${ROUNDING_LABELS[pvp.rounding] || pvp.rounding}`, { size: 9.5, color: [90, 90, 90] });
    y += 4;

    writeLines('PVP (va a Skrit)', { bold: true, size: 11.5, color: [30, 30, 30], lineHeight: 6 });
    if (!formats.length) {
      writeLines('Esta marca/gama no tiene ninguna tarifa importada todavía — no hay formatos que resumir.', { size: 9.5, color: [130, 130, 130] });
    } else {
      for (const f of formats) writeLines(`—  ${pvpFormatLine(pvp, bigContainerFormats, f)}`, { size: 9.5, indent: 2 });
    }
    y += 4;

    writeLines(`Netos Bonus (uso interno) · Coste el más bajo disponible (triple-neto → neto-neto → factura) · Redondeo: ${ROUNDING_LABELS[bonus.rounding] || bonus.rounding}`, { bold: true, size: 11.5, color: [30, 30, 30], lineHeight: 6 });
    if (!formats.length) {
      writeLines('Sin formatos que resumir.', { size: 9.5, color: [130, 130, 130] });
    } else {
      for (const f of formats) writeLines(`—  ${bonusFormatLine(bonus, f)}`, { size: 9.5, indent: 2 });
    }

    if (templateDiffers) {
      y += 4;
      writeLines(`Nota: esta configuración difiere de la plantilla por defecto de ${brand.label}.`, { size: 9.5, color: [180, 90, 20] });
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 8);
    }

    const filename = `Política de Precios ${ExcelWriter.fileBrandLabel(brand.abbr)} ${gamaLabel} ${ExcelWriter.dateSlug()}.pdf`;
    doc.save(filename);
    return filename;
  }

  /** Resumen compacto (sin desglose por formato, para que entren las 6 marcas en una
   *  sola hoja) — ver ADR 0041. */
  function exportAllPoliciesPdf(brandPolicies) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const todayStr = new Date().toISOString().slice(0, 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text('Políticas de Precios — Todas las marcas', 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(`Generado el ${todayStr} · Recambios Ibiza`, 14, 24);

    const body = brandPolicies.map(({ brand, pvp, bonus }) => {
      const modes = (pvp.formatModes && Object.values(pvp.formatModes)) || [];
      const notes = [];
      if (modes.includes('1x2')) notes.push('1+2 activo');
      if (modes.includes('pvp_neto')) notes.push('PVP Neto activo');
      const obsequioCount = bonus.premiumByFormat ? Object.keys(bonus.premiumByFormat).length : 0;
      if (obsequioCount) notes.push(`Obsequio en ${obsequioCount} formato${obsequioCount > 1 ? 's' : ''}`);
      return [
        brand.label,
        BASE_COST_LABELS[pvp.baseCost] || BASE_COST_LABELS.factura,
        `${pvp.defaultMargin}% (${MODE_LABELS[pvp.mode] || MODE_LABELS.sale})`,
        ROUNDING_LABELS[pvp.rounding] || pvp.rounding,
        `${bonus.defaultMargin}%`,
        notes.join(' · ') || '—'
      ];
    });

    doc.autoTable({
      startY: 30,
      head: [['Marca', 'PVP: coste', 'PVP: margen', 'PVP: redondeo', 'Bonus: margen', 'Notas']],
      body,
      styles: { fontSize: 9, cellPadding: 2.4 },
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 247, 249] }
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Página 1 de 1', pageWidth - 30, doc.internal.pageSize.getHeight() - 8);

    const filename = `Política de Precios Todas las Marcas ${ExcelWriter.dateSlug()}.pdf`;
    doc.save(filename);
    return filename;
  }

  return { exportPriceListPdf, exportPolicyPdf, exportAllPoliciesPdf };
})();
