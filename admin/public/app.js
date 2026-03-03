/**
 * Admin application orchestrator.
 *
 * Responsibilities:
 * - Start admin UI once all feature scripts are loaded.
 * - Keep bootstrapping separate from legacy implementation details.
 */

(function startAdminApp(global) {
  /**
   * Boots the legacy admin UI entrypoint.
   */
  function init() {
    if (typeof global.AdminLegacyInit === "function") {
      global.AdminLegacyInit();
    }
  }

  global.AdminApp = {
    init,
  };

  init();
}(window));
