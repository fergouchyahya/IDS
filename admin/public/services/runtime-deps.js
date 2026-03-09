/**
 * Admin UI dependency builder helpers.
 *
 * Responsibilities:
 * - Build dependency objects for extracted frontend services.
 * - Keep dependency-shaping glue out of admin-ui.js.
 */

(function initAdminRuntimeDeps(global) {
  /**
   * Builds action service dependencies.
   *
   * @param {object} runtime - Admin UI runtime.
   * @returns {object} Action dependencies.
   */
  function buildActionDeps(runtime) {
    return {
      api: runtime.api,
      builder: runtime.builder,
      menuBlocks: runtime.getMenuBlocks(),
      setStatus: runtime.setStatus,
      validateBuilder: runtime.validateBuilder,
      normalizeBlock: runtime.normalizeBlock,
      resolveCampaignIdFromState: runtime.resolveCampaignIdFromState,
      renderInspector: runtime.renderInspector,
      renderBlockEditor: runtime.renderBlockEditor,
      syncFormFromBuilder: runtime.syncFormFromBuilder,
      updateSaveButtons: runtime.updateSaveButtons,
      createNewCampaign: runtime.createNewCampaign,
      refresh: runtime.refresh,
      saveBuilderCampaign: runtime.saveBuilderCampaign,
      getState: runtime.getState,
      setState(nextState) {
        runtime.setState(nextState);
        runtime.syncUiStateStore();
      },
      setBuilderIssues(issues) {
        runtime.setBuilderIssues(issues);
        runtime.syncUiStateStore();
      },
      getMenuIssues: runtime.getMenuIssues,
      afterRefresh: runtime.fillInitialData,
      deleteCampaign(campaignId) {
        return runtime.deleteCampaignUI(campaignId);
      },
      deleteStudent(uid) {
        return runtime.deleteStudentUI(uid);
      },
    };
  }

  /**
   * Builds editor-state service dependencies.
   *
   * @param {object} runtime - Admin UI runtime.
   * @returns {object} Editor-state dependencies.
   */
  function buildEditorStateDeps(runtime) {
    return {
      state: runtime.getState(),
      builder: runtime.builder,
      defaultBlock: runtime.defaultBlock,
      setStatus: runtime.setStatus,
      findStudentCampaignByUid: runtime.findStudentCampaignByUid,
      getCampaignsByType: runtime.getCampaignsByType,
      setBuilderFromCampaign: runtime.setBuilderFromCampaign,
      syncFormFromBuilder: runtime.syncFormFromBuilder,
      syncUiStateStore: runtime.syncUiStateStore,
      renderSidebar: runtime.renderSidebar,
      renderBlocks: runtime.renderBlocks,
      renderInspector: runtime.renderInspector,
      updateCampaignHeader: runtime.updateCampaignHeader,
      setSelectedCampaignId: runtime.setSelectedCampaignId,
      setSelectedBlockIndex: runtime.setSelectedBlockIndex,
    };
  }

  /**
   * Builds block operation dependencies.
   *
   * @param {object} runtime - Admin UI runtime.
   * @returns {object} Block operation dependencies.
   */
  function buildBlockOpsDeps(runtime) {
    return {
      builder: runtime.builder,
      menuBlocks: runtime.getMenuBlocks(),
      makeBlockByType: runtime.makeBlockByType,
      setStatus: runtime.setStatus,
      syncUiStateStore: runtime.syncUiStateStore,
      renderBlocks: runtime.renderBlocks,
      renderInspector: runtime.renderInspector,
      updateSaveButtons: runtime.updateSaveButtons,
      syncFormFromBuilder: runtime.syncFormFromBuilder,
      renderMenuEditor() {
        return runtime.renderBlockEditor("menuBlocks", runtime.getMenuBlocks(), runtime.getMenuIssues(), { isMenu: true });
      },
      getSelectedBlockIndex: runtime.getSelectedBlockIndex,
      setSelectedBlockIndex: runtime.setSelectedBlockIndex,
      getDragSourceIndex: runtime.getDragSourceIndex,
      setDragSourceIndex: runtime.setDragSourceIndex,
    };
  }

  /**
   * Builds editor-view dependencies.
   *
   * @param {object} runtime - Admin UI runtime.
   * @returns {object} View dependencies.
   */
  function buildEditorViewDeps(runtime) {
    return {
      builder: runtime.builder,
      defaultBlock: runtime.defaultBlock,
      escapeHtml: runtime.escapeHtml,
      getCampaignsByType: runtime.getCampaignsByType,
      getBlockIssues: runtime.getBlockIssues,
      issuePathToInputId: runtime.issuePathToInputId,
      renderSidebar: runtime.renderSidebar,
      renderBlocks: runtime.renderBlocks,
      renderInspector: runtime.renderInspector,
      updateSaveButtons: runtime.updateSaveButtons,
    };
  }

  /**
   * Builds controller dependencies.
   *
   * @param {object} runtime - Admin UI runtime.
   * @returns {object} Controller dependencies.
   */
  function buildControllerDeps(runtime) {
    return {
      builder: runtime.builder,
      menuBlocks: runtime.getMenuBlocks(),
      api: runtime.api,
      setStatus: runtime.setStatus,
      cardTypeLabel: runtime.cardTypeLabel,
      refresh: runtime.refresh,
      publishCampaign: runtime.publishCampaign,
      loadCampaignToEditor: runtime.loadCampaignToEditor,
      resetBuilderForType: runtime.resetBuilderForType,
      syncUiStateStore: runtime.syncUiStateStore,
      renderSidebar: runtime.renderSidebar,
      renderBlocks: runtime.renderBlocks,
      renderInspector: runtime.renderInspector,
      updateCampaignHeader: runtime.updateCampaignHeader,
      updateSaveButtons: runtime.updateSaveButtons,
      validateBuilder: runtime.validateBuilder,
      validateMenu: runtime.validateMenu,
      renderIssues: runtime.renderIssues,
      syncInlineBlockErrors: runtime.syncInlineBlockErrors,
      getState: runtime.getState,
      setSelectedCampaignId: runtime.setSelectedCampaignId,
      setSelectedBlockIndex: runtime.setSelectedBlockIndex,
      setBuilderIssues: runtime.setBuilderIssues,
      setMenuIssues: runtime.setMenuIssues,
    };
  }

  global.AdminRuntimeDeps = {
    buildActionDeps,
    buildEditorStateDeps,
    buildBlockOpsDeps,
    buildEditorViewDeps,
    buildControllerDeps,
  };
}(window));
