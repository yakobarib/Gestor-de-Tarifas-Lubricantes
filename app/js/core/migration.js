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

  /** Aplica el maestro de descripciones/litros verificados (ver ADR 0043) a las filas
   *  YA importadas antes de que existiera esta funcionalidad — sin esto, cualquier
   *  referencia que de verdad esté en el maestro se vería igual "pendiente de validar"
   *  hasta la próxima vez que se reimporte esa tarifa. Reusa `MasterDB.putRows` (mismo
   *  camino que un import real) agrupando por marca/gama en vez de fila a fila. También
   *  borra las filas ya importadas que ahora están en `MasterDescriptions.INVALID_REFS`
   *  (ver ADR 0047) — `putRows` ya las descarta en futuras importaciones, pero eso no
   *  quita las que ya estaban guardadas de antes; aquí sí. */
  async function applyMasterDescriptions() {
    const allRows = await MasterDB.getAll();
    const groups = {};
    for (const r of allRows) {
      if (MasterDescriptions.isInvalidRef(r.brandId, r.ref)) {
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
    // Por versión, no por flag de una sola vez (ver ADR 0046): cada lote nuevo de
    // referencias validadas que se incorpore a MasterDescriptions sube `VERSION` — así
    // se reaplica el maestro a las filas ya importadas sin esperar a que se reimporte
    // esa tarifa, cada vez que llega un lote nuevo, no solo la primera.
    const appliedVersion = Storage.get('applied_master_version') || 0;
    if (appliedVersion < MasterDescriptions.VERSION) {
      await applyMasterDescriptions();
      Storage.set('applied_master_version', MasterDescriptions.VERSION);
    }
  }

  return { run, synthesizePvpLevel };
})();
