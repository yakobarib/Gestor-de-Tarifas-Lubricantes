/* ============================================================================
   MÓDULO: migration  (migraciones de datos ya guardados en localStorage)
   ============================================================================
   Corre una sola vez (flag 'migrated_v1'). Solo AÑADE campos — nunca toca ni
   renombra claves existentes, para no perder configuración/historial ya
   guardados en v0.2.x/v0.3.0.
*/
const Migration = (() => {
  function synthesizePvpLevel(cfg) {
    return {
      id: 'pvp',
      label: 'PVP',
      baseCost: 'factura',
      baseCostField: 'costPerPack',
      mode: cfg.marginMode || 'sale',
      defaultMargin: cfg.defaultMargin != null ? cfg.defaultMargin : 30,
      byFormat: cfg.byFormat || {},
      rounding: cfg.rounding || '2dec',
      manualOverride: cfg.manualPvp || {},
      goesToSkrit: true
    };
  }

  // Semilla original de Netos Bonus al crear el nivel por primera vez (ver
  // ADR 0016/screen-rules.js) — copiada aquí solo para esta limpieza de una vez;
  // migration.js corre antes que screen-rules.js, no puede importar sus constantes.
  const SEED_MARGIN_BY_FORMAT = { '185': 20, '200': 20, '205': 20, '208': 20, '209': 20, '1000': 15 };
  const SEED_PREMIUM_BY_FORMAT = { '185': 50, '200': 50, '205': 50, '208': 50, '209': 50, '1000': 100 };

  /** Yako nunca escribió a mano el margen/obsequio de fábrica de Netos Bonus — se
   *  guardaba igual que un valor manual, así que no seguía "Margen por defecto" al
   *  cambiarlo (bug real, ver ADR 0040). Limpieza de una vez: solo borra las celdas que
   *  siguen EXACTAMENTE en su valor de semilla (si Yako la tocó a mano, aunque coincida
   *  con otro formato, se queda igual — no hay forma de distinguir "nunca tocada" de
   *  "tocada y puesta igual", así que se prioriza no perder ediciones reales). */
  function clearUntouchedBonusSeed(cfg) {
    let changed = false;
    const bonus = (cfg.priceLevels || []).find(l => l.id === 'netos_bonus');
    if (!bonus) return false;
    if (bonus.byFormat) {
      for (const [k, seedVal] of Object.entries(SEED_MARGIN_BY_FORMAT)) {
        if (bonus.byFormat[k] === seedVal) { delete bonus.byFormat[k]; changed = true; }
      }
    }
    if (bonus.premiumByFormat) {
      for (const [k, seedVal] of Object.entries(SEED_PREMIUM_BY_FORMAT)) {
        if (bonus.premiumByFormat[k] === seedVal) { delete bonus.premiumByFormat[k]; changed = true; }
      }
    }
    return changed;
  }

  /** Aplica el maestro compartido (MasterCache, ya calentado por `app.js` antes de llamar
   *  a `Migration.run()` — ver ADR 0054) a las filas YA importadas antes de que existiera
   *  esta funcionalidad — sin esto, cualquier referencia que de verdad esté en el maestro
   *  se vería igual "pendiente de validar" hasta la próxima vez que se reimporte esa
   *  tarifa. Reusa `MasterDB.putRows` (mismo camino que un import real) agrupando por
   *  marca/gama en vez de fila a fila. También borra las filas ya importadas que ahora
   *  están marcadas inválidas en el maestro compartido. */
  async function applyMasterDescriptions() {
    const allRows = await MasterDB.getAll();
    const groups = {};
    for (const r of allRows) {
      if (MasterCache.isInvalid(r.brandId, r.ref)) {
        await MasterDB.deleteRow(r.brandId, r.gama, r.ref);
        continue;
      }
      const key = `${r.brandId}::${r.gama}`;
      (groups[key] = groups[key] || []).push({ ref: r.ref });
    }
    for (const key of Object.keys(groups)) {
      const sep = key.indexOf('::');
      const brandId = key.slice(0, sep);
      const gama = key.slice(sep + 2);
      await MasterDB.putRows(brandId, gama, groups[key], null);
    }
  }

  /** Limpieza de una vez (ver ADR 0056): AD Parts y Castrol dejaron de anteponer
   *  'ADP'/'CAT' al ref al importar — las filas ya guardadas en este navegador con el
   *  prefijo antiguo se quedan huérfanas (no se fusionan con las nuevas, que llegan sin
   *  prefijo, porque el ref ya no coincide) y se ven duplicadas en "Todas las gamas". Se
   *  borran aquí en vez de pedirle a Yako que lo haga a mano desde la consola del
   *  navegador (le dio problemas). */
  async function removeStalePrefixedRows() {
    const allRows = await MasterDB.getAll();
    for (const r of allRows) {
      if ((r.brandId === 'castrol' || r.brandId === 'ad_parts_aceite') && /^(CAT|ADP)/.test(r.ref)) {
        await MasterDB.deleteRow(r.brandId, r.gama, r.ref);
      }
    }
  }

  /** Limpieza de una vez (ver ADR 0057): Racing Oil dejó de dejar espacios sueltos
   *  dentro del ref al importar — mismo problema que `removeStalePrefixedRows`, las
   *  filas ya guardadas con espacios se quedan huérfanas junto a las nuevas (sin
   *  espacios) tras reimportar, duplicando "Todas las gamas". */
  async function removeStaleSpacedRacingOilRows() {
    const allRows = await MasterDB.getAll();
    for (const r of allRows) {
      if (r.brandId === 'racing_oil' && /\s/.test(r.ref)) {
        await MasterDB.deleteRow(r.brandId, r.gama, r.ref);
      }
    }
  }

  /** Migración de una sola vez (ver ADR 0060+, extensión del maestro compartido a
   *  tarifas importadas): sube a `imported_tariff_rows` (Neon) lo que este ordenador ya
   *  tuviera importado ANTES de que existiera esa tabla — sin esto, Albert/Ernesto/Nuria
   *  arrancarían con las tarifas vacías igualmente la primera vez, aunque Yako ya las
   *  tuviera todas importadas en el suyo. Se llama desde app.js ANTES de
   *  `MasterDB.hydrateFromNeon()`, para no pisar estas filas locales con un Neon aún
   *  vacío la primera vez que esto se despliega. */
  async function pushLocalTariffsToNeonOnce() {
    if (Storage.get('migrated_v6_push_local_tariffs_to_neon')) return;
    const allRows = await MasterDB.getAll();
    const items = allRows.map(r => {
      const fields = {
        descriptionRaw: r.descriptionRaw,
        descriptionExport: r.descriptionExport,
        liters: r.liters,
        formatKey: r.formatKey,
        litersDetected: r.litersDetected,
        fam: r.fam
      };
      if (r.costFactura != null) { fields.costFactura = r.costFactura; fields.costFacturaImportedAt = r.costFacturaImportedAt; }
      if (r.costNetoNeto != null) { fields.costNetoNeto = r.costNetoNeto; fields.costNetoNetoImportedAt = r.costNetoNetoImportedAt; }
      if (r.costTripleNeto != null) { fields.costTripleNeto = r.costTripleNeto; fields.costTripleNetoImportedAt = r.costTripleNetoImportedAt; }
      return { brandId: r.brandId, gama: r.gama, ref: r.ref, fields };
    });
    try {
      await NeonTariffs.upsertMany(items);
    } catch (err) {
      // No bloquea el arranque — se reintenta en el próximo boot (el flag no se marca).
      console.error('pushLocalTariffsToNeonOnce error', err);
      return;
    }
    Storage.set('migrated_v6_push_local_tariffs_to_neon', true);
  }

  async function run() {
    if (!Storage.get('migrated_v1')) {
      const keys = Storage.list();
      for (const key of keys) {
        if (!key.startsWith('config_')) continue;
        const cfg = Storage.get(key);
        if (cfg && !cfg.priceLevels) {
          cfg.priceLevels = [synthesizePvpLevel(cfg)];
          Storage.set(key, cfg);
        }
      }
      Storage.set('migrated_v1', true);
    }
    if (!Storage.get('migrated_v2_clear_bonus_seed')) {
      for (const key of Storage.list()) {
        if (!key.startsWith('config_')) continue;
        const cfg = Storage.get(key);
        if (cfg && cfg.priceLevels && clearUntouchedBonusSeed(cfg)) Storage.set(key, cfg);
      }
      Storage.set('migrated_v2_clear_bonus_seed', true);
    }
    if (!Storage.get('migrated_v4_remove_stale_prefixed_refs')) {
      await removeStalePrefixedRows();
      Storage.set('migrated_v4_remove_stale_prefixed_refs', true);
    }
    if (!Storage.get('migrated_v5_remove_stale_spaced_racing_oil_refs')) {
      await removeStaleSpacedRacingOilRows();
      Storage.set('migrated_v5_remove_stale_spaced_racing_oil_refs', true);
    }
    // SIEMPRE, no una sola vez (bug corregido — ver ADR 0054): MasterCache se recalienta
    // entero desde Neon en cada arranque, pero eso por sí solo NO actualiza las filas que
    // ya estaban importadas en este navegador antes de que se corrigiera/añadiera algo al
    // maestro compartido — sin reaplicar aquí, esas filas se quedaban con su descripción
    // vieja para siempre, aunque el maestro en Neon ya tuviera la buena.
    await applyMasterDescriptions();
  }

  return { run, synthesizePvpLevel, pushLocalTariffsToNeonOnce };
})();
