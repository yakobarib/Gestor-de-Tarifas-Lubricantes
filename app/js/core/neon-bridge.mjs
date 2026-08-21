/* ============================================================================
   MÓDULO: neon-bridge  (único punto ESM de toda la app — ver ADR 0054)
   ============================================================================
   El resto de la app son scripts clásicos (sin bundler, funciona por HTTP/HTTPS
   igual que en GitHub Pages — ver ADR 0001). `@neondatabase/neon-js` solo se
   distribuye como módulo ES con imports "pelados", así que se carga una sola
   vez aquí desde esm.sh (que sí resuelve esas dependencias) y se deja el
   cliente ya construido en `window.__neonClient` para que los scripts
   clásicos lo usen sin tener que ser ellos mismos módulos.

   Requiere HTTP(S) — Neon Auth rechaza el login si la página no tiene un
   origen real (`file://` no lo tiene). Ver ADR 0054.
*/
import { createClient } from 'https://esm.sh/@neondatabase/neon-js@0.7.0-beta';

const AUTH_URL = 'https://ep-lingering-silence-zadk1obo.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth';
const DATA_URL = 'https://ep-lingering-silence-zadk1obo.apirest.c-2.eu-west-2.aws.neon.tech/neondb/rest/v1';

window.__neonClient = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_URL } });
window.dispatchEvent(new CustomEvent('neon:ready'));
