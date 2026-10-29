# ADR 0091 — Auditoría de código: correcciones aplicadas y pendientes

**Fecha:** 2026-10-29
**Estado:** Aceptada (parte aplicada); la parte pendiente espera decisión de Yako
**Decidido por:** Yako pidió "un repaso serio a la calidad del código, buscando fisuras,
enlaces rotos y cualquier defecto que pudiera generar datos erróneos"

## Método

Cuatro revisiones independientes de solo lectura, una por área: (1) integridad de datos y
sincronización, (2) cálculo de precios y lectura de Excel, (3) pantallas, eventos y enlaces
HTML/JS, (4) exportación y equivalencias. Cada hallazgo se verificó después leyendo el código
y, cuando dependía de datos, **contra los datos reales de Neon** (solo lectura) y los 8 Excel
de equivalencias, ejecutando el código real de la app. Nada se aplicó sin esa comprobación.

Comprobaciones mecánicas: `node --check` sobre los 41 ficheros JS (todos correctos); todos
los ids que usa el JS existen en el HTML y viceversa (sin botones muertos); los 36
`<script>`/`<link>` existen y se cargan en orden válido; no hay XSS (todo dato de Excel/Neon
pasa por `escapeHtml`).

## Corregido

**Datos que podían salir mal**
- **Costes 0 → PVP inventado.** `Pricing.resolveCost` solo excluía `null`: un coste 0,
  negativo o NaN daba un PVP "válido" (0,00 €; con `psy99`, 0,99 €; y en Netos Bonus solo el
  obsequio: 71, 125 y 133 €). Hoy afectaba a 7 refs de AD Parts ("SHT 0W30 High Tech", coste
  factura 0 en la tarifa del 31/08) que podían salir a 0,00 € en el fichero. Ahora un coste
  debe ser finito y > 0, si no es "sin coste". Comprobado sobre las 4.436 filas × 3 niveles
  (11.426 cálculos) con las reglas reales: cambian exactamente esas 7 filas × 3 niveles, nada más.
- **"Valor Regalo 1+1" truncado a 500 filas.** El valor solo se calculaba para las 500 filas
  que se pintan; el Excel descartaba en silencio el resto. Ahora se calcula para todas las visibles.
- **Reimportar UN fichero de Transmisión borraba el otro** (regresión mía del ADR 0085: dos
  ficheros, una categoría). Cada grupo lleva ahora `source` = valor de su columna GAMA y
  `build()` reemplaza solo los de ese fichero. Verificado con los ficheros reales.
- **Ranking: AD PARTS y AD STANDARD comparten columna** y el primero bloqueaba al segundo
  (30 grupos reales traen los dos; en 2 el ranking mostraba "otro formato" y perdía el precio
  de AD Standard). Ahora gana el miembro más resuelto.
- **Referencia repetida en dos grupos** (errata del Excel): ganaba el último, aunque fuera un
  grupo de una sola marca, y se perdían los cruces del bueno. Ahora gana el grupo con más marcas.
- **Litros/formato hacia Neon:** se empujaba `formatKey '?'` y "litros detectados = no" aunque la
  fila ya tuviera litros buenos; el otro PC lo heredaba. Mismas guardias que en local.
  `litersDetected` ya no se reescribe a "no" en cada arranque con filas esqueleto.
- **Exportación con datos de otra marca:** `renderPreview` era asíncrono sin control de orden;
  un cambio rápido de marca podía dejar filas de A exportadas con los márgenes de B. Ahora solo
  aplica la última petición.
- **Checklist de formatos:** se reinicia también al cambiar de marca/gama (antes solo si
  cambiaba el conjunto de formatos; si coincidía, heredaba los desmarcados).
- **PDF de políticas:** "→" salía como caracteres ilegibles (jsPDF/Helvetica no lo soporta);
  sustituido por "->".
- **Fechas en UTC:** entre las 00:00 y las 02:00 la fecha de importación/exportación salía un día
  antes. Nueva `todayLocalISO()` (storage.js) usada en los 11 sitios.
- **Paginación de Neon sin ORDER BY** (tarifas, maestro, reglas): una escritura de otro PC
  durante la carga podía saltar o duplicar filas sin error. Ahora ordena por clave primaria.

**Robustez**
- `Router`: cada navegación programática emitía `screen:changed` dos veces (también en el
  arranque, por el cambio del ADR 0089). Ahora una.
- Botón Exportar: se bloquea mientras genera (doble clic = dos descargas) y muestra el error
  si falla.
- Botón Guardar de la validación de descripciones: se quedaba desactivado para siempre si fallaba
  la red o la descripción estaba vacía.
- Arranque: un fallo en una migración o en una subida inicial ya no deja la app muerta sin
  mensaje (`safeBootStep`).
- Login: `atob` fallaba con JWT en base64url (guiones bajos/medios).
- `psy99`/`psy95`: ruido de coma flotante bajaba un euro (latente: ninguna gama los usa hoy).
- Etiquetas de gama de Eni Live ausentes en Reglas, Comparación y Exportación.
- Manual integrado: textos obsoletos ("5 Excel", "base de datos local", "PVP (Venta)").

## Pendiente — decisiones de diseño (no se tocan sin Yako)

**Sincronización multiusuario (el riesgo más serio que queda):**
1. Las reglas (`RulesStore`) se guardan con "el último gana" sobre el blob entero y `refresh()`
   pisa siempre lo local con lo de Neon: una edición hecha sin red se pierde al reabrir, y dos PCs
   editando a la vez se borran el trabajo (p. ej. PVP manual de uno desaparece al guardar el otro).
2. `hydrateFromNeon` pisa la fila local entera con la de Neon, sin comparar fechas: si una
   importación no llegó a subirse, el siguiente arranque la machaca.
3. Las migraciones "una vez" (`push*Once`) suben datos locales sin comprobar si Neon ya los
   tiene: un PC con datos antiguos que arranca por primera vez puede sobrescribir lo del equipo.
   La limpieza v2 de Netos Bonus borra márgenes iguales a la semilla en cada PC nuevo.
4. Las filas con prefijo antiguo (ADP/CAT) y las de Racing Oil con espacios solo se borran en local.
   Conviene un diseño de sincronización con "cola pendiente" o comparación por fecha; es un cambio
   de arquitectura.

**Lectura de Excel de proveedores (depende de los ficheros reales, no vistos mal hoy):**
- Repsol: coste ×12 en silencio si la cabecera de unidades por caja no encaja con la regex
  ("UDS. X CAJA" no se reconoce).
- Filas con precio en texto ("12,50", "1.234,56") se descartan sin avisar y ningún perfil cuenta
  las filas saltadas.
- Ref numérica de AD pierde ceros finales ("33.1000" → "331" y litros 331).
- Separador de miles leído como decimal ("1.000 L" → 1 L); hoy ninguna descripción lo tiene.
- Castrol "Sustituye a": "OLD1, OLD2" crea una ref falsa y puede duplicar una ref existente.
- `History.diff` con refs duplicadas cuenta mal.

**Pantallas / menor:** `rules:changed` se emite una vez por gama (23 en Shell) y provoca
recargas redundantes; carreras sin control de orden en Comparación y Tarifas; editar "Litros" a mano
en Tarifas no se guarda en el maestro; cabecera "COSTE FACTURA" del Skrit sería incorrecta si algún
nivel PVP usase otra base (hoy las 66 usan factura); nombres de fichero sin gama (Normal/Standard/
Todas se pisan); el recuento "N filas" incluye filas sin PVP; el PDF muestra "2.50 L" con punto.

## Datos propios de Yako (no son código)

7 referencias repetidas en dos grupos y 3 textos que no son referencias ("DOT 5.1" en AD PARTS de
Vehículo Eléctrico; "MAGNATEC 0W20 FE" ×2 en Castrol de Vehículo Ligero) — informe entregado a Yako.

**Tras desplegar:** reimportar los 8 Excel de equivalencias una vez, para que el índice compartido
guarde el campo `source` (hasta entonces, reimportar un solo fichero de Transmisión descarta los
grupos antiguos de esa categoría, que no lo tienen).
