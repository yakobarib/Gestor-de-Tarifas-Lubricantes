/* ============================================================================
   MÓDULO: Router  (navegación hash entre las 4 pantallas — ver ADR 0008)
   ============================================================================
   Hash routing (no path routing): GitHub Pages es hosting estático y las
   rutas no-fichero devuelven 404 al refrescar, el hash no toca el servidor.
*/
const Router = (() => {
  const SCREENS = ['import', 'tarifas', 'rules', 'compare', 'export'];
  const TITLES = { import: 'Importación', tarifas: 'Tarifas', rules: 'Reglas', compare: 'Comparación', export: 'Exportación' };

  function show(screen) {
    for (const s of SCREENS) {
      const el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('hidden', s !== screen);
    }
    document.querySelectorAll('#mainNav [data-screen]').forEach(a => {
      a.classList.toggle('active', a.dataset.screen === screen);
    });
    const titleEl = document.getElementById('screenTitle');
    if (titleEl) titleEl.textContent = TITLES[screen] || '';
    if (location.hash.slice(1) !== screen) location.hash = screen;
    Store.emit('screen:changed', screen);
  }

  function current() {
    const s = location.hash.slice(1);
    return SCREENS.includes(s) ? s : 'import';
  }

  function init() {
    window.addEventListener('hashchange', () => show(current()));
    show(current());
  }

  return { show, init, current, SCREENS };
})();
