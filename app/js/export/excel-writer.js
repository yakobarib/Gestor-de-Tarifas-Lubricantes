/* ============================================================================
   MÓDULO: excelWriter  (export a formato Skrit)
   ============================================================================
   exportSkrit: el export legacy de v0.1-v0.3.0, usado desde la pantalla de
   Importación (una gama a la vez, tal como funciona hoy). Se mantiene sin
   cambios mientras la pantalla EXPORTACIÓN nueva se valida.

   exportSkritV2: layout unificado de 9 columnas para la pantalla EXPORTACIÓN
   (ver ADR 0008): MARCA, REFERENCIA, MARCA+REFERENCIA, coste factura, coste
   neto-neto, precio del nivel elegido, familia, litros, descripción.
   ============================================================================ */
const ExcelWriter = (() => {

  /** Descripción para cualquier tarifa de salida: usa la renombrada del perfil si
   *  existe (hoy solo Repsol la trae — ver ADR 0013), si no la original tal cual. */
  function exportDescription(r) {
    return r.descriptionExport || r.description || '';
  }

  function exportSkrit(rows, config, supplier, tariffDate) {
    // AD Parts añade una columna FAM (código de familia) que Repsol no tiene.
    const hasFam = rows.some(r => r.fam != null);
    const header = ['REF', 'PRODUCTO', 'LITROS', 'NETO FACTURA ENVASE', 'P.V.P. ENVASE'];
    if (hasFam) header.push('FAM');
    header.push(tariffDate || '');

    const data = [header];
    for (const r of rows) {
      if (!r.costPerPack || r.costPerPack <= 0) continue;
      const c = Pricing.compute(r, config);
      const row = [r.ref, exportDescription(r), r.liters || '', r.costPerPack, c.pvp];
      if (hasFam) row.push(r.fam || '');
      row.push('');
      data.push(row);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Ancho de columnas
    ws['!cols'] = hasFam
      ? [{ wch: 14 }, { wch: 50 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 12 }]
      : [{ wch: 14 }, { wch: 50 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    // Formato numérico €
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; ++R) {
      for (const col of [3, 4]) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: col })];
        if (cell && typeof cell.v === 'number') cell.z = '#,##0.00 €';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKRIT');

    const dateStr = (tariffDate || new Date().toISOString().slice(0, 10));
    const supplierSlug = supplier.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `tarifa-skrit-${supplierSlug}-${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /**
   * Export unificado (pantalla EXPORTACIÓN): una fila del maestro por línea,
   * con MARCA abreviada + REFERENCIA bare + MARCA+REFERENCIA, ambos niveles
   * de coste que existan, y el precio calculado del nivel elegido.
   * `rows` = filas del maestro (MasterDB), ya de una marca+gama concretas.
   */
  function exportSkritV2(rows, brandAbbr, levelConfig, tariffDate) {
    const header = ['MARCA', 'REFERENCIA', 'MARCA+REFERENCIA', 'COSTE FACTURA', 'COSTE NETO-NETO', 'COSTE TRIPLE NETO', 'PVP', 'FAMILIA', 'LITROS', 'DESCRIPCION'];
    const data = [header];
    for (const r of rows) {
      const c = Pricing.compute(r, levelConfig);
      if (c.pvp == null) continue; // sin coste base para este nivel (ej. netoNeto/tripleNeto aún no auditado)
      const bare = r.ref.startsWith(brandAbbr) ? r.ref.slice(brandAbbr.length) : r.ref;
      data.push([
        brandAbbr,
        bare,
        brandAbbr + bare,
        r.costFactura != null ? r.costFactura : '',
        r.costNetoNeto != null ? r.costNetoNeto : '',
        r.costTripleNeto != null ? r.costTripleNeto : '',
        c.pvp,
        r.fam || '',
        r.liters || '',
        exportDescription(r)
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 50 }
    ];
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; ++R) {
      for (const col of [3, 4, 5, 6]) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: col })];
        if (cell && typeof cell.v === 'number') cell.z = '#,##0.00 €';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKRIT');

    const dateStr = (tariffDate || new Date().toISOString().slice(0, 10));
    const levelSlug = (levelConfig.id || 'nivel').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `tarifa-skrit-${brandAbbr.toLowerCase()}-${levelSlug}-${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /**
   * Listado simple de precio neto (Factura o Neto-Neto) — para imprimir, no para Skrit:
   * REF, MARCA+REFERENCIA, PRODUCTO, LITROS, el propio coste tal cual, sin ningún
   * cálculo de margen. `costField` es 'costFactura' o 'costNetoNeto'.
   */
  function exportPriceList(rows, brandAbbr, costField, label, tariffDate) {
    const header = ['MARCA', 'REFERENCIA', 'MARCA+REFERENCIA', 'LITROS', 'DESCRIPCION', label.toUpperCase()];
    const data = [header];
    for (const r of rows) {
      const cost = r[costField];
      if (typeof cost !== 'number' || !isFinite(cost)) continue; // sin este coste auditado todavía
      const bare = r.ref.startsWith(brandAbbr) ? r.ref.slice(brandAbbr.length) : r.ref;
      data.push([brandAbbr, bare, brandAbbr + bare, r.liters || '', exportDescription(r), cost]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 50 }, { wch: 14 }];
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: 5 })];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0.00 €';
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));

    const dateStr = (tariffDate || new Date().toISOString().slice(0, 10));
    const labelSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `listado-${labelSlug}-${brandAbbr.toLowerCase()}-${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  return { exportSkrit, exportSkritV2, exportPriceList };
})();
