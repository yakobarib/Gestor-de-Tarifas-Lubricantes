/* ============================================================================
   MÓDULO: Auth  (login real vía Neon Auth — sustituye el botón "próximamente")
   ============================================================================
   Toda la app queda detrás de este login (ver ADR 0054) — el email tiene que
   estar en la lista blanca `allowed_emails` de Postgres para que la RLS del
   maestro compartido le deje leer/escribir nada; iniciar sesión con un email
   no aprobado funciona (Neon Auth deja registrarse a cualquiera, todavía sin
   forma de restringirlo) pero luego no puede tocar el maestro.
*/
const Auth = (() => {
  let currentEmail = null;

  function neonReady() {
    if (window.__neonClient) return Promise.resolve(window.__neonClient);
    return new Promise((resolve) => {
      window.addEventListener('neon:ready', () => resolve(window.__neonClient), { once: true });
    });
  }

  /** Restaura la sesión si el navegador ya tenía una (cookie entre dominios de Neon
   *  Auth) — no pide login otra vez tras recargar la página. */
  async function init() {
    const client = await neonReady();
    try {
      const { data } = await client.auth.getSession();
      currentEmail = data && data.session ? decodeEmailFromJwt(data.session.token) : null;
    } catch {
      currentEmail = null;
    }
    return isLoggedIn();
  }

  /** El JWT no expone el email como campo aparte en la respuesta de getSession — viene
   *  codificado dentro del propio token (payload base64). Evita depender de un campo de
   *  `data` que podría no estar siempre presente. */
  function decodeEmailFromJwt(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email || null;
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return !!currentEmail;
  }

  function currentUserEmail() {
    return currentEmail;
  }

  async function login(email, password) {
    const client = await neonReady();
    const { data, error } = await client.auth.signIn.email({ email, password });
    if (error || !data) return { ok: false, message: (error && error.message) || 'No se pudo iniciar sesión.' };
    currentEmail = email;
    return { ok: true };
  }

  async function signUp(email, password) {
    const client = await neonReady();
    const { data, error } = await client.auth.signUp.email({ email, password, name: email });
    if (error || !data) return { ok: false, message: (error && error.message) || 'No se pudo crear la cuenta.' };
    currentEmail = email;
    return { ok: true };
  }

  async function logout() {
    try {
      const client = await neonReady();
      if (client.auth.signOut) await client.auth.signOut();
    } catch { /* no bloquea el logout si el servidor no responde */ }
    currentEmail = null;
    location.reload();
  }

  /** Muestra el overlay de login y llama a `onSuccess` en cuanto entra — un solo punto
   *  de entrada, para que `app.js` no tenga que conocer el formulario por dentro. */
  function showLoginOverlay(onSuccess) {
    const overlay = document.getElementById('authOverlay');
    const form = document.getElementById('authForm');
    const errorEl = document.getElementById('authError');
    const emailEl = document.getElementById('authEmail');
    const passEl = document.getElementById('authPassword');
    const submitBtn = document.getElementById('authSubmit');
    const signUpBtn = document.getElementById('authSignUpInstead');

    overlay.classList.remove('hidden');
    errorEl.textContent = '';

    async function attempt(fn) {
      submitBtn.disabled = true;
      errorEl.textContent = '';
      let result;
      try {
        result = await fn(emailEl.value.trim(), passEl.value);
      } catch (err) {
        // El SDK no siempre devuelve {ok:false}: algunos fallos (red, credenciales que
        // no encajan en un caso "normal") lanzan una excepción en vez de resolver con un
        // error — sin este catch, el formulario se quedaba callado sin avisar nada.
        result = { ok: false, message: (err && err.message) || 'Error inesperado.' };
      }
      submitBtn.disabled = false;
      if (!result.ok) { errorEl.textContent = result.message; return; }
      overlay.classList.add('hidden');
      form.removeEventListener('submit', onSubmit);
      signUpBtn.removeEventListener('click', onSignUpClick);
      onSuccess();
    }

    function onSubmit(e) { e.preventDefault(); attempt(login); }
    function onSignUpClick(e) { e.preventDefault(); attempt(signUp); }

    form.addEventListener('submit', onSubmit);
    signUpBtn.addEventListener('click', onSignUpClick);
  }

  return { init, isLoggedIn, currentUserEmail, login, logout, showLoginOverlay };
})();
