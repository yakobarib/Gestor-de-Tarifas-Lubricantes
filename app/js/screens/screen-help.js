/* ============================================================================
   PANTALLA: AYUDA (modal, ver ADR 0031)
   ============================================================================
   Manual fijo, una pestaña por pantalla real de la app. Contenido en HTML
   dentro de este mismo fichero — no depende de datos, es texto estático que
   hay que mantener a mano si cambia el comportamiento de alguna pantalla.
   ============================================================================ */
const ScreenHelp = (() => {
  const $ = (id) => document.getElementById(id);

  const TABS = [
    {
      key: 'import', label: 'Importación', html: `
      <h4>Qué hace esta pantalla</h4>
      <p>Es la única que lee ficheros Excel y los guarda en el maestro (una base de datos
      local en este navegador). Cada marca tiene su propia tarjeta con una zona de
      arrastre — suelta ahí el Excel que envía ese proveedor, o pulsa para elegirlo. La
      app detecta sola de qué proveedor es el fichero; si no coincide con la tarjeta
      donde lo soltaste, avisa antes de continuar.</p>
      <h4>Qué pasa al importar</h4>
      <ul>
        <li>Las referencias se guardan fusionando por referencia: si ya existía, se
        actualiza su coste; si es nueva, se añade. Importar una tarifa nunca borra lo que
        ya había.</li>
        <li>Cada tarjeta muestra cuántas referencias tiene y la fecha de la última
        importación.</li>
        <li>Al terminar, se abre automáticamente Tarifas para revisar lo cargado.</li>
      </ul>
      <h4>Zonas especiales (debajo de las tarjetas)</h4>
      <ul>
        <li><strong>Cruce de rebranding</strong> (Repsol): cuando un producto cambia de
        referencia por un cambio de imagen, este Excel dice "la ref antigua X ahora es la
        Y" — así el histórico de Tarifas no lo trata como un producto nuevo sin
        relación.</li>
        <li><strong>Cruces de referencias entre marcas</strong>: los 5 Excel de
        "Equivalencias" que dicen qué producto de una marca es el mismo que en otra.
        Alimentan la pantalla Comparación — cárgalos aquí una vez (se guardan en el
        navegador, no hace falta repetirlo cada sesión).</li>
      </ul>
      <h4>Casos especiales por proveedor</h4>
      <ul>
        <li><strong>AD Parts</strong>: a veces llega, aparte de la tarifa normal, un
        fichero de "Triple-Neto" (con dos columnas de mes para comparar variación).
        Suéltalo en la misma tarjeta — se detecta solo, elige el mes más reciente de las
        dos columnas, y actualiza el coste triple-neto de las referencias que ya tengas
        importadas (no crea una tarifa nueva ni cambia la fecha de la tarjeta).</li>
        <li><strong>Repsol</strong>: la variante "con aportaciones" rellena a la vez
        factura, neto-neto y triple-neto en la misma importación.</li>
      </ul>
      <h4>Flujo recomendado</h4>
      <ol>
        <li>Cuando llegue una tarifa nueva de un proveedor, suéltala en su tarjeta.</li>
        <li>Si Repsol trae rebranding ese mes, carga también el Excel de cruce.</li>
        <li>La primera vez (o si se actualizan) carga los 5 Excel de equivalencias entre
        marcas.</li>
        <li>Repite por cada proveedor — no hace falta seguir ningún orden entre
        marcas.</li>
      </ol>
    ` },
    {
      key: 'tarifas', label: 'Tarifas', html: `
      <h4>Qué hace esta pantalla</h4>
      <p>Muestra la tarifa importada tal cual está en el maestro, sin ningún cálculo de
      margen — solo para revisar qué se ha importado. Elige marca y gama (o "Todas las
      gamas" para verlas todas juntas) arriba.</p>
      <h4>Columnas</h4>
      <ul>
        <li><strong>Estado</strong>: NUEVA (no estaba en la importación anterior),
        REBRAND (viene de un cruce de rebranding) o sin marca (ya existía, sin cambios
        relevantes de referencia).</li>
        <li><strong>Referencia, Producto, Litros, Coste Envase</strong>: tal cual vienen
        del Excel importado.</li>
      </ul>
      <p>Aquí no se ve el PVP ni el margen — eso se configura en Reglas y se revisa en
      Exportación.</p>
      <h4>Filtros</h4>
      <p>Busca por referencia o producto, filtra por formato (litraje) o por estado (solo
      nuevas / solo estables).</p>
      <h4>Flujo recomendado</h4>
      <p>Después de importar una tarifa, échale un vistazo aquí para confirmar que las
      referencias nuevas o los cambios de coste son los esperados, antes de tocar nada en
      Reglas.</p>
    ` },
    {
      key: 'rules', label: 'Reglas', html: `
      <h4>Qué hace esta pantalla</h4>
      <p>Es la única pantalla donde se configura el margen. Elige marca y gama (o "Todas
      las gamas" — al guardar, difunde la misma configuración a todas las gamas de esa
      marca de golpe, sobrescribiendo cualquier diferencia que hubiera entre ellas). Hay
      siempre exactamente dos tarjetas fijas, que no se pueden eliminar.</p>
      <h4>PVP (la que va a Skrit)</h4>
      <ul>
        <li><strong>Base de coste</strong>: factura, neto-neto o triple-neto — solo se
        ofrecen las que esa marca/gama tenga de verdad auditadas.</li>
        <li><strong>Modo de margen</strong>: sobre venta o sobre compra.</li>
        <li><strong>Margen por defecto</strong>: se aplica a cualquier formato sin un
        margen propio fijado.</li>
        <li><strong>Margen por formato</strong>: fija un % distinto para un litraje
        concreto (ej. bidones de 20L a otro margen que las botellas de 1L).</li>
        <li><strong>"1+2" y "PVP Neto"</strong>: dos botones encendido/apagado por
        formato, en la misma tabla de margen. Al activar uno, sustituye el margen normal
        de ESE formato por una fórmula fija — "1+2" (83,33% sobre venta, solo formatos de
        hasta 5L) o "PVP Neto" (20% bidones / 15% cubas, solo formatos grandes). Son
        mutuamente excluyentes: activar uno apaga el otro para ese mismo formato.</li>
        <li><strong>¿Va a Skrit?</strong>: si esta marca/gama debe subirse a Skrit (casi
        siempre sí).</li>
      </ul>
      <h4>Netos Bonus</h4>
      <p>Una segunda tarifa completamente aparte, para hojas impresas que usan los
      comerciales — nunca va a Skrit. Tiene su propio coste (siempre el más bajo
      disponible: triple-neto, si no neto-neto, si no factura) y su propio margen por
      formato. La fila "Salida impresa" decide qué formatos entran en esa hoja cuando se
      exporte desde Exportación.</p>
      <h4>Flujo recomendado</h4>
      <ol>
        <li>Configura el margen por defecto de cada marca la primera vez.</li>
        <li>Ajusta el margen por formato solo donde de verdad haga falta un % distinto.</li>
        <li>Activa "1+2"/"PVP Neto" solo en los formatos donde de verdad se vaya a hacer
        esa promoción — se puede encender y apagar en cualquier momento, según lo que se
        decida vender ese mes.</li>
        <li>Los cambios aquí se reflejan al instante en Comparación y Exportación, no hace
        falta hacer nada más.</li>
      </ol>
    ` },
    {
      key: 'compare', label: 'Comparación', html: `
      <h4>Qué hace esta pantalla</h4>
      <p>Compara el mismo producto entre las distintas marcas — para ver a qué coste
      compras y a qué PVP vendes ese mismo producto según el proveedor.</p>
      <h4>Antes de usarla</h4>
      <p>Hace falta haber cargado, desde Importación, los 5 Excel de "Equivalencias" que
      dicen qué referencia de una marca es el mismo producto que en otra. Sin eso, la
      búsqueda avisa y no puede continuar.</p>
      <h4>Cómo buscar</h4>
      <ul>
        <li><strong>Referencia directa</strong>: escribe la referencia con o sin el
        prefijo de marca (ej. "ADP32005" o "32005") y pulsa Buscar.</li>
        <li><strong>Cascada de selects</strong>: si no sabes la referencia exacta, elige
        Marca → Gama → Referencia (el desplegable de Referencia muestra también los
        litros de cada una).</li>
      </ul>
      <h4>Qué se muestra</h4>
      <p>Una tarjeta por cada marca que tenga (o pueda tener) el mismo producto, con todos
      los costes auditados que existan (factura, neto-neto, triple-neto) y el PVP
      calculado con la configuración actual de Reglas de esa marca. Si el producto existe
      en otro formato distinto al buscado, se avisa como "en otros formatos" en vez de
      decir que no hay nada.</p>
      <h4>Flujo recomendado</h4>
      <p>Úsala cuando quieras saber si conviene más comprar un producto a un proveedor u
      otro, o para revisar que los PVPs de un mismo producto entre marcas no queden muy
      descolgados entre sí.</p>
    ` },
    {
      key: 'export', label: 'Exportación', html: `
      <h4>Qué hace esta pantalla</h4>
      <p>Genera el fichero final a partir de lo configurado en Reglas — Excel para Skrit,
      o listados/PDF para otros usos. Elige marca, gama (o "Todas") y tipo de
      exportación; la tabla de previsualización muestra siempre exactamente lo que va a
      salir en el fichero.</p>
      <h4>Tipos de exportación</h4>
      <ul>
        <li><strong>PVP (Venta)</strong>: la tabla completa y editable — margen, PVP
        calculado, PVP manual (para forzar un precio distinto en una ref concreta),
        ganancia y margen real. Úsala para revisar/ajustar antes de exportar.</li>
        <li><strong>PVP (Skrit)</strong>: el Excel mínimo tal cual se sube a Skrit —
        Marca, Referencia, Descripción, Litros, Coste de compra y PVP, sin columnas de
        trabajo.</li>
        <li><strong>PVP (Imprimir)</strong>: un PDF sin ningún coste (solo Referencia,
        Producto, Litros y PVP) — para entregar a un cliente o comercial.</li>
        <li><strong>Netos Bonus</strong>: el listado de la tarifa de Netos Bonus
        configurada en Reglas, solo con los formatos marcados "Salida impresa".</li>
        <li><strong>Neto Factura / Neto-Neto / Triple Neto</strong>: listados simples con
        el coste tal cual, sin ningún margen — para consulta o auditoría.</li>
        <li><strong>Valor Regalo 1+1</strong>: solo aparece si algún formato tiene
        activado "1+2" en Reglas — el coste de la caja que se regala en esa promoción,
        para saber cuánto "cuesta" cada 1+1.</li>
      </ul>
      <h4>Filtros</h4>
      <p>Busca por referencia/producto, filtra por formato o por estado (nueva/estable) —
      lo que se ve filtrado en pantalla es exactamente lo que se exporta, tanto en Excel
      como en PDF.</p>
      <h4>Flujo recomendado</h4>
      <ol>
        <li>Revisa y ajusta en "PVP (Venta)" si hace falta tocar algún PVP manual.</li>
        <li>Cambia a "PVP (Skrit)" y exporta el Excel para subir a Skrit.</li>
        <li>Si hace falta una hoja para un comercial o cliente, usa "PVP (Imprimir)".</li>
      </ol>
    ` }
  ];

  let current = 'import';

  function render() {
    $('helpTabs').innerHTML = TABS.map(t =>
      `<div class="help-tab ${t.key === current ? 'active' : ''}" data-tab="${t.key}">${t.label}</div>`
    ).join('');
    const tab = TABS.find(t => t.key === current) || TABS[0];
    $('helpBody').innerHTML = tab.html;
  }

  function open(tabKey) {
    current = TABS.some(t => t.key === tabKey) ? tabKey : 'import';
    render();
    $('helpModal').classList.remove('hidden');
  }

  function close() {
    $('helpModal').classList.add('hidden');
  }

  function init() {
    $('helpTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;
      current = tab.dataset.tab;
      render();
    });
    $('btnHelpClose').addEventListener('click', close);
    $('helpModal').addEventListener('click', (e) => { if (e.target.id === 'helpModal') close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('helpModal').classList.contains('hidden')) close();
    });
  }

  return { init, open, close };
})();
