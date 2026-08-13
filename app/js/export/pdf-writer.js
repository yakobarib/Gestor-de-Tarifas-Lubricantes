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
   *  ADR 0023) — aquí solo se maqueta. `gamaLabel` es null/'' para "Todas las gamas". */
  function exportPriceListPdf(rows, brand, gamaLabel, tariffDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const accent = hexToRgb(HEADER_COLOR_BY_BRAND[brand.id] || brand.color);
    const dateStr = tariffDate || new Date().toISOString().slice(0, 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text(`Tarifa de venta — ${brand.label}`, 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(`${gamaLabel ? gamaLabel + ' · ' : ''}Vigente a ${dateStr} · Recambios Ibiza`, 14, 24);

    const body = rows.map(r => [
      r.ref,
      r.description || '',
      r.liters != null ? Parser.formatLabel(r.liters) : '—',
      formatEurPdf(r._printPvp)
    ]);

    doc.autoTable({
      startY: 30,
      head: [['Referencia', 'Producto', 'Litros', 'PVP']],
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

    const filename = `pvp-imprimir-${brand.abbr.toLowerCase()}-${dateStr}.pdf`;
    doc.save(filename);
    return filename;
  }

  return { exportPriceListPdf };
})();
