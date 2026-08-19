/* ============================================================================
   MODULO: MasterDescriptions  (descripciones y litros verificados por Yako)
   ============================================================================
   Datos incrustados en el propio codigo (no un fichero externo) para que la
   app sea autosuficiente. Vaciado por completo el 2026-08-19 (ver ADR 0053):
   el maestro anterior mezclaba datos de fuentes distintas (Excel revisado con
   calma + correcciones sueltas tecleadas en el panel de validación) que
   habían acabado en conflicto entre sí. Se rehace desde cero a partir de un
   Excel por marca en "Archivo Maestro/", revisado por Yako fuera de la app
   antes de incorporarse aquí — mismo mecanismo de siempre (editar DATA y
   hacer commit), solo que ahora con una única fuente de verdad por lote.

   Estructura: DATA[brandId][ref] = [descripcionVerificada, litrosVerificados]
   (litros puede ser null cuando el producto no tiene litraje real, ej. un
   accesorio). Solo se usa como respaldo: MasterDB.putRows() la consulta (junto
   con DescriptionOverrides, que manda si hay una correccion mas reciente
   hecha en pantalla) para sustituir la descripcion/litros que traiga cada
   tarifa de proveedor por la version ya verificada.

   Para AÑADIR referencias nuevas de fabrica (las que Yako valide en el panel
   de Tarifas se guardan en DescriptionOverrides, en el navegador, hasta que
   se incorporen aqui): editar el objeto DATA de abajo y hacer commit — no hay
   proceso automatico, es una decision deliberada para no depender de ningun
   servicio externo (ver ADR 0043).
   ============================================================================ */
const MasterDescriptions = (() => {
  // Sube cada vez que se incorpora un lote nuevo de referencias validadas, o que cambia
  // INVALID_REFS — migration.js lo compara con `applied_master_version` guardado en el
  // navegador para saber si hace falta reaplicar el maestro (y borrar inválidas) a las
  // filas ya importadas (ver ADR 0046/0047).
  const VERSION = 6;

  /** Referencias que el proveedor incluye en su tarifa pero que Yako confirma, tras
   *  revisar el catálogo real, que NO existen como producto — se descartan al importar
   *  (no llegan a guardarse en el maestro) y se borran si ya estaban importadas de antes
   *  (ver ADR 0047). Confirmado 2026-08-17: AD Parts trae "CC [litros]l. [porcentaje]% [color]" en
   *  varios formatos/colores que no corresponden a ningún producto real. */
  const INVALID_REFS = {
    ad_parts_aceite: ['ADP11505', 'ADP16403', 'ADP16502', 'ADP16503', 'ADP16508']
  };

  function isInvalidRef(brandId, ref) {
    const list = INVALID_REFS[brandId];
    return !!(list && list.includes(ref));
  }
  const DATA ={"ad_parts_aceite":{},"repsol":{},"castrol":{},"shell":{},"eni":{},"racing_oil":{}};

  /** {description, liters} verificados, o null si esta referencia no esta
   *  todavia en el maestro de esta marca. */
  function lookup(brandId, ref) {
    const brandData = DATA[brandId];
    if (!brandData) return null;
    const entry = brandData[ref];
    return entry ? { description: entry[0], liters: entry[1] } : null;
  }

  return { lookup, DATA, VERSION, isInvalidRef, INVALID_REFS };
})();
