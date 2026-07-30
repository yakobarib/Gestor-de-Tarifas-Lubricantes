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
const BRANDS = [
  { id: 'repsol', label: 'Repsol', abbr: 'REP', color: '#f97316', refPrefix: '', gamas: ['default'], pending: false },
  { id: 'ad_parts_aceite', label: 'AD Parts — Aceite', abbr: 'ADP', color: '#3b82f6', refPrefix: 'ADP', gamas: ['normal', 'standard', 'sportcar'], pending: false },
  { id: 'ad_parts_quimico', label: 'AD Parts — Producto Químico', abbr: 'ADP', color: '#14b8a6', refPrefix: 'ADP', gamas: ['default'], pending: false },
  { id: 'castrol', label: 'Castrol', abbr: 'CAT', color: '#8b5cf6', refPrefix: '', gamas: ['default'], pending: true },
  { id: 'eni', label: 'Eni Live', abbr: 'ENI', color: '#eab308', refPrefix: '', gamas: ['default'], pending: true },
  { id: 'racing_oil', label: 'Racing Oil', abbr: 'RAC', color: '#ef4444', refPrefix: '', gamas: ['default'], pending: true },
  { id: 'krafft', label: 'Krafft', abbr: 'KRA', color: '#06b6d4', refPrefix: '', gamas: ['default'], pending: true },
  { id: 'shell', label: 'Shell', abbr: 'SHL', color: '#f43f5e', refPrefix: '', gamas: ['default'], pending: true }
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
  'REPSOL': 'repsol:default',
  'CASTROL': 'castrol:default',
  'ENI': 'eni:default',
  'SHELL': 'shell:default'
};
