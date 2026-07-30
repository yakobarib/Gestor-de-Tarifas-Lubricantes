/* ============================================================================
   MÓDULO: Theme  (toggle manual claro/oscuro sobre el auto de prefers-color-scheme)
   ============================================================================
   Sin toggle, la app sigue el tema del sistema (ver los bloques
   @media (prefers-color-scheme: dark) en styles.css). Al pulsar el botón de
   header, se fija un `data-theme` explícito en <html> que gana sobre el
   sistema (ver los bloques :root[data-theme=...] en styles.css) y se
   persiste en localStorage para la próxima visita.
*/
const Theme = (() => {
  const KEY = 'theme'; // 'light' | 'dark' | ausente = seguir al sistema

  function apply(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    updateIcon();
  }

  function current() {
    const stored = Storage.get(KEY, null);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateIcon() {
    const isDark = current() === 'dark';
    const sun = document.getElementById('themeIconSun');
    const moon = document.getElementById('themeIconMoon');
    if (sun) sun.classList.toggle('hidden', isDark);
    if (moon) moon.classList.toggle('hidden', !isDark);
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    Storage.set(KEY, next);
    apply(next);
  }

  function init() {
    const stored = Storage.get(KEY, null);
    apply(stored);
  }

  return { init, toggle, current };
})();
