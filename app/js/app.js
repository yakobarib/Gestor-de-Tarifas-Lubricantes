/* ============================================================================
   BOOT
   ============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Migration.run();
  ScreenImport.init();
  ScreenRules.init();
  ScreenCompare.init();
  ScreenExport.init();
  Router.init();
});
