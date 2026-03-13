/**
 * Admin legacy bridge helpers.
 *
 * Responsibilities:
 * - Bind legacy window callback names to extracted handlers.
 * - Create the legacy boot entrypoint consumed by app.js.
 */

(function initAdminLegacyBridge(global) {
  /**
   * Binds a handler map onto the global window object.
   *
   * @param {object} handlers - Global handler map.
   */
  function bindGlobalHandlers(handlers) {
    Object.entries(handlers || {}).forEach(([key, value]) => {
      global[key] = value;
    });
  }

  /**
   * Creates the legacy init entrypoint.
   *
   * @param {object} deps - Init dependencies.
   * @returns {function(): void} Init function.
   */
  function createLegacyInit(deps) {
    return function AdminLegacyInit() {
      deps.bindEvents();
      deps.resetBuilderForType("idle");
      deps.syncUiStateStore();
      deps.refresh().catch((e) => deps.setStatus(e.message || "Failed to load", false, e.issues || []));
    };
  }

  global.AdminLegacyBridge = {
    bindGlobalHandlers,
    createLegacyInit,
  };
}(window));
