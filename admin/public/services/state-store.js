/**
 * Admin UI state store helpers.
 *
 * Responsibilities:
 * - Define initial admin UI state shape.
 * - Create a mutable state store for gradual modularization.
 * - Expose store helpers on `window.AdminStateStore`.
 */

(function initAdminStateStore(global) {
  /**
   * Creates the default builder draft object.
   *
   * @returns {object} Default builder state.
   */
  function createDefaultBuilder() {
    return {
      type: "idle",
      mode: "new",
      sourceId: "",
      campaignName: "",
      studentUid: "",
      blocks: [],
      campaignId: null,
    };
  }

  /**
   * Creates the initial admin UI state object.
   *
   * @returns {object} Initial UI state container.
   */
  function createInitialUiState() {
    return {
      state: null,
      selectedCampaignId: null,
      selectedBlockIndex: null,
      sidebarQuery: "",
      dragSourceIndex: null,
      overviewTypeFilter: "all",
      overviewStatusFilter: "all",
      builder: createDefaultBuilder(),
      menuBlocks: [],
      builderIssues: [],
      menuIssues: [],
    };
  }

  /**
   * Creates a mutable state store instance.
   *
   * @returns {object} State store API.
   */
  function createStateStore() {
    const uiState = createInitialUiState();

    /**
     * Applies partial scalar updates to the internal state container.
     *
     * @param {object} patch - Partial scalar updates.
     */
    function setSnapshot(patch) {
      Object.assign(uiState, patch || {});
    }

    return {
      getState: () => uiState.state,
      getSelectedCampaignId: () => uiState.selectedCampaignId,
      getSelectedBlockIndex: () => uiState.selectedBlockIndex,
      getSidebarQuery: () => uiState.sidebarQuery,
      getDragSourceIndex: () => uiState.dragSourceIndex,
      getOverviewTypeFilter: () => uiState.overviewTypeFilter,
      getOverviewStatusFilter: () => uiState.overviewStatusFilter,
      getBuilder: () => uiState.builder,
      getMenuBlocks: () => uiState.menuBlocks,
      getBuilderIssues: () => uiState.builderIssues,
      getMenuIssues: () => uiState.menuIssues,
      setSnapshot,
      getSnapshot: () => ({ ...uiState }),
    };
  }

  global.AdminStateStore = {
    createStateStore,
    createInitialUiState,
    createDefaultBuilder,
  };
}(window));
