/* ============================================================================
   BOOT
   ============================================================================ */

/** Aviso flotante breve — usado por los botones de cabecera aún sin funcionalidad propia. */
let toastTimer = null;
function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function setupHeaderActions() {
  const btnTheme = document.getElementById('btnThemeToggle');
  if (btnTheme) btnTheme.addEventListener('click', () => Theme.toggle());

  const btnHelp = document.getElementById('btnHelp');
  if (btnHelp) btnHelp.addEventListener('click', () => showToast('Ayuda — próximamente'));

  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) btnSettings.addEventListener('click', () => showToast('Ajustes — próximamente'));

  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) btnLogin.addEventListener('click', () => showToast('Inicio de sesión — próximamente'));
}

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Migration.run();
  ScreenImport.init();
  ScreenRules.init();
  ScreenCompare.init();
  ScreenExport.init();
  setupHeaderActions();
  Router.init();
});
