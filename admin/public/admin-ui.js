/**
 * Admin UI composition root.
 *
 * Responsibilities:
 * - Compose extracted runtime, orchestration, and legacy bridge services.
 * - Keep the browser entry script focused on wiring instead of feature logic.
 */

const uiStateStore = window.AdminStateStore.createStateStore();
const { setStatus, escapeHtml, api } = window.AdminHttp;
const { defaultBlock, makeBlockByType } = window.AdminBlocks;

const runtime = window.AdminRuntimeContext.createRuntimeContext({
  uiStateStore,
  campaignSelectors: window.AdminCampaignSelectors,
  validation: window.AdminValidation,
  setStatus,
  escapeHtml,
  api,
  defaultBlock,
  makeBlockByType,
});

const handlers = window.AdminOrchestrator.createHandlers({
  runtime,
  modules: {
    overviewComponent: window.AdminOverviewComponent,
    builderComponent: window.AdminBuilderComponent,
    inspectorComponent: window.AdminInspectorComponent,
    actions: window.AdminActions,
    uiEvents: window.AdminUiEvents,
    editorState: window.AdminEditorState,
    editorView: window.AdminEditorView,
    editorController: window.AdminEditorController,
    runtimeDeps: window.AdminRuntimeDeps,
    renderHelpers: window.AdminRenderHelpers,
    blockOps: window.AdminBlockOps,
  },
});

Object.assign(runtime, {
  renderSidebar: handlers.renderSidebar,
  renderBlocks: handlers.renderBlocks,
  renderInspector: handlers.renderInspector,
  updateCampaignHeader: handlers.updateCampaignHeader,
  renderBlockEditor: handlers.renderBlockEditor,
  syncFormFromBuilder: handlers.syncFormFromBuilder,
  updateSaveButtons: handlers.updateSaveButtons,
  createNewCampaign: handlers.createNewCampaign,
  refresh: handlers.refresh,
  saveBuilderCampaign: handlers.saveBuilderCampaign,
  publishCampaign: handlers.publishCampaign,
  resetBuilderForType: handlers.resetBuilderForType,
  loadCampaignToEditor: handlers.loadCampaignToEditor,
  renderDuplicateOptions: handlers.renderDuplicateOptions,
  renderIssues: handlers.renderIssues,
  syncInlineBlockErrors: handlers.syncInlineBlockErrors,
  setBuilderFromCampaign: handlers.setBuilderFromCampaign,
  fillInitialData: handlers.fillInitialData,
  deleteCampaignUI: handlers.deleteCampaignUI,
  deleteStudentUI: handlers.deleteStudentUI,
  resolveCampaignIdFromState: handlers.resolveCampaignIdFromState,
});

window.AdminLegacyBridge.bindGlobalHandlers({
  saveBuilderCampaign: handlers.saveBuilderCampaign,
  publishCampaign: handlers.publishCampaign,
  deleteCampaignUI: handlers.deleteCampaignUI,
  deleteStudentUI: handlers.deleteStudentUI,
  deleteCurrentCampaign: handlers.deleteCurrentCampaign,
  addBlock: handlers.addBlock,
  addBlockOfType: handlers.addBlockOfType,
  addMenuBlock: handlers.addMenuBlock,
  removeBlock: handlers.removeBlock,
  moveBlock: handlers.moveBlock,
  updateBlockField: handlers.updateBlockField,
  uploadForBlock: handlers.uploadForBlock,
  loadDuplicateSource: handlers.loadDuplicateSource,
  loadExistingCampaign: handlers.loadExistingCampaign,
  loadExistingStudent: handlers.loadExistingStudent,
  createNewCampaign: handlers.createNewCampaign,
  loadCampaignToEditor: handlers.loadCampaignToEditor,
  duplicateCampaignFromOverview: handlers.duplicateCampaignFromOverview,
  deployCampaignFromOverview: handlers.deployCampaignFromOverview,
  selectBlock: handlers.selectBlock,
  duplicateBlock: handlers.duplicateBlock,
  showBlockMenu: handlers.showBlockMenu,
  showAddBlockMenu: handlers.showAddBlockMenu,
  startDragBlock: handlers.startDragBlock,
  allowDrop: handlers.allowDrop,
  dragEnterBlock: handlers.dragEnterBlock,
  dragLeaveBlock: handlers.dragLeaveBlock,
  endDragBlock: handlers.endDragBlock,
  dropBlock: handlers.dropBlock,
  updateCampaignName: handlers.updateCampaignName,
  changeCampaignType: handlers.changeCampaignType,
  applyActiveSelections: handlers.applyActiveSelections,
  updateStudentUidFromInspector: handlers.updateStudentUidFromInspector,
});

window.AdminLegacyInit = window.AdminLegacyBridge.createLegacyInit({
  bindEvents: handlers.bindEvents,
  resetBuilderForType: handlers.resetBuilderForType,
  syncUiStateStore: runtime.syncUiStateStore,
  refresh: handlers.refresh,
  setStatus,
});
