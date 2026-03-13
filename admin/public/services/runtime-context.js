/**
 * Admin UI runtime context helpers.
 *
 * Responsibilities:
 * - Centralize mutable admin UI runtime state.
 * - Expose selector and validation helpers to extracted services.
 * - Keep low-level runtime wiring out of admin-ui.js.
 */

(function initAdminRuntimeContext(global) {
  /**
   * Creates one mutable runtime context for the legacy admin UI.
   *
   * @param {object} deps - Runtime dependencies.
   * @returns {object} Runtime context object.
   */
  function createRuntimeContext(deps) {
    const snapshot = deps.uiStateStore.getSnapshot();

    let state = snapshot.state;
    let selectedCampaignId = snapshot.selectedCampaignId;
    let selectedBlockIndex = snapshot.selectedBlockIndex;
    let sidebarQuery = snapshot.sidebarQuery;
    let dragSourceIndex = snapshot.dragSourceIndex;
    let overviewTypeFilter = snapshot.overviewTypeFilter;
    let overviewStatusFilter = snapshot.overviewStatusFilter;
    let menuBlocks = snapshot.menuBlocks;
    let builderIssues = snapshot.builderIssues;
    let menuIssues = snapshot.menuIssues;

    const builder = deps.uiStateStore.getBuilder();

    /**
     * Synchronizes mutable runtime values back into the store snapshot.
     */
    function syncUiStateStore() {
      deps.uiStateStore.setSnapshot({
        state,
        selectedCampaignId,
        selectedBlockIndex,
        sidebarQuery,
        dragSourceIndex,
        overviewTypeFilter,
        overviewStatusFilter,
        menuBlocks,
        builderIssues,
        menuIssues,
      });
    }

    /**
     * Finds one student campaign by UID.
     *
     * @param {string} uid - Student uid.
     * @returns {object|null} Matching campaign payload.
     */
    function findStudentCampaignByUid(uid) {
      return deps.campaignSelectors.findStudentCampaignByUid(state, uid);
    }

    /**
     * Returns campaigns for one type.
     *
     * @param {string} type - Campaign kind.
     * @returns {Array<object>} Campaign list.
     */
    function getCampaignsByType(type) {
      return deps.campaignSelectors.getCampaignsByType(state, type);
    }

    /**
     * Returns relative timestamp text.
     *
     * @param {string} isoString - ISO timestamp.
     * @returns {string} Relative label.
     */
    function toRelativeTime(isoString) {
      return deps.campaignSelectors.toRelativeTime(isoString);
    }

    /**
     * Normalizes overview cards from state.
     *
     * @returns {Array<object>} Normalized campaign cards.
     */
    function normalizeCampaignCards() {
      return deps.campaignSelectors.normalizeCampaignCards(state);
    }

    /**
     * Returns display label for a card type.
     *
     * @param {string} kind - Campaign kind.
     * @returns {string} Display label.
     */
    function cardTypeLabel(kind) {
      return deps.campaignSelectors.cardTypeLabel(kind);
    }

    /**
     * Validates builder draft.
     *
     * @returns {Array<object>} Validation issues.
     */
    function validateBuilder() {
      return deps.validation.validateBuilder(builder);
    }

    /**
     * Validates menu draft from current DOM state.
     *
     * @returns {Array<object>} Validation issues.
     */
    function validateMenu() {
      const menuNameEl = document.getElementById("menuName");
      const menuName = menuNameEl ? String(menuNameEl.value || "") : "";
      return deps.validation.validateMenu(menuBlocks, menuName);
    }

    /**
     * Normalizes one block for API transport.
     *
     * @param {object} block - Raw block payload.
     * @returns {object} Normalized block.
     */
    function normalizeBlock(block) {
      return {
        contentId: String(block.contentId || "").trim(),
        type: String(block.type || "TEXT").toUpperCase(),
        data: String(block.data || "").trim(),
        order: Number(block.order),
        durationSec: Number(block.durationSec),
      };
    }

    return {
      builder,
      defaultBlock: deps.defaultBlock,
      makeBlockByType: deps.makeBlockByType,
      setStatus: deps.setStatus,
      escapeHtml: deps.escapeHtml,
      api: deps.api,
      syncUiStateStore,
      findStudentCampaignByUid,
      getCampaignsByType,
      toRelativeTime,
      normalizeCampaignCards,
      cardTypeLabel,
      validateBuilder,
      validateMenu,
      normalizeBlock,
      getBlockIssues: deps.validation.getBlockIssues,
      issuePathToInputId: deps.validation.issuePathToInputId,
      getState: () => state,
      setState(value) {
        state = value;
      },
      getMenuBlocks: () => menuBlocks,
      setMenuBlocks(value) {
        menuBlocks = value;
      },
      getBuilderIssues: () => builderIssues,
      setBuilderIssues(issues) {
        builderIssues = issues;
      },
      getMenuIssues: () => menuIssues,
      setMenuIssues(issues) {
        menuIssues = issues;
      },
      getSelectedCampaignId: () => selectedCampaignId,
      setSelectedCampaignId(value) {
        selectedCampaignId = value;
      },
      getSelectedBlockIndex: () => selectedBlockIndex,
      setSelectedBlockIndex(value) {
        selectedBlockIndex = value;
      },
      getSidebarQuery: () => sidebarQuery,
      setSidebarQuery(value) {
        sidebarQuery = value;
      },
      getOverviewTypeFilter: () => overviewTypeFilter,
      setOverviewTypeFilter(value) {
        overviewTypeFilter = value;
      },
      getOverviewStatusFilter: () => overviewStatusFilter,
      setOverviewStatusFilter(value) {
        overviewStatusFilter = value;
      },
      getDragSourceIndex: () => dragSourceIndex,
      setDragSourceIndex(value) {
        dragSourceIndex = value;
      },
    };
  }

  global.AdminRuntimeContext = {
    createRuntimeContext,
  };
}(window));
