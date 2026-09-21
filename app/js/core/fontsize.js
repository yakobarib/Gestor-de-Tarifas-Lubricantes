/* ============================================================================
   MÓDULO: FontSize  (tamaño de letra de toda la app, ajustable desde Ajustes)
   ============================================================================
   Mismo patrón que Theme (ver theme.js): un `data-font-size` explícito en
   <html> que se persiste en localStorage. "Grande" es el tamaño actual de
   siempre — ausencia del atributo, sin tocar nada — y "Mediano"/"Pequeño"
   reducen el `font-size` del propio <html>. Todo el CSS de la app mide en
   `rem` (comprobado, ni un solo `font-size` en px en toda la hoja de
   estilos), y `rem` siempre es relativo a <html>, así que un solo cambio ahí
   escala de golpe cualquier texto de la app, sin tocar cada regla suelta.
*/
const FontSize = (() => {
  const KEY = 'fontSize'; // 'medium' | 'small' | ausente = 'large' (por defecto)

  function apply(size) {
    if (size === 'medium' || size === 'small') {
      document.documentElement.setAttribute('data-font-size', size);
    } else {
      document.documentElement.removeAttribute('data-font-size');
    }
    updateButtons();
  }

  function current() {
    const stored = Storage.get(KEY, null);
    return (stored === 'medium' || stored === 'small') ? stored : 'large';
  }

  function updateButtons() {
    const size = current();
    document.querySelectorAll('#settingsFontSize .mode-btn').forEach(btn => {
      const active = btn.dataset.size === size;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function set(size) {
    if (size === 'large') Storage.delete(KEY);
    else Storage.set(KEY, size);
    apply(size);
  }

  function init() {
    apply(current());
  }

  return { init, set, current };
})();
