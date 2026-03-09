/**
 * Admin UI monolith bootstrap.
 *
 * Responsibilities:
 * - Orchestrate campaign builder rendering and interactions.
 * - Coordinate HTTP calls, validation, and view updates.
 * - Bridge legacy global handlers while feature modules are extracted.
 */

const uiStateStore = window.AdminStateStore.createStateStore();
const campaignSelectors = window.AdminCampaignSelectors;
const validation = window.AdminValidation;
const overviewComponent = window.AdminOverviewComponent;
const builderComponent = window.AdminBuilderComponent;
const inspectorComponent = window.AdminInspectorComponent;
const actions = window.AdminActions;
const uiEvents = window.AdminUiEvents;
const editorState = window.AdminEditorState;
const editorView = window.AdminEditorView;
const editorController = window.AdminEditorController;
const runtimeDeps = window.AdminRuntimeDeps;
const renderHelpers = window.AdminRenderHelpers;
const blockOps = window.AdminBlockOps;

let state = uiStateStore.getState();
let selectedCampaignId = uiStateStore.getSelectedCampaignId();
let selectedBlockIndex = uiStateStore.getSelectedBlockIndex();
let sidebarQuery = uiStateStore.getSidebarQuery();
let dragSourceIndex = uiStateStore.getDragSourceIndex();
let overviewTypeFilter = uiStateStore.getOverviewTypeFilter();
let overviewStatusFilter = uiStateStore.getOverviewStatusFilter();

const builder = uiStateStore.getBuilder();
let menuBlocks = uiStateStore.getMenuBlocks();
let builderIssues = uiStateStore.getBuilderIssues();
let menuIssues = uiStateStore.getMenuIssues();
const { setStatus, escapeHtml, api } = window.AdminHttp;
const { defaultBlock, makeBlockByType } = window.AdminBlocks;

/**
 * Synchronizes mutable top-level variables into the extracted UI state store.
 */
function syncUiStateStore() {
  uiStateStore.setSnapshot({
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

const runtime = {
  builder,
  defaultBlock,
  makeBlockByType,
  setStatus,
  escapeHtml,
  api,
  getState: () => state,
  setState: (value) => {
    state = value;
  },
  getMenuBlocks: () => menuBlocks,
  getMenuIssues: () => menuIssues,
  setBuilderIssues: (issues) => {
    builderIssues = issues;
  },
  setMenuIssues: (issues) => {
    menuIssues = issues;
  },
  syncUiStateStore,
  findStudentCampaignByUid,
  getCampaignsByType,
  cardTypeLabel,
  toRelativeTime,
  normalizeCampaignCards,
  validateBuilder,
  validateMenu,
  normalizeBlock,
  getBlockIssues,
  issuePathToInputId,
  getSelectedCampaignId: () => selectedCampaignId,
  setSelectedCampaignId: (value) => {
    selectedCampaignId = value;
  },
  getSelectedBlockIndex: () => selectedBlockIndex,
  setSelectedBlockIndex: (value) => {
    selectedBlockIndex = value;
  },
  getSidebarQuery: () => sidebarQuery,
  getOverviewTypeFilter: () => overviewTypeFilter,
  getOverviewStatusFilter: () => overviewStatusFilter,
  getDragSourceIndex: () => dragSourceIndex,
  setDragSourceIndex: (value) => {
    dragSourceIndex = value;
  },
};

function getActionDeps() {
  return runtimeDeps.buildActionDeps(runtime);
}

function getEditorStateDeps() {
  return runtimeDeps.buildEditorStateDeps(runtime);
}

function getBlockOpsDeps() {
  return runtimeDeps.buildBlockOpsDeps(runtime);
}

function getEditorViewDeps() {
  return runtimeDeps.buildEditorViewDeps(runtime);
}

function getControllerDeps() {
  return runtimeDeps.buildControllerDeps(runtime);
}

function findStudentCampaignByUid(uid) {
  return campaignSelectors.findStudentCampaignByUid(state, uid);
}

function getCampaignsByType(type) {
  return campaignSelectors.getCampaignsByType(state, type);
}

function toRelativeTime(isoString) {
  return campaignSelectors.toRelativeTime(isoString);
}

function normalizeCampaignCards() {
  return campaignSelectors.normalizeCampaignCards(state);
}

function cardTypeLabel(kind) {
  return campaignSelectors.cardTypeLabel(kind);
}

/* ===== SIDEBAR RENDERING ===== */
function renderSidebar() {
  renderHelpers.renderSidebar({
    overviewComponent,
    getState: runtime.getState,
    getSidebarQuery: runtime.getSidebarQuery,
    getOverviewTypeFilter: runtime.getOverviewTypeFilter,
    getOverviewStatusFilter: runtime.getOverviewStatusFilter,
    getSelectedCampaignId: runtime.getSelectedCampaignId,
    normalizeCampaignCards,
    escapeHtml,
    cardTypeLabel,
    toRelativeTime,
  });
}

function duplicateCampaignFromOverview(type, id) {
  return editorState.duplicateCampaignFromOverviewState(getEditorStateDeps(), type, id);
}

async function deployCampaignFromOverview(type, id) {
  return editorController.deployCampaignFromOverviewState(getControllerDeps(), type, id);
}

/* ===== BLOCK CARD RENDERING ===== */
function renderBlocks() {
  renderHelpers.renderBlocks({
    builderComponent,
    builder,
    getSelectedBlockIndex: runtime.getSelectedBlockIndex,
    escapeHtml,
  });
}

/* ===== INSPECTOR PANEL RENDERING ===== */
function renderInspector() {
  renderHelpers.renderInspector({
    inspectorComponent,
    builder,
    getState: runtime.getState,
    getSelectedBlockIndex: runtime.getSelectedBlockIndex,
    getSelectedCampaignId: runtime.getSelectedCampaignId,
    escapeHtml,
  });
}

/* ===== UI INTERACTION HANDLERS ===== */
function createNewCampaign() {
  return editorController.createNewCampaignState(getControllerDeps());
}

function loadCampaignToEditor(type, campaignId) {
  return editorState.loadCampaignToEditorState(getEditorStateDeps(), type, campaignId);
}

function selectBlock(idx) {
  return editorController.selectBlockState(getControllerDeps(), idx);
}

function updateCampaignHeader() {
  editorView.updateCampaignHeader(getEditorViewDeps());
}

function updateCampaignName(newName) {
  return editorController.updateCampaignNameState(getControllerDeps(), newName);
}

function updateStudentUidFromInspector(value) {
  return editorController.updateStudentUidState(getControllerDeps(), value);
}

function renderActiveCampaignPanel() {
  return renderHelpers.renderActiveCampaignPanel({
    inspectorComponent,
    getState: runtime.getState,
    escapeHtml,
  });
}

async function applyActiveSelections() {
  return actions.applyActiveSelectionsAction(getActionDeps());
}

function changeCampaignType(newType) {
  return editorController.changeCampaignTypeState(getControllerDeps(), newType);
}

function resolveCampaignIdFromState(kind, campaignName) {
  return editorController.resolveCampaignIdFromState(getControllerDeps(), kind, campaignName);
}

function showBlockMenu(idx) {
  selectBlock(idx);
}

function duplicateBlock(idx) {
  return blockOps.duplicateBlockState(getBlockOpsDeps(), idx);
}

function startDragBlock(event, idx) {
  return blockOps.startDragBlockState(getBlockOpsDeps(), event, idx);
}

function allowDrop(event) {
  return blockOps.allowDropState(event);
}

function dragEnterBlock(event, targetIdx) {
  return blockOps.dragEnterBlockState(getBlockOpsDeps(), event, targetIdx);
}

function dragLeaveBlock(event) {
  return blockOps.dragLeaveBlockState(event);
}

function endDragBlock() {
  return blockOps.endDragBlockState(getBlockOpsDeps());
}

function dropBlock(event, targetIdx) {
  return blockOps.dropBlockState(getBlockOpsDeps(), event, targetIdx);
}

function showAddBlockMenu() {
  return renderHelpers.showAddBlockMenu({
    addBlockOfType,
  });
}

function renderBuilderTypeOptions() {
  editorView.renderBuilderTypeOptions(getEditorViewDeps());
}

function renderDuplicateOptions() {
  editorView.renderDuplicateOptions(getEditorViewDeps());
}

function getBlockIssues(issues, idx, field) {
  return validation.getBlockIssues(issues, idx, field);
}

function issuePathToInputId(scope, path) {
  return validation.issuePathToInputId(scope, path);
}

function renderIssues(targetId, issues, scope) {
  editorView.renderIssues(getEditorViewDeps(), targetId, issues, scope);
}

function validateBuilder() {
  return validation.validateBuilder(builder);
}

function validateMenu() {
  const menuNameEl = document.getElementById("menuName");
  const menuName = menuNameEl ? String(menuNameEl.value || "") : "";
  return validation.validateMenu(menuBlocks, menuName);
}

function normalizeBlock(block) {
  return {
    contentId: String(block.contentId || "").trim(),
    type: String(block.type || "TEXT").toUpperCase(),
    data: String(block.data || "").trim(),
    order: Number(block.order),
    durationSec: Number(block.durationSec),
  };
}

function updateSaveButtons() {
  return editorController.updateSaveButtonsState(getControllerDeps());
}

function syncInlineBlockErrors(containerId, blocks, issues) {
  editorView.syncInlineBlockErrors(getEditorViewDeps(), containerId, blocks, issues);
}

function renderBlockEditor(containerId, blocks, issues, options = {}) {
  builderComponent.renderBlockEditor({
    containerId,
    blocks,
    issues,
    isMenu: Boolean(options.isMenu),
    builderType: builder.type,
    escapeHtml,
    getBlockIssues,
  });
}

function syncFormFromBuilder() {
  editorView.syncFormFromBuilder(getEditorViewDeps());
}

function resetBuilderForType(type) {
  editorView.resetBuilderForType(getEditorViewDeps(), type);
}

function setBuilderFromCampaign(campaign, type, studentUid = "") {
  editorView.setBuilderFromCampaign(getEditorViewDeps(), campaign, type, studentUid);
}

function fillInitialData() {
  editorView.fillInitialData(getEditorViewDeps());
}

async function refresh() {
  return actions.refreshAction(getActionDeps());
}

async function publishCampaign() {
  return actions.publishCampaignAction(getActionDeps());
}

async function saveBuilderCampaign() {
  return actions.saveBuilderCampaignAction(getActionDeps());
}

async function deleteCampaignUI(campaignId) {
  return actions.deleteCampaignAction(getActionDeps(), campaignId);
}

async function deleteStudentUI(uid) {
  return actions.deleteStudentAction(getActionDeps(), uid);
}

async function deleteCurrentCampaign() {
  return actions.deleteCurrentCampaignAction(getActionDeps());
}

function addBlock() {
  return blockOps.addBlockState(getBlockOpsDeps(), "TEXT");
}

function addBlockOfType(type) {
  return blockOps.addBlockState(getBlockOpsDeps(), type);
}

function addMenuBlock() {
  return blockOps.addMenuBlockState(getBlockOpsDeps());
}

function removeBlock(containerId, idx) {
  return blockOps.removeBlockState(getBlockOpsDeps(), containerId, idx);
}

function moveBlock(containerId, idx, dir) {
  return blockOps.moveBlockState(getBlockOpsDeps(), containerId, idx, dir);
}

function updateBlockField(containerId, idx, field, value) {
  return blockOps.updateBlockFieldState(getBlockOpsDeps(), containerId, idx, field, value);
}

async function uploadForBlock(containerId, idx) {
  return actions.uploadForBlockAction(getActionDeps(), containerId, idx);
}

function loadDuplicateSource() {
  return editorState.loadDuplicateSourceState(getEditorStateDeps());
}

function loadExistingCampaign(type, campaignId) {
  return editorState.loadExistingCampaignState(getEditorStateDeps(), type, campaignId);
}

function loadExistingStudent(uid) {
  return editorState.loadExistingStudentState(getEditorStateDeps(), uid);
}

function bindEvents() {
  uiEvents.bindEvents({
    builder,
    resetBuilderForType,
    renderInspector,
    renderSidebar,
    renderDuplicateOptions,
    loadDuplicateSource,
    updateCampaignName,
    updateSaveButtons,
    syncUiStateStore,
    setSidebarQuery: (value) => {
      sidebarQuery = value;
    },
    setOverviewTypeFilter: (value) => {
      overviewTypeFilter = value;
    },
    setOverviewStatusFilter: (value) => {
      overviewStatusFilter = value;
    },
  });
}

runtime.renderSidebar = renderSidebar;
runtime.renderBlocks = renderBlocks;
runtime.renderInspector = renderInspector;
runtime.updateCampaignHeader = updateCampaignHeader;
runtime.renderBlockEditor = renderBlockEditor;
runtime.syncFormFromBuilder = syncFormFromBuilder;
runtime.updateSaveButtons = updateSaveButtons;
runtime.createNewCampaign = createNewCampaign;
runtime.refresh = refresh;
runtime.saveBuilderCampaign = saveBuilderCampaign;
runtime.publishCampaign = publishCampaign;
runtime.resetBuilderForType = resetBuilderForType;
runtime.loadCampaignToEditor = loadCampaignToEditor;
runtime.renderDuplicateOptions = renderDuplicateOptions;
runtime.renderIssues = renderIssues;
runtime.syncInlineBlockErrors = syncInlineBlockErrors;
runtime.setBuilderFromCampaign = setBuilderFromCampaign;
runtime.fillInitialData = fillInitialData;
runtime.deleteCampaignUI = deleteCampaignUI;
runtime.deleteStudentUI = deleteStudentUI;

window.saveBuilderCampaign = saveBuilderCampaign;
window.publishCampaign = publishCampaign;
window.deleteCampaignUI = deleteCampaignUI;
window.deleteStudentUI = deleteStudentUI;
window.deleteCurrentCampaign = deleteCurrentCampaign;
window.addBlock = addBlock;
window.addBlockOfType = addBlockOfType;
window.addMenuBlock = addMenuBlock;
window.removeBlock = removeBlock;
window.moveBlock = moveBlock;
window.updateBlockField = updateBlockField;
window.uploadForBlock = uploadForBlock;
window.loadDuplicateSource = loadDuplicateSource;
window.loadExistingCampaign = loadExistingCampaign;
window.loadExistingStudent = loadExistingStudent;
window.createNewCampaign = createNewCampaign;
window.loadCampaignToEditor = loadCampaignToEditor;
window.duplicateCampaignFromOverview = duplicateCampaignFromOverview;
window.deployCampaignFromOverview = deployCampaignFromOverview;
window.selectBlock = selectBlock;
window.duplicateBlock = duplicateBlock;
window.showBlockMenu = showBlockMenu;
window.showAddBlockMenu = showAddBlockMenu;
window.updateCampaignName = updateCampaignName;
window.changeCampaignType = changeCampaignType;
window.applyActiveSelections = applyActiveSelections;
window.updateStudentUidFromInspector = updateStudentUidFromInspector;
/**
 * Legacy admin UI boot entrypoint.
 */
window.AdminLegacyInit = function AdminLegacyInit() {
  bindEvents();
  resetBuilderForType("idle");
  syncUiStateStore();
  refresh().catch((e) => setStatus(e.message || "Failed to load", false, e.issues || []));
};
