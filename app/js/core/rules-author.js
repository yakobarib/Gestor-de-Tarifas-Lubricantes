/* ============================================================================
   MÓDULO: RulesAuthor  (quién hace el cambio — ADR 0092)
   ============================================================================
   Cada cambio de reglas deja rastro con un NOMBRE escrito por quien lo hace (el email de
   la sesión puede ser una cuenta compartida). El diálogo es obligatorio: no se puede
   cerrar sin escribir un nombre. Para no interrumpir cada tecla, el nombre se recuerda
   mientras se siga trabajando (caduca tras 60 min sin cambios) y se puede cambiar desde
   Ajustes. Aquí también vive el visor del "Historial de cambios".
*/
const RulesAuthor = (() => {
  const IDLE_MS = 60 * 60 * 1000;
  const LAST_NAME_KEY = 'tarifador_v0_author_last';
  let current = null;   // { name, at }
  let asking = null;    // promesa compartida si ya hay un diálogo abierto

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function lastName() { try { return localStorage.getItem(LAST_NAME_KEY) || ''; } catch (e) { return ''; } }
  function rememberLast(n) { try { localStorage.setItem(LAST_NAME_KEY, n); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
  function valid() { return current && (Date.now() - current.at) < IDLE_MS; }

  function ask(title) {
    if (asking) return asking;
    const modal = document.getElementById('modalAuthor');
    const input = document.getElementById('authorName');
    const ok = document.getElementById('btnAuthorOk');
    if (!modal || !input || !ok) return Promise.resolve('Sin identificar');
    document.getElementById('authorTitle').textContent = title || 'Antes de guardar el cambio';
    input.value = (current && current.name) || lastName();
    modal.classList.remove('hidden');
    setTimeout(() => { input.focus(); input.select(); }, 30);
    asking = new Promise((resolve) => {
      const done = () => {
        const name = input.value.trim().replace(/\s+/g, ' ').slice(0, 60);
        if (name.length < 2) { input.classList.add('invalid'); input.focus(); return; }
        input.classList.remove('invalid');
        ok.removeEventListener('click', done);
        input.removeEventListener('keydown', onKey);
        modal.classList.add('hidden');
        current = { name, at: Date.now() };
        rememberLast(name);
        asking = null;
        resolve(name);
      };
      const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } };
      ok.addEventListener('click', done);
      input.addEventListener('keydown', onKey);
    });
    return asking;
  }

  /** Devuelve el nombre de quien está cambiando — pregunta si no lo sabemos o ha caducado. */
  async function ensure() {
    if (valid()) { current.at = Date.now(); return current.name; }
    return ask();
  }

  /** Desde Ajustes: fuerza a escribir (o corregir) el nombre. */
  async function change() {
    current = null;
    const n = await ask('¿Quién hace los cambios?');
    refreshSettingsRow();
    return n;
  }

  function refreshSettingsRow() {
    const el = document.getElementById('settingsAuthorName');
    if (el) el.textContent = valid() ? current.name : '(aún sin indicar)';
  }

  async function showHistory() {
    const modal = document.getElementById('modalHistory');
    const body = document.getElementById('historyBody');
    if (!modal || !body) return;
    modal.classList.remove('hidden');
    refreshSettingsRow();
    body.innerHTML = '<p class="hint">Cargando…</p>';
    try {
      const rows = await RulesAudit.fetchRecent(300);
      if (!rows.length) { body.innerHTML = '<p class="hint">Todavía no hay cambios registrados.</p>'; return; }
      const fmt = (iso) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
      body.innerHTML = '<table class="history-table"><thead><tr><th>Cuándo</th><th>Quién</th><th>Marca / gama</th><th>Qué cambió</th></tr></thead><tbody>' +
        rows.map(r => {
          const list = (r.changes || []).map(c => `<li>${esc(c.label)}: ${esc(c.before == null ? '(vacío)' : c.before)} → ${esc(c.after == null ? '(vacío)' : c.after)}</li>`).join('');
          const detail = list ? `<details><summary>${esc(r.summary)}</summary><ul>${list}</ul></details>` : esc(r.summary);
          return `<tr><td>${esc(fmt(r.changed_at))}</td><td>${esc(r.changed_by_name)}</td><td>${esc(r.brand_id)} · ${esc(r.gama === '__all__' ? 'varias gamas' : r.gama)}</td><td>${detail}</td></tr>`;
        }).join('') + '</tbody></table>';
    } catch (err) {
      console.error('RulesAuthor.showHistory', err);
      body.innerHTML = '<p class="hint">No se pudo leer el historial (¿sin conexión, o la tabla aún no está activada en el Data API de Neon?).</p>';
    }
  }

  function init() {
    const bChange = document.getElementById('btnChangeAuthor');
    if (bChange) bChange.addEventListener('click', change);
    const bHist = document.getElementById('btnShowHistory');
    if (bHist) bHist.addEventListener('click', showHistory);
    const bClose = document.getElementById('btnHistoryClose');
    if (bClose) bClose.addEventListener('click', () => document.getElementById('modalHistory').classList.add('hidden'));
  }

  return { ensure, change, showHistory, init };
})();
