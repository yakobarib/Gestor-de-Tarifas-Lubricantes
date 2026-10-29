/* ============================================================================
   MÓDULO: storage  (capa de persistencia — hoy localStorage, mañana fs.electron)
   ============================================================================ */
/** Fecha de HOY en hora LOCAL, "YYYY-MM-DD". `new Date().toISOString().slice(0, 10)` da la
 *  fecha en UTC, así que en España entre las 00:00 y las 02:00 (verano) o 01:00 (invierno)
 *  devolvía el día anterior — fechas de tarifa/importación/exportación desfasadas un día
 *  (ADR 0091). Se define aquí porque es el primer script que se carga. */
function todayLocalISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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
