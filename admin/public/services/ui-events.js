/**
 * Admin UI DOM event binding helpers.
 *
 * Responsibilities:
 * - Bind page-level event listeners.
 * - Delegate callbacks to admin-ui orchestration functions.
 */

(function initAdminUiEvents(global) {
  /**
   * Binds admin UI event listeners.
   *
   * @param {object} deps - Event callback dependencies.
   */
  function bindEvents(deps) {
    const typeEl = document.getElementById("builderType");
    if (typeEl) {
      typeEl.addEventListener("change", (e) => {
        deps.resetBuilderForType(e.target.value);
        deps.renderInspector();
        deps.renderSidebar();
      });
    }

    const modeEl = document.getElementById("builderMode");
    if (modeEl) {
      modeEl.addEventListener("change", (e) => {
        deps.builder.mode = e.target.value;
        deps.renderDuplicateOptions();
        deps.updateSaveButtons();
      });
    }

    const duplicateEl = document.getElementById("duplicateSource");
    if (duplicateEl) {
      duplicateEl.addEventListener("change", (e) => {
        deps.builder.sourceId = e.target.value;
        deps.loadDuplicateSource();
      });
    }

    const campaignNameHeaderEl = document.getElementById("campaignNameInput");
    if (campaignNameHeaderEl) {
      campaignNameHeaderEl.addEventListener("input", (e) => {
        deps.updateCampaignName(e.target.value);
        deps.updateSaveButtons();
      });
    }

    const legacyCampaignNameEl = document.getElementById("campaignName");
    if (legacyCampaignNameEl) {
      legacyCampaignNameEl.addEventListener("input", (e) => {
        deps.builder.campaignName = e.target.value;
        deps.updateSaveButtons();
      });
    }

    const studentUidEl = document.getElementById("studentUid");
    if (studentUidEl) {
      studentUidEl.addEventListener("input", (e) => {
        deps.builder.studentUid = e.target.value;
        deps.updateSaveButtons();
      });
    }

    const menuNameEl = document.getElementById("menuName");
    if (menuNameEl) {
      menuNameEl.addEventListener("input", () => {
        deps.updateSaveButtons();
      });
    }

    const searchEl = document.getElementById("sidebarSearch");
    if (searchEl) {
      searchEl.addEventListener("input", (e) => {
        deps.setSidebarQuery(String(e.target.value || ""));
        deps.syncUiStateStore();
        deps.renderSidebar();
      });
    }

    const typeFilterEl = document.getElementById("overviewTypeFilter");
    if (typeFilterEl) {
      typeFilterEl.addEventListener("change", (e) => {
        deps.setOverviewTypeFilter(String(e.target.value || "all"));
        deps.syncUiStateStore();
        deps.renderSidebar();
      });
    }

    const statusFilterEl = document.getElementById("overviewStatusFilter");
    if (statusFilterEl) {
      statusFilterEl.addEventListener("change", (e) => {
        deps.setOverviewStatusFilter(String(e.target.value || "all"));
        deps.syncUiStateStore();
        deps.renderSidebar();
      });
    }
  }

  global.AdminUiEvents = {
    bindEvents,
  };
}(window));
