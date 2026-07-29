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

  function run() {
    if (Storage.get('migrated_v1')) return;
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

  return { run, synthesizePvpLevel };
})();
