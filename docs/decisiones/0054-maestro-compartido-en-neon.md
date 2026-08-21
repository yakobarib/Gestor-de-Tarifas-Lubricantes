# ADR 0054 — Maestro de descripciones compartido en Neon, con login real

**Fecha:** 2026-08-21
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

El maestro de descripciones/litros verificados vivía en tres capas cliente-only:
`master-descriptions.js` (datos incrustados en el código, había que editarlo y desplegar
a mano), `description-overrides.js` y `local-invalid-refs.js` (correcciones/descartes
guardados solo en el navegador de quien los hizo, hasta que se exportaban y alguien las
incorporaba al código — ver ADR 0052). Esto obligaba a Yako a depender de un desarrollador
para que cualquier validación se volviera permanente y compartida entre dispositivos.

Al intentar incorporar un lote de 74 correcciones exportadas se descubrió que 43 de ellas
ya existían en el maestro con un texto distinto — sin patrón consistente que permitiera
decidir automáticamente cuál era la correcta ("algunas son correctas en local y otras en
maestro"). En vez de seguir reconciliando línea a línea, Yako decide vaciar el maestro
por completo (ver ADR 0053) y, en la misma sesión, cambiar de raíz el mecanismo: que las
validaciones se incorporen solas, sin pasar por un desarrollador.

## Decisión

**Neon** (proyecto "Gestor de Tarifas", ya existente) pasa a ser la única fuente de
verdad de este maestro, vía su **Data API** (PostgREST) y **Neon Auth** (Managed Better
Auth) — sin backend propio, sin Vercel/Netlify/Cloudflare. La app entera queda detrás de
un login real, sustituyendo el botón "Iniciar sesión (próximamente)" de la cabecera.

### Esquema y seguridad

Una tabla, `verified_descriptions` (`brand_id, ref` como clave), con `is_invalid`
sustituyendo tanto `INVALID_REFS` como `LocalInvalidRefs` — descartar una referencia es
un UPSERT con `is_invalid = true`, nunca un DELETE.

Neon Auth (beta) todavía no permite restringir quién puede registrarse — como la URL de
Auth vive en el JS público de la app, cualquiera podría crear una cuenta. Para que eso no
dé acceso real a los datos, la política de seguridad (RLS) no es "cualquier autenticado",
sino una **lista blanca por email** (`allowed_emails`, gestionada a mano por Yako vía
SQL). Verificado en vivo contra el proyecto real: una cuenta no listada puede registrarse
y hacer login, pero no puede leer ni escribir la tabla.

### `file://` deja de funcionar con login

Verificado en vivo: Neon Auth **rechaza el login si la página no tiene un origen real**
("Missing or null Origin") — protección de seguridad de Better Auth, no algo evitable sin
debilitarla para todos. Yako confirma que se acepta perder el soporte de `file://` (abrir
la app haciendo doble clic al fichero) — la app con login requiere HTTP(S) (GitHub Pages,
o un servidor local). El resto de lo verificado sí funciona igual por `file://` que por
HTTP: la carga del módulo ESM del SDK (único `<script type="module">` de toda la app,
`js/core/neon-bridge.mjs`, el resto sigue siendo scripts clásicos) y, sobre HTTP,
`getSession()` recuperando la sesión tras recargar sin pedir credenciales otra vez.

### Caché cliente

`MasterCache` (nuevo) sustituye a los tres módulos borrados: una sola carga completa de
la tabla al arrancar la app (nunca por marca, nunca por import), guardada en memoria y en
un snapshot de IndexedDB para seguir funcionando si Neon no responde al arrancar — la
lectura al importar degrada con gracia. Guardar/descartar una validación (`screen-
tarifas.js`) **no** degrada: si `NeonMaster.upsert()` falla, se avisa con un error visible
y no se aplica el cambio en local — es la única acción donde fallar en silencio
reproduciría el problema que este cambio existe para resolver.

## Ficheros

Borrados: `js/data/master-descriptions.js`, `js/core/description-overrides.js`,
`js/core/local-invalid-refs.js`.

Nuevos: `js/core/neon-bridge.mjs`, `js/core/auth.js`, `js/core/neon-master.js`,
`js/core/master-cache.js`.

Modificados: `app/index.html` (scripts, `#authOverlay`, `#btnLogin`), `js/core/db.js`
(las dos líneas de lookup en `putRows()` pasan a `MasterCache`; IndexedDB sube a versión 2
para añadir el store del snapshot), `js/core/migration.js` (se retira el mecanismo de
versión de `MasterDescriptions.VERSION`, sustituido por un flag de una vez que reaplica
`MasterCache` a las filas ya importadas), `js/app.js` (arranque: login gate →
`MasterCache.refresh()` → resto de siempre), `js/screens/screen-tarifas.js` (guardar/
descartar llaman a `NeonMaster.upsert()`; se retira la UI de "exportar correcciones" del
ADR 0052, ya no hace falta).

## Verificación

Probado en vivo contra el proyecto Neon real, con una cuenta de prueba desechable: login
por HTTP, `getSession()` tras recargar sin pedir credenciales, lectura/escritura
bloqueadas correctamente para un email no listado en `allowed_emails` (`42501`, viola la
política — antes de eso, se confirmó primero que sin ninguna política la tabla estaba
totalmente cerrada por defecto). En la app real: login gate bloquea todas las pantallas
sin sesión, arranca normal tras iniciar sesión, guardar una validación con una cuenta no
autorizada falla de forma visible (`alert`) sin marcar la fila como verificada en
`MasterDB` (`descVerified` se queda en `false`). Consola sin errores en ningún paso.
`node --check` sobre los 7 ficheros JS nuevos/modificados.

Pendiente (siguiente sesión): Yako crea su cuenta real desde la app ya desplegada, se
añade su email a `allowed_emails`, y se cargan a Neon las 6 plantillas de
`Archivo Maestro/` (ya rellenas) como semilla inicial.

## Referencias

- ADR 0043 (maestro de descripciones original), ADR 0046/0047 (versión e inválidas).
- ADR 0052 (exportar correcciones locales — ya no hace falta con este cambio).
- ADR 0053 (vaciado del maestro, disparador de este cambio).
- `js/core/neon-bridge.mjs`, `js/core/auth.js`, `js/core/neon-master.js`,
  `js/core/master-cache.js`, `js/core/db.js`, `js/core/migration.js`, `js/app.js`,
  `js/screens/screen-tarifas.js`.
