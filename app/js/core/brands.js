/* ============================================================================
   MÓDULO: brands  (catálogo de marcas/proveedores — data-driven, ver ADR 0008)
   ============================================================================
   Cada entrada: id (= id de perfil ExcelReader cuando existe), label, abbr
   (usada en MARCA / MARCA+REFERENCIA del export unificado), gamas conocidas,
   y `pending` cuando el perfil de lectura todavía no está implementado.
*/
/* `refPrefix`: prefijo que el perfil de lectura ya hornea dentro de `ref` (ver
   ADR 0007/0008) — necesario para reconciliar la ref "bare" de los ficheros de
   equivalencias (que nunca llevan prefijo) con la ref real guardada en
   MasterDB. AD Parts usa 'ADP'; Repsol y el resto no prefijan. */
/* `separateFiles`: la tarjeta de Importación muestra una línea de estado por
   gama en vez de una sola "Tarifa general" — solo tiene sentido cuando esas
   gamas llegan de verdad en ficheros sueltos y en fechas distintas (AD Parts:
   Normal/Standard/Sport Car/Químicos). El resto de proveedores con varias
   gamas (Repsol, Eni Live, Racing Oil, Shell) siempre llegan en un único
   Excel con una pestaña por gama, así que se resumen en una sola línea. */
const BRANDS = [
  { id: 'ad_parts_aceite', label: 'AD Parts', abbr: 'ADP', color: '#3b82f6', refPrefix: 'ADP', gamas: ['normal', 'standard', 'sportcar', 'quimico'], separateFiles: true, pending: false },
  { id: 'repsol', label: 'Repsol', abbr: 'REP', color: '#f97316', refPrefix: '', gamas: ['automocion', 'industria', 'productos-de-mantenimiento', 'marinos', 'grasas', 'alimentarios'], pending: false },
  { id: 'castrol', label: 'Castrol', abbr: 'CAT', color: '#8b5cf6', refPrefix: '', gamas: ['default'], pending: true },
  { id: 'shell', label: 'Shell', abbr: 'SHL', color: '#f43f5e', refPrefix: '', gamas: ['advance', 'air-tool', 'corena', 'diala', 'gadinia', 'gadus', 'heat-transfer', 'helix', 'hydraulic', 'morlina', 'omala', 'ondina', 'paper-mach', 'refrigeration', 'rimula', 'sirius', 'spirax', 'tegula', 'tellus', 'tonna', 'transmission', 'turbo', 'vacuum-pump'], pending: false },
  { id: 'eni', label: 'Eni Live', abbr: 'ENI', color: '#eab308', refPrefix: '', gamas: ['i-sint', 'i-sigma', 'rotra', 'industria', 'i-ride', 'food-line', 'grasas', 'forestal', 'anticongelantes'], pending: false },
  { id: 'racing_oil', label: 'Racing Oil', abbr: 'RAC', color: '#ef4444', refPrefix: '', gamas: ['v-ligero', 'v-pesado', 'agricola', 'transmision', 'hidraulicos', 'industria', 'grasa', 'moto', 'classic', 'marina', 'anticogelante', 'aditivos'], pending: false }
];

function findBrand(brandId) {
  return BRANDS.find(b => b.id === brandId) || null;
}

/**
 * Alias de nombre de marca tal como aparece en los ficheros de equivalencias
 * de BASE DE CONOCIMIENTO (columnas 'AD PARTS', 'AD STANDARD', 'REPSOL'…) hacia
 * el `brandId:gama` interno de la app. Se amplía conforme se auditen más
 * ficheros de equivalencias o se den de alta más proveedores.
 */
const EQUIV_BRAND_ALIASES = {
  'AD PARTS': 'ad_parts_aceite:normal',
  'AD STANDARD': 'ad_parts_aceite:standard',
  'REPSOL': 'repsol:automocion',
  'CASTROL': 'castrol:default',
  'ENI': 'eni:i-sint',
  'SHELL': 'shell:helix',
  'RACING OIL': 'racing_oil:v-ligero'
};
