/* ============================================================================
   MÓDULO: LoadedTariff  (estado de la tarifa recién importada)
   ============================================================================
   Puente entre Importación (que lee el Excel y persiste en MasterDB) y
   Tarifas (que la muestra, filtra, y permite fijar como vigente) — así
   ninguna de las dos pantallas necesita alcanzar el cierre interno de la
   otra. Vive solo en memoria: al recargar la página no hay "tarifa cargada"
   hasta que se suelta un fichero de nuevo (el maestro en IndexedDB y los
   metadatos de las tarjetas de marca sí persisten, ver MasterDB/Storage).
*/
const LoadedTariff = (() => {
  let current = null; // { supplier, supplierId, gamas, allRows, tariffDate, sheetUsed }

  function set(data) {
    current = data;
    Store.emit('tariff:loaded', current);
  }
  function get() {
    return current;
  }
  function clear() {
    current = null;
    Store.emit('tariff:loaded', null);
  }

  return { set, get, clear };
})();
