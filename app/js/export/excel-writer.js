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

  /** Familia especial que Skrit espera para "Bidones y Cubas" (formatos grandes, ~180kg/
   *  200L en adelante) — distinta de la familia real que trae cada tarifa de proveedor.
   *  Pedido explícito de Yako; Racing Oil no está en la lista (no la dio) y se queda con
   *  su familia real, sin sobrescribir. Clave = `brandAbbr` (ya disponible en las dos
   *  funciones que la usan, sin necesidad de pasar también el `brandId`). */
  const BIDONES_CUBAS_FAM_BY_ABBR = { ADP: '07', REP: '09', CAT: '03', ENI: '12', SHL: '30' };

  /** Familia de salida de una fila: la especial de Bidones y Cubas si ese formato tiene
   *  activado "PVP Neto en Bidones y Cubas" en Reglas (mismo criterio que la columna
   *  "BIDONES Y CUBAS", ver ADR 0064 adenda — no un umbral de litros a mano, para no
   *  fallar con el bidón de 180kg de Repsol), si no la familia real de la tarifa. */
  function exportFamilia(r, brandAbbr, isBigContainer) {
    if (isBigContainer && BIDONES_CUBAS_FAM_BY_ABBR[brandAbbr]) return BIDONES_CUBAS_FAM_BY_ABBR[brandAbbr];
    return Parser.upperOut(r.fam || '');
  }

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

  /** Nombre de marca "legible" para el nombre de fichero — distinto del abbr interno
   *  (usado en la columna MARCA y para quitar el prefijo de la referencia). AD Parts se
   *  acorta a "AD" (pedido explícito de Yako); el resto usa su nombre de marca tal cual
   *  (ver ADR 0035). */
  const FILE_BRAND_LABELS = { ADP: 'AD', REP: 'Repsol', CAT: 'Castrol', SHL: 'Shell', ENI: 'Eni Live', RAC: 'Racing Oil' };

  /** dd-mm-aaaa a partir de aaaa-mm-dd (input type=date) — reusado por cualquier nombre
   *  de fichero de salida, ver ADR 0035. */
  function dateSlug(tariffDate) {
    const iso = tariffDate || new Date().toISOString().slice(0, 10);
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }

  /** Nombre de marca "legible" para nombre de fichero, expuesto para otros documentos
   *  que no son una tarifa (ej. "Política de Precios", ver ADR 0041). */
  function fileBrandLabel(brandAbbr) {
    return FILE_BRAND_LABELS[brandAbbr] || brandAbbr;
  }

  /** Nombre de fichero homogéneo para toda tarifa de salida: "Tarifa {Marca} {Tipo}
   *  {dd-mm-aaaa}.{ext}" — limpio, sin guiones salvo en la fecha y en los tipos que ya
   *  los llevan de por sí (Neto-Neto, Triple-Neto) (ver ADR 0035). */
  function buildFilename(brandAbbr, typeLabel, tariffDate, ext) {
    return `Tarifa ${fileBrandLabel(brandAbbr)} ${typeLabel} ${dateSlug(tariffDate)}.${ext}`;
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
  async function exportSkritV2(rows, brandAbbr, levelConfig, tariffDate, typeLabel, bigContainerResolver) {
    const resolveLevel = typeof levelConfig === 'function' ? levelConfig : () => levelConfig;
    const resolveBigContainer = typeof bigContainerResolver === 'function' ? bigContainerResolver : () => bigContainerResolver;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('SKRIT');
    setColumns(ws, [
      { header: 'MARCA', width: 8 },
      { header: 'REFERENCIA', width: 14 },
      { header: 'DESCRIPCION', width: 50 },
      { header: 'LITROS', width: 8 },
      { header: 'FAMILIA', width: 8 },
      { header: 'BIDONES Y CUBAS', width: 14 },
      { header: 'COSTE FACTURA', width: 14, euro: true },
      { header: 'COSTE NETO-NETO', width: 16, euro: true },
      { header: 'COSTE TRIPLE NETO', width: 16, euro: true },
      { header: 'PVP', width: 12, euro: true }
    ]);
    for (const r of rows) {
      const c = Pricing.compute(r, resolveLevel(r) || {});
      if (c.pvp == null) continue; // sin coste base para este nivel (ej. netoNeto/tripleNeto aún no auditado)
      const bigContainerMap = resolveBigContainer(r) || {};
      const isBigContainer = !!bigContainerMap[r.formatKey];
      ws.addRow([
        brandAbbr,
        exportRef(r.ref, brandAbbr),
        exportDescription(r),
        r.liters || null,
        exportFamilia(r, brandAbbr, isBigContainer),
        isBigContainer ? 'SÍ' : '',
        r.costFactura != null ? r.costFactura : null,
        r.costNetoNeto != null ? r.costNetoNeto : null,
        r.costTripleNeto != null ? r.costTripleNeto : null,
        c.pvp
      ]);
    }

    const filename = buildFilename(brandAbbr, typeLabel, tariffDate, 'xlsx');
    return downloadWorkbook(wb, filename);
  }

  /**
   * Listado simple de coste (Factura / Neto-Neto / Triple Neto / Valor Regalo 1+1) —
   * para imprimir o auditar, no para Skrit: sin ningún cálculo de margen, el propio
   * coste tal cual. `costField` es el nombre del campo en `rows` ('costFactura',
   * 'costNetoNeto', 'costTripleNeto' o '_regaloValue').
   */
  async function exportPriceList(rows, brandAbbr, costField, label, tariffDate, typeLabel, columnHeader) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(label.slice(0, 31));
    setColumns(ws, [
      { header: 'MARCA', width: 8 },
      { header: 'REFERENCIA', width: 14 },
      { header: 'DESCRIPCION', width: 50 },
      { header: 'LITROS', width: 8 },
      { header: (columnHeader || label).toUpperCase(), width: 14, euro: true }
    ]);
    for (const r of rows) {
      const cost = r[costField];
      if (typeof cost !== 'number' || !isFinite(cost)) continue; // sin este coste auditado todavía
      ws.addRow([brandAbbr, exportRef(r.ref, brandAbbr), exportDescription(r), r.liters || null, cost]);
    }

    const filename = buildFilename(brandAbbr, typeLabel || label, tariffDate, 'xlsx');
    return downloadWorkbook(wb, filename);
  }

  /**
   * "PVP (Skrit)" (ver ADR 0031): el listado mínimo tal cual lo pide Yako para subir a
   * Skrit — MARCA, REFERENCIA, DESCRIPCION (editada), LITROS (por envase), FAMILIA,
   * COSTE COMPRA (el que usa el nivel para calcular el PVP) y PVP.
   */
  async function exportSkritLean(rows, brandAbbr, levelConfig, tariffDate, typeLabel, bigContainerResolver) {
    const resolveLevel = typeof levelConfig === 'function' ? levelConfig : () => levelConfig;
    const resolveBigContainer = typeof bigContainerResolver === 'function' ? bigContainerResolver : () => bigContainerResolver;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('SKRIT');
    setColumns(ws, [
      { header: 'MARCA', width: 8 },
      { header: 'REFERENCIA', width: 14 },
      { header: 'DESCRIPCION', width: 50 },
      { header: 'LITROS', width: 8 },
      { header: 'FAMILIA', width: 8 },
      { header: 'BIDONES Y CUBAS', width: 14 },
      { header: 'COSTE FACTURA', width: 14, euro: true },
      { header: 'PVP', width: 12, euro: true }
    ]);
    for (const r of rows) {
      const level = resolveLevel(r) || {};
      const c = Pricing.compute(r, level);
      if (c.pvp == null) continue; // sin coste base para este nivel
      const cost = Pricing.resolveCost(r, level);
      const bigContainerMap = resolveBigContainer(r) || {};
      const isBigContainer = !!bigContainerMap[r.formatKey];
      ws.addRow([
        brandAbbr,
        exportRef(r.ref, brandAbbr),
        exportDescription(r),
        r.liters || null,
        exportFamilia(r, brandAbbr, isBigContainer),
        isBigContainer ? 'SÍ' : '',
        typeof cost === 'number' ? cost : null,
        c.pvp
      ]);
    }

    const filename = buildFilename(brandAbbr, typeLabel, tariffDate, 'xlsx');
    return downloadWorkbook(wb, filename);
  }

  /** Exporta las referencias pendientes de validar de una marca/gama al mismo formato
   *  que las plantillas "Maestro {Marca}.xlsx" (REFERENCIA/DESCRIPCION/LITROS/NOTAS) —
   *  para que Yako pueda corregirlas en Excel con el flujo ya establecido (ver ADR 0059)
   *  en vez de tener que validarlas una a una en el panel. Se rellena con la descripción
   *  cruda del proveedor y los litros detectados como punto de partida, no como
   *  respuesta ya verificada. */
  async function exportPendingValidation(rows, brandLabel) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(brandLabel.slice(0, 31));
    setColumns(ws, [
      { header: 'REFERENCIA', width: 18 },
      { header: 'DESCRIPCION', width: 55 },
      { header: 'LITROS', width: 10 },
      { header: 'NOTAS', width: 40 }
    ]);
    for (const r of rows) {
      ws.addRow([r.ref, Parser.upperOut(r.description || ''), r.liters ?? null, null]);
    }
    return downloadWorkbook(wb, `Pendientes de validar ${brandLabel} ${dateSlug()}.xlsx`);
  }

  return { exportSkritV2, exportSkritLean, exportPriceList, exportPendingValidation, buildFilename, dateSlug, fileBrandLabel };
})();
