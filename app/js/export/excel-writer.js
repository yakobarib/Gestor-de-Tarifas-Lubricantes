/* ============================================================================
   MÓDULO: excelWriter  (export a formato Skrit — ver ADR 0032/0034)
   ============================================================================
   Usa ExcelJS (no XLSX.js) para poder escribir estilo real en el .xlsx —
   XLSX.js (SheetJS, la build community cargada para LEER las tarifas de los
   proveedores) descarta cualquier `cell.s` al escribir, comprobado con un
   round-trip que vuelve `{patternType:"none"}` en vez del estilo puesto.
   XLSX.js sigue siendo el lector de todos los perfiles de Importación — este
   fichero es el único que escribe, y solo con ExcelJS.

   Orden general de columnas en toda tarifa de salida (ver ADR 0034): MARCA,
   REFERENCIA, DESCRIPCION, LITROS, FAMILIA, COSTES, VENTAS — no todas las
   plantillas tienen las 7, pero las que tienen se ordenan así.
   ============================================================================ */
const ExcelWriter = (() => {

  /** Descripción para cualquier tarifa de salida: usa la renombrada del perfil si
   *  existe (hoy solo Repsol la trae — ver ADR 0013), si no la original tal cual —
   *  en mayúsculas (ver ADR 0034, homogeneiza entre marcas que entran en minúsculas). */
  function exportDescription(r) {
    return Parser.upperOut(r.descriptionExport || r.description || '');
  }

  /** Referencia de salida sin el prefijo de marca — mayúsculas y sin espacios primero
   *  (ver ADR 0034), luego se quita el prefijo ya normalizado (si la ref viniera en
   *  minúsculas, comparar contra `brandAbbr` en mayúsculas sin normalizar antes no la
   *  habría reconocido). */
  function exportRef(ref, brandAbbr) {
    const upper = Parser.upperRef(ref);
    return upper.startsWith(brandAbbr) ? upper.slice(brandAbbr.length) : upper;
  }

  /** Cabecera en negrita y centrada — pedido por Yako para todos los Excel exportados. */
  function styleHeaderRow(ws) {
    const row = ws.getRow(1);
    row.font = { bold: true };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  function setColumns(ws, columns) {
    // `columns` = [{ header, width, euro? }] — euro:true aplica formato de moneda a
    // toda la columna (los encabezados, al ser texto, ignoran el numFmt sin problema).
    ws.columns = columns.map(c => ({ header: c.header, width: c.width }));
    columns.forEach((c, i) => {
      if (c.euro) ws.getColumn(i + 1).numFmt = '#,##0.00 €';
    });
    styleHeaderRow(ws);
  }

  /** Descarga el workbook — ExcelJS no tiene un `writeFile` de conveniencia en el
   *  navegador (a diferencia de XLSX.js), hay que construir el Blob a mano. */
  async function downloadWorkbook(wb, filename) {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return filename;
  }

  /**
   * Export unificado (pantalla EXPORTACIÓN, "PVP (Venta)" y "Netos Bonus"): una fila del
   * maestro por línea, con MARCA abreviada + REFERENCIA (sin prefijo), ambos niveles de
   * coste que existan, y el precio calculado del nivel elegido. `rows` = filas del
   * maestro (MasterDB), de una marca+gama concreta o de todas sus gamas juntas (export
   * "Todas", ver pantalla Exportación). `levelConfig` acepta un nivel fijo, o una
   * función `(row) => nivel` para el caso "Todas" — cada gama puede tener el mismo
   * nivel configurado con márgenes distintos, así que se resuelve fila a fila según la
   * gama real de esa fila.
   */
  async function exportSkritV2(rows, brandAbbr, levelConfig, tariffDate, levelId) {
    const resolveLevel = typeof levelConfig === 'function' ? levelConfig : () => levelConfig;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('SKRIT');
    setColumns(ws, [
      { header: 'MARCA', width: 8 },
      { header: 'REFERENCIA', width: 14 },
      { header: 'DESCRIPCION', width: 50 },
      { header: 'LITROS', width: 8 },
      { header: 'FAMILIA', width: 8 },
      { header: 'COSTE FACTURA', width: 14, euro: true },
      { header: 'COSTE NETO-NETO', width: 16, euro: true },
      { header: 'COSTE TRIPLE NETO', width: 16, euro: true },
      { header: 'PVP', width: 12, euro: true }
    ]);
    for (const r of rows) {
      const c = Pricing.compute(r, resolveLevel(r) || {});
      if (c.pvp == null) continue; // sin coste base para este nivel (ej. netoNeto/tripleNeto aún no auditado)
      ws.addRow([
        brandAbbr,
        exportRef(r.ref, brandAbbr),
        exportDescription(r),
        r.liters || null,
        Parser.upperOut(r.fam || ''),
        r.costFactura != null ? r.costFactura : null,
        r.costNetoNeto != null ? r.costNetoNeto : null,
        r.costTripleNeto != null ? r.costTripleNeto : null,
        c.pvp
      ]);
    }

    const dateStr = (tariffDate || new Date().toISOString().slice(0, 10));
    // El nivel "pvp" se llama "venta" en el nombre del fichero — para diferenciarlo de
    // "PVP (Skrit)" (`exportSkritLean`), que también produce un "tarifa-skrit-...-pvp-...".
    // Sin este alias los dos exports salían con nombres casi idénticos (ver ADR 0033).
    const rawSlug = (levelId || levelConfig.id || 'nivel').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const levelSlug = rawSlug === 'pvp' ? 'venta' : rawSlug;
    const filename = `tarifa-skrit-${brandAbbr.toLowerCase()}-${levelSlug}-${dateStr}.xlsx`;
    return downloadWorkbook(wb, filename);
  }

  /**
   * Listado simple de coste (Factura / Neto-Neto / Triple Neto / Valor Regalo 1+1) —
   * para imprimir o auditar, no para Skrit: sin ningún cálculo de margen, el propio
   * coste tal cual. `costField` es el nombre del campo en `rows` ('costFactura',
   * 'costNetoNeto', 'costTripleNeto' o '_regaloValue').
   */
  async function exportPriceList(rows, brandAbbr, costField, label, tariffDate) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(label.slice(0, 31));
    setColumns(ws, [
      { header: 'MARCA', width: 8 },
      { header: 'REFERENCIA', width: 14 },
      { header: 'DESCRIPCION', width: 50 },
      { header: 'LITROS', width: 8 },
      { header: label.toUpperCase(), width: 14, euro: true }
    ]);
    for (const r of rows) {
      const cost = r[costField];
      if (typeof cost !== 'number' || !isFinite(cost)) continue; // sin este coste auditado todavía
      ws.addRow([brandAbbr, exportRef(r.ref, brandAbbr), exportDescription(r), r.liters || null, cost]);
    }

    const dateStr = (tariffDate || new Date().toISOString().slice(0, 10));
    const labelSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `listado-${labelSlug}-${brandAbbr.toLowerCase()}-${dateStr}.xlsx`;
    return downloadWorkbook(wb, filename);
  }

  /**
   * "PVP (Skrit)" (ver ADR 0031): el listado mínimo tal cual lo pide Yako para subir a
   * Skrit — MARCA, REFERENCIA, DESCRIPCION (editada), LITROS (por envase), FAMILIA,
   * COSTE COMPRA (el que usa el nivel para calcular el PVP) y PVP.
   */
  async function exportSkritLean(rows, brandAbbr, levelConfig, tariffDate) {
    const resolveLevel = typeof levelConfig === 'function' ? levelConfig : () => levelConfig;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('SKRIT');
    setColumns(ws, [
      { header: 'MARCA', width: 8 },
      { header: 'REFERENCIA', width: 14 },
      { header: 'DESCRIPCION', width: 50 },
      { header: 'LITROS', width: 8 },
      { header: 'FAMILIA', width: 8 },
      { header: 'COSTE COMPRA', width: 14, euro: true },
      { header: 'PVP', width: 12, euro: true }
    ]);
    for (const r of rows) {
      const level = resolveLevel(r) || {};
      const c = Pricing.compute(r, level);
      if (c.pvp == null) continue; // sin coste base para este nivel
      const cost = Pricing.resolveCost(r, level);
      ws.addRow([
        brandAbbr,
        exportRef(r.ref, brandAbbr),
        exportDescription(r),
        r.liters || null,
        Parser.upperOut(r.fam || ''),
        typeof cost === 'number' ? cost : null,
        c.pvp
      ]);
    }

    const dateStr = (tariffDate || new Date().toISOString().slice(0, 10));
    const filename = `tarifa-skrit-${brandAbbr.toLowerCase()}-pvp-${dateStr}.xlsx`;
    return downloadWorkbook(wb, filename);
  }

  return { exportSkritV2, exportSkritLean, exportPriceList };
})();
