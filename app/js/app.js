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
  if (btnHelp) btnHelp.addEventListener('click', () => ScreenHelp.open(Router.current()));

  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) btnSettings.addEventListener('click', () => showToast('Ajustes — próximamente'));

  const btnLogin = document.getElementById('btnLogin');
  if (btnLogin) {
    btnLogin.title = Auth.currentUserEmail() || 'Cuenta';
    btnLogin.addEventListener('click', () => {
      if (confirm(`Sesión: ${Auth.currentUserEmail()}\n\n¿Cerrar sesión?`)) Auth.logout();
    });
  }
}

/** Único choke point de arranque (ver ADR 0054): sin sesión, ninguna pantalla se
 *  inicializa — se muestra el login y solo se sigue cuando entra. */
document.addEventListener('DOMContentLoaded', async () => {
  Theme.init();
  const loggedIn = await Auth.init();
  if (!loggedIn) { Auth.showLoginOverlay(finishBoot); return; }
  await finishBoot();
});

async function finishBoot() {
  const cacheStatus = await MasterCache.refresh();
  if (cacheStatus.offline) {
    showToast(cacheStatus.syncedAt
      ? `Sin conexión con el maestro compartido — usando copia local del ${cacheStatus.syncedAt.slice(0, 10)}`
      : 'Sin conexión con el maestro compartido y sin copia local todavía.');
  }
  // Sube las tarifas que este ordenador ya tuviera importadas (una sola vez) y trae las
  // que otros compañeros hayan importado desde el suyo — antes de Migration.run() para que
  // su applyMasterDescriptions() ya las recalcule con el maestro recién calentado (ver
  // ADR 0060+, extensión del maestro compartido).
  await Migration.pushLocalTariffsToNeonOnce();
  try {
    await MasterDB.hydrateFromNeon(await NeonTariffs.fetchAll());
  } catch (err) {
    showToast('Sin conexión con las tarifas compartidas del equipo — usando lo que ya había en este ordenador.');
    console.error('NeonTariffs.fetchAll error', err);
  }
  await Migration.run();
  ScreenImport.init();
  ScreenTarifas.init();
  ScreenRules.init();
  ScreenCompare.init();
  ScreenExport.init();
  ScreenHelp.init();
  setupHeaderActions();
  Router.init();
}
