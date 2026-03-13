/**
 * Admin UI orchestration helpers.
 *
 * Responsibilities:
 * - Compose extracted services into the legacy browser UI behavior.
 * - Keep admin-ui.js focused on composition instead of coordination logic.
 */

(function initAdminOrchestrator(global) {
  /**
   * Creates legacy admin UI handlers.
   *
   * @param {object} deps - Orchestrator dependencies.
   * @returns {object} Handler registry.
   */
  function createHandlers(deps) {
    const {
      runtime,
      modules,
    } = deps;

    /**
     * Builds action dependency set.
     *
     * @returns {object} Action dependencies.
     */
    function getActionDeps() {
      return modules.runtimeDeps.buildActionDeps(runtime);
    }

    /**
     * Builds editor-state dependency set.
     *
     * @returns {object} Editor-state dependencies.
     */
    function getEditorStateDeps() {
      return modules.runtimeDeps.buildEditorStateDeps(runtime);
    }

    /**
     * Builds block operation dependency set.
     *
     * @returns {object} Block operation dependencies.
     */
    function getBlockOpsDeps() {
      return modules.runtimeDeps.buildBlockOpsDeps(runtime);
    }

    /**
     * Builds editor-view dependency set.
     *
     * @returns {object} Editor-view dependencies.
     */
    function getEditorViewDeps() {
      return modules.runtimeDeps.buildEditorViewDeps(runtime);
    }

    /**
     * Builds controller dependency set.
     *
     * @returns {object} Controller dependencies.
     */
    function getControllerDeps() {
      return modules.runtimeDeps.buildControllerDeps(runtime);
    }

    function renderSidebar() {
      modules.renderHelpers.renderSidebar({
        overviewComponent: modules.overviewComponent,
        getState: runtime.getState,
        getSidebarQuery: runtime.getSidebarQuery,
        getOverviewTypeFilter: runtime.getOverviewTypeFilter,
        getOverviewStatusFilter: runtime.getOverviewStatusFilter,
        getSelectedCampaignId: runtime.getSelectedCampaignId,
        normalizeCampaignCards: runtime.normalizeCampaignCards,
        escapeHtml: runtime.escapeHtml,
        cardTypeLabel: runtime.cardTypeLabel,
        toRelativeTime: runtime.toRelativeTime,
      });
    }

    function duplicateCampaignFromOverview(type, id) {
      return modules.editorState.duplicateCampaignFromOverviewState(getEditorStateDeps(), type, id);
    }

    async function deployCampaignFromOverview(type, id) {
      return modules.editorController.deployCampaignFromOverviewState(getControllerDeps(), type, id);
    }

    function renderBlocks() {
      modules.renderHelpers.renderBlocks({
        builderComponent: modules.builderComponent,
        builder: runtime.builder,
        getSelectedBlockIndex: runtime.getSelectedBlockIndex,
        escapeHtml: runtime.escapeHtml,
      });
    }

    function renderInspector() {
      modules.renderHelpers.renderInspector({
        inspectorComponent: modules.inspectorComponent,
        builder: runtime.builder,
        getState: runtime.getState,
        getSelectedBlockIndex: runtime.getSelectedBlockIndex,
        getSelectedCampaignId: runtime.getSelectedCampaignId,
        escapeHtml: runtime.escapeHtml,
      });
    }

    function createNewCampaign() {
      return modules.editorController.createNewCampaignState(getControllerDeps());
    }

    function loadCampaignToEditor(type, campaignId) {
      return modules.editorState.loadCampaignToEditorState(getEditorStateDeps(), type, campaignId);
    }

    function selectBlock(idx) {
      return modules.editorController.selectBlockState(getControllerDeps(), idx);
    }

    function updateCampaignHeader() {
      modules.editorView.updateCampaignHeader(getEditorViewDeps());
    }

    function updateCampaignName(newName) {
      return modules.editorController.updateCampaignNameState(getControllerDeps(), newName);
    }

    function updateStudentUidFromInspector(value) {
      return modules.editorController.updateStudentUidState(getControllerDeps(), value);
    }

    function renderActiveCampaignPanel() {
      return modules.renderHelpers.renderActiveCampaignPanel({
        inspectorComponent: modules.inspectorComponent,
        getState: runtime.getState,
        escapeHtml: runtime.escapeHtml,
      });
    }

    async function applyActiveSelections() {
      return modules.actions.applyActiveSelectionsAction(getActionDeps());
    }

    function changeCampaignType(newType) {
      return modules.editorController.changeCampaignTypeState(getControllerDeps(), newType);
    }

    function resolveCampaignIdFromState(kind, campaignName) {
      return modules.editorController.resolveCampaignIdFromState(getControllerDeps(), kind, campaignName);
    }

    function showBlockMenu(idx) {
      selectBlock(idx);
    }

    function duplicateBlock(idx) {
      return modules.blockOps.duplicateBlockState(getBlockOpsDeps(), idx);
    }

    function startDragBlock(event, idx) {
      return modules.blockOps.startDragBlockState(getBlockOpsDeps(), event, idx);
    }

    function allowDrop(event) {
      return modules.blockOps.allowDropState(event);
    }

    function dragEnterBlock(event, targetIdx) {
      return modules.blockOps.dragEnterBlockState(getBlockOpsDeps(), event, targetIdx);
    }

    function dragLeaveBlock(event) {
      return modules.blockOps.dragLeaveBlockState(event);
    }

    function endDragBlock() {
      return modules.blockOps.endDragBlockState(getBlockOpsDeps());
    }

    function dropBlock(event, targetIdx) {
      return modules.blockOps.dropBlockState(getBlockOpsDeps(), event, targetIdx);
    }

    function showAddBlockMenu() {
      return modules.renderHelpers.showAddBlockMenu({
        addBlockOfType,
      });
    }

    function renderBuilderTypeOptions() {
      modules.editorView.renderBuilderTypeOptions(getEditorViewDeps());
    }

    function renderDuplicateOptions() {
      modules.editorView.renderDuplicateOptions(getEditorViewDeps());
    }

    function renderIssues(targetId, issues, scope) {
      modules.editorView.renderIssues(getEditorViewDeps(), targetId, issues, scope);
    }

    function updateSaveButtons() {
      return modules.editorController.updateSaveButtonsState(getControllerDeps());
    }

    function syncInlineBlockErrors(containerId, blocks, issues) {
      modules.editorView.syncInlineBlockErrors(getEditorViewDeps(), containerId, blocks, issues);
    }

    function renderBlockEditor(containerId, blocks, issues, options = {}) {
      modules.builderComponent.renderBlockEditor({
        containerId,
        blocks,
        issues,
        isMenu: Boolean(options.isMenu),
        builderType: runtime.builder.type,
        escapeHtml: runtime.escapeHtml,
        getBlockIssues: runtime.getBlockIssues,
      });
    }

    function syncFormFromBuilder() {
      modules.editorView.syncFormFromBuilder(getEditorViewDeps());
    }

    function resetBuilderForType(type) {
      modules.editorView.resetBuilderForType(getEditorViewDeps(), type);
    }

    function setBuilderFromCampaign(campaign, type, studentUid = "") {
      modules.editorView.setBuilderFromCampaign(getEditorViewDeps(), campaign, type, studentUid);
    }

    function fillInitialData() {
      modules.editorView.fillInitialData(getEditorViewDeps());
    }

    async function refresh() {
      return modules.actions.refreshAction(getActionDeps());
    }

    async function publishCampaign() {
      return modules.actions.publishCampaignAction(getActionDeps());
    }

    async function saveBuilderCampaign() {
      return modules.actions.saveBuilderCampaignAction(getActionDeps());
    }

    async function deleteCampaignUI(campaignId) {
      return modules.actions.deleteCampaignAction(getActionDeps(), campaignId);
    }

    async function deleteStudentUI(uid) {
      return modules.actions.deleteStudentAction(getActionDeps(), uid);
    }

    async function deleteCurrentCampaign() {
      return modules.actions.deleteCurrentCampaignAction(getActionDeps());
    }

    function addBlock() {
      return modules.blockOps.addBlockState(getBlockOpsDeps(), "TEXT");
    }

    function addBlockOfType(type) {
      return modules.blockOps.addBlockState(getBlockOpsDeps(), type);
    }

    function addMenuBlock() {
      return modules.blockOps.addMenuBlockState(getBlockOpsDeps());
    }

    function removeBlock(containerId, idx) {
      return modules.blockOps.removeBlockState(getBlockOpsDeps(), containerId, idx);
    }

    function moveBlock(containerId, idx, dir) {
      return modules.blockOps.moveBlockState(getBlockOpsDeps(), containerId, idx, dir);
    }

    function updateBlockField(containerId, idx, field, value) {
      return modules.blockOps.updateBlockFieldState(getBlockOpsDeps(), containerId, idx, field, value);
    }

    async function uploadForBlock(containerId, idx) {
      return modules.actions.uploadForBlockAction(getActionDeps(), containerId, idx);
    }

    function loadDuplicateSource() {
      return modules.editorState.loadDuplicateSourceState(getEditorStateDeps());
    }

    function loadExistingCampaign(type, campaignId) {
      return modules.editorState.loadExistingCampaignState(getEditorStateDeps(), type, campaignId);
    }

    function loadExistingStudent(uid) {
      return modules.editorState.loadExistingStudentState(getEditorStateDeps(), uid);
    }

    function bindEvents() {
      modules.uiEvents.bindEvents({
        builder: runtime.builder,
        resetBuilderForType,
        renderInspector,
        renderSidebar,
        renderDuplicateOptions,
        loadDuplicateSource,
        updateCampaignName,
        updateSaveButtons,
        syncUiStateStore: runtime.syncUiStateStore,
        setSidebarQuery: runtime.setSidebarQuery,
        setOverviewTypeFilter: runtime.setOverviewTypeFilter,
        setOverviewStatusFilter: runtime.setOverviewStatusFilter,
      });
    }

    return {
      bindEvents,
      renderSidebar,
      duplicateCampaignFromOverview,
      deployCampaignFromOverview,
      renderBlocks,
      renderInspector,
      createNewCampaign,
      loadCampaignToEditor,
      selectBlock,
      updateCampaignHeader,
      updateCampaignName,
      updateStudentUidFromInspector,
      renderActiveCampaignPanel,
      applyActiveSelections,
      changeCampaignType,
      resolveCampaignIdFromState,
      showBlockMenu,
      duplicateBlock,
      startDragBlock,
      allowDrop,
      dragEnterBlock,
      dragLeaveBlock,
      endDragBlock,
      dropBlock,
      showAddBlockMenu,
      renderBuilderTypeOptions,
      renderDuplicateOptions,
      renderIssues,
      updateSaveButtons,
      syncInlineBlockErrors,
      renderBlockEditor,
      syncFormFromBuilder,
      resetBuilderForType,
      setBuilderFromCampaign,
      fillInitialData,
      refresh,
      publishCampaign,
      saveBuilderCampaign,
      deleteCampaignUI,
      deleteStudentUI,
      deleteCurrentCampaign,
      addBlock,
      addBlockOfType,
      addMenuBlock,
      removeBlock,
      moveBlock,
      updateBlockField,
      uploadForBlock,
      loadDuplicateSource,
      loadExistingCampaign,
      loadExistingStudent,
    };
  }

  global.AdminOrchestrator = {
    createHandlers,
  };
}(window));
