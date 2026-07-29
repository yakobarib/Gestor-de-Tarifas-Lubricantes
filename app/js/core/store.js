/* ============================================================================
   MÓDULO: Store  (pub/sub mínimo para comunicar pantallas entre sí)
   ============================================================================
   Usado sobre todo para 'screen:changed' (Router) y para que la pantalla de
   Reglas avise a Comparación cuando cambian márgenes, sin acoplarlas.
*/
const Store = (() => {
  const listeners = {};

  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
    return () => {
      listeners[event] = (listeners[event] || []).filter(f => f !== fn);
    };
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error('[Store]', event, e); }
    });
  }

  return { on, emit };
})();
