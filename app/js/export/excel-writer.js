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

  /** "Familia Skrit" (ver ADR 0076) — de "Base de Conocimiento/Familias/Familias
   *  Skrit.xlsx", que Yako va rellenando a mano formato a formato según decide, marca a
   *  marca, qué familia debe salir en Skrit (distinta de la familia real que trae cada
   *  tarifa de proveedor — Skrit tiene su propio sistema). Por ahora solo tiene los
   *  formatos de "Bidones y Cubas" (185/200/205/208/600/850/1000L); el resto de litrajes
   *  se deja sin entrada a propósito hasta que Yako decida esas también — sin entrada,
   *  "Familia Skrit" sale vacía para esa fila, NO se inventa un valor ni se cae a la
   *  familia real. Clave = `brandAbbr` (ya disponible donde se usa), luego litros exactos
   *  redondeados a 3 decimales (mismo criterio que `Parser.formatKey`). El Excel de Yako
   *  usa "SHE" para Shell — aquí se guarda como `SHL`, el `brandAbbr` real de la app;
   *  ACTUALIZAR ESTA TABLA A MANO cada vez que Yako mande una versión nueva del fichero,
   *  no hay import automático todavía (dataset pequeño y decidido por él a mano). */
  const FAMILIA_SKRIT = {
    ADP: { 185: '07', 200: '07', 205: '07', 208: '07', 209: '07', 600: '07', 850: '07', 1000: '07' },
    CAT: { 185: '03', 200: '03', 205: '03', 208: '03', 209: '03', 600: '03', 850: '03', 1000: '03' },
    REP: { 185: '09', 200: '09', 205: '09', 208: '09', 209: '09', 600: '09', 850: '09', 1000: '09' },
    SHL: { 185: '30', 200: '30', 205: '30', 208: '30', 209: '30', 600: '30', 850: '30', 1000: '30' },
    ENI: { 185: '12', 200: '12', 205: '12', 208: '12', 209: '12', 600: '12', 850: '12', 1000: '12' },
    RAC: { 185: '05', 200: '05', 205: '05', 208: '05', 209: '05', 600: '05', 850: '05', 1000: '05' }
  };

  /** "Familia Skrit" de una fila (o `''` si ese litraje concreto aún no está decidido) —
   *  no toca ni sustituye la familia real, que sigue viniendo tal cual de la tarifa. */
  function familiaSkritFor(brandAbbr, liters) {
    if (liters == null) return '';
    const map = FAMILIA_SKRIT[brandAbbr];
    if (!map) return '';
    const key = Math.round(liters * 1000) / 1000;
    return map[key] || '';
  }

  /** Nombre de la columna "familia de proveedor" con la marca ya incluida (ej. "Familia
   *  AD"), pedido por Yako para distinguirla a simple vista de "Familia Skrit" en el
   *  mismo Excel — no siempre coincide con el `brandAbbr` interno de la app (AD Parts
   *  es "AD" aquí, no "ADP"; Shell es "SHE", como en su propio Excel de familias, no
   *  "SHL"). Si algún día se exportara una marca sin entrada aquí, cae a un genérico en
   *  vez de romper. */
  const FAMILIA_PROVEEDOR_LABEL = { ADP: 'Familia AD', CAT: 'Familia CAT', REP: 'Familia REP', SHL: 'Familia SHE', ENI: 'Familia ENI', RAC: 'Familia RAC' };
  function familiaProveedorLabel(brandAbbr) {
    return FAMILIA_PROVEEDOR_LABEL[brandAbbr] || 'Familia Proveedor';
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
        Parser.upperOut(r.fam || ''),
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
   * Skrit — MARCA, REFERENCIA, DESCRIPCION (editada), LITROS (por envase), "FAMILIA
   * {marca}" (la real de la tarifa, con la marca en el nombre de columna — ver ADR 0077),
   * FAMILIA SKRIT (ver ADR 0076 — solo aquí, en ningún otro tipo de exportación), COSTE
   * COMPRA (el que usa el nivel para calcular el PVP) y PVP.
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
      { header: familiaProveedorLabel(brandAbbr).toUpperCase(), width: 12 },
      { header: 'FAMILIA SKRIT', width: 12 },
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
        Parser.upperOut(r.fam || ''),
        familiaSkritFor(brandAbbr, r.liters),
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

  return { exportSkritV2, exportSkritLean, exportPriceList, exportPendingValidation, buildFilename, dateSlug, fileBrandLabel, familiaSkritFor, familiaProveedorLabel };
})();
