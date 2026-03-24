/**
 * Admin UI render helper functions.
 *
 * Responsibilities:
 * - Render overview, builder, and inspector shells.
 * - Keep component invocation glue out of admin-ui.js.
 */

(function initAdminRenderHelpers(global) {
  /**
   * Renders the overview sidebar.
   *
   * @param {object} deps - Render dependencies.
   */
  function renderSidebar(deps) {
    deps.overviewComponent.renderSidebar({
      sidebarContent: document.getElementById("overviewGrid"),
      state: deps.getState(),
      sidebarQuery: deps.getSidebarQuery(),
      overviewTypeFilter: deps.getOverviewTypeFilter(),
      overviewStatusFilter: deps.getOverviewStatusFilter(),
      selectedCampaignId: deps.getSelectedCampaignId(),
      getCards: deps.normalizeCampaignCards,
      escapeHtml: deps.escapeHtml,
      cardTypeLabel: deps.cardTypeLabel,
      toRelativeTime: deps.toRelativeTime,
    });
  }

  /**
   * Renders builder block cards.
   *
   * @param {object} deps - Render dependencies.
   */
  function renderBlocks(deps) {
    deps.builderComponent.renderBlocks({
      blocksEl: document.getElementById("blocks"),
      builder: deps.builder,
      selectedBlockIndex: deps.getSelectedBlockIndex(),
      escapeHtml: deps.escapeHtml,
    });
  }

  /**
   * Renders active campaign inspector panel HTML.
   *
   * @param {object} deps - Render dependencies.
   * @returns {string} Inspector HTML fragment.
   */
  function renderActiveCampaignPanel(deps) {
    return deps.inspectorComponent.renderActiveCampaignPanel({
      state: deps.getState(),
      escapeHtml: deps.escapeHtml,
    });
  }

  /**
   * Renders inspector panel.
   *
   * @param {object} deps - Render dependencies.
   */
  function renderInspector(deps) {
    deps.inspectorComponent.renderInspector({
      inspectorContent: document.getElementById("inspectorContent"),
      selectedBlockIndex: deps.getSelectedBlockIndex(),
      selectedCampaignId: deps.getSelectedCampaignId(),
      builder: deps.builder,
      escapeHtml: deps.escapeHtml,
      activeCampaignPanelHtml: renderActiveCampaignPanel(deps),
    });
  }

  /**
   * Shows add-block menu placeholder behavior.
   *
   * @param {object} deps - Render dependencies.
   */
  function showAddBlockMenu(deps) {
    const types = ["TEXT", "IMAGE", "VIDEO"];
    let html = '<div style="display: flex; gap: 8px; flex-wrap: wrap;">';
    types.forEach((type) => {
      html += `<button class="btn btn-secondary" onclick="addBlockOfType('${type}')">+ ${type}</button>`;
    });
    html += "</div>";
    deps.addBlockOfType("TEXT");
  }

  global.AdminRenderHelpers = {
    renderSidebar,
    renderBlocks,
    renderActiveCampaignPanel,
    renderInspector,
    showAddBlockMenu,
  };
}(window));
