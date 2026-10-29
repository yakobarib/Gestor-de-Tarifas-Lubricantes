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
  const modalSettings = document.getElementById('modalSettings');
  if (btnSettings && modalSettings) {
    btnSettings.addEventListener('click', () => modalSettings.classList.remove('hidden'));
    const btnSettingsClose = document.getElementById('btnSettingsClose');
    if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => modalSettings.classList.add('hidden'));
    document.getElementById('settingsFontSize').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-size]');
      if (btn) FontSize.set(btn.dataset.size);
    });
  }

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
  FontSize.init();
  // Las tarjetas de Importación solo leen metadatos locales (localStorage) — se pintan ya,
  // sin esperar a la sesión ni a las ~6 llamadas de red del arranque; antes aparecían al
  // final, mucho después de las zonas estáticas de rebranding y equivalencias (ADR 0089).
  ScreenImport.renderBrandCards();
  const loggedIn = await Auth.init();
  if (!loggedIn) { Auth.showLoginOverlay(finishBoot); return; }
  await finishBoot();
});

/** Un paso de arranque que falla (IndexedDB bloqueado, migración rota…) no debe dejar la app
 *  muerta sin pantallas ni mensaje: se avisa y se sigue con lo que ya hay (ADR 0091). */
async function safeBootStep(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`Arranque: fallo en "${label}"`, err);
    showToast(`Aviso al arrancar (${label}): ${(err && err.message) || err}`);
    return null;
  }
}

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
  await safeBootStep('subir tarifas locales', () => Migration.pushLocalTariffsToNeonOnce());
  await safeBootStep('subir reglas locales', () => Migration.pushLocalRulesToNeonOnce());
  await safeBootStep('subir equivalencias locales', () => Migration.pushLocalEquivalencesToNeonOnce());
  try {
    await MasterDB.hydrateFromNeon(await NeonTariffs.fetchAll());
  } catch (err) {
    showToast('Sin conexión con las tarifas compartidas del equipo — usando lo que ya había en este ordenador.');
    console.error('NeonTariffs.fetchAll error', err);
  }
  const rulesStatus = await RulesStore.refresh();
  if (rulesStatus.offline) {
    showToast('Sin conexión con las reglas de márgenes compartidas — usando lo que ya había en este ordenador.');
  }
  const equivStatus = await EquivalenceIndex.refresh();
  if (equivStatus.offline) {
    showToast('Sin conexión con las equivalencias compartidas — usando lo que ya había en este ordenador.');
  }
  await safeBootStep('migración de datos', () => Migration.run());
  ScreenImport.init();
  ScreenTarifas.init();
  ScreenRules.init();
  ScreenCompare.init();
  ScreenExport.init();
  ScreenHelp.init();
  setupHeaderActions();
  Router.init();
}
