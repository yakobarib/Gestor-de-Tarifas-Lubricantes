/* ============================================================================
   MÓDULO: storage  (capa de persistencia — hoy localStorage, mañana fs.electron)
   ============================================================================ */
const Storage = (() => {
  const PREFIX = 'tarifador_v0_';
  return {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch { return false; }
    },
    list() {
      return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length));
    },
    delete(key) { localStorage.removeItem(PREFIX + key); }
  };
})();
