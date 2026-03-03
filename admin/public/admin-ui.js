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

/**
 * Builds dependency object for action service calls.
 *
 * @returns {object} Action dependencies.
 */
function getActionDeps() {
  return {
    api,
    builder,
    menuBlocks,
    setStatus,
    validateBuilder,
    normalizeBlock,
    resolveCampaignIdFromState,
    renderInspector,
    renderBlockEditor,
    syncFormFromBuilder,
    updateSaveButtons,
    createNewCampaign,
    refresh,
    saveBuilderCampaign,
    getState: () => state,
    setState: (nextState) => {
      state = nextState;
      syncUiStateStore();
    },
    setBuilderIssues: (issues) => {
      builderIssues = issues;
      syncUiStateStore();
    },
    getMenuIssues: () => menuIssues,
    afterRefresh: fillInitialData,
    deleteCampaign: (campaignId) => deleteCampaignUI(campaignId),
    deleteStudent: (uid) => deleteStudentUI(uid),
  };
}

/**
 * Builds dependency object for editor state helper calls.
 *
 * @returns {object} Editor-state dependencies.
 */
function getEditorStateDeps() {
  return {
    state,
    builder,
    defaultBlock,
    setStatus,
    findStudentCampaignByUid,
    getCampaignsByType,
    setBuilderFromCampaign,
    syncFormFromBuilder,
    syncUiStateStore,
    renderSidebar,
    renderBlocks,
    renderInspector,
    updateCampaignHeader,
    setSelectedCampaignId: (value) => {
      selectedCampaignId = value;
    },
    setSelectedBlockIndex: (value) => {
      selectedBlockIndex = value;
    },
  };
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
  overviewComponent.renderSidebar({
    sidebarContent: document.getElementById("overviewGrid"),
    state,
    sidebarQuery,
    overviewTypeFilter,
    overviewStatusFilter,
    selectedCampaignId,
    getCards: normalizeCampaignCards,
    escapeHtml,
    cardTypeLabel,
    toRelativeTime,
  });
}

function duplicateCampaignFromOverview(type, id) {
  return editorState.duplicateCampaignFromOverviewState(getEditorStateDeps(), type, id);
}

async function deployCampaignFromOverview(type, id) {
  if (!state) return;

  try {
    if (type === "idle" || type === "visitor") {
      await api("/api/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idleCampaignId: type === "idle" ? id : state.active?.idleCampaignId,
          visitorCampaignId: type === "visitor" ? id : state.active?.visitorCampaignId,
        }),
      });
      await refresh();
      setStatus(`${cardTypeLabel(type)} campaign deployed`, true);
      return;
    }

    if (type === "menu") {
      loadCampaignToEditor("menu", id);
      await publishCampaign();
      return;
    }

    loadCampaignToEditor("student", id);
    setStatus("Student campaigns are available on NFC tap", true);
  } catch (e) {
    setStatus("Deploy failed", false, e.issues || []);
  }
}

/* ===== BLOCK CARD RENDERING ===== */
function renderBlocks() {
  builderComponent.renderBlocks({
    blocksEl: document.getElementById("blocks"),
    builder,
    selectedBlockIndex,
    escapeHtml,
  });
}

/* ===== INSPECTOR PANEL RENDERING ===== */
function renderInspector() {
  inspectorComponent.renderInspector({
    inspectorContent: document.getElementById("inspectorContent"),
    selectedBlockIndex,
    selectedCampaignId,
    builder,
    escapeHtml,
    activeCampaignPanelHtml: renderActiveCampaignPanel(),
  });
}

function fillSelect(selectEl, options, selectedValue) {
  selectEl.innerHTML = "";
  for (const optData of options) {
    const opt = document.createElement("option");
    opt.value = optData.value;
    opt.textContent = optData.label;
    if (String(optData.value) === String(selectedValue)) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

/* ===== UI INTERACTION HANDLERS ===== */
function createNewCampaign() {
  selectedCampaignId = null;
  selectedBlockIndex = null;
  resetBuilderForType("idle");
  syncUiStateStore();
  renderSidebar();
  renderBlocks();
  renderInspector();
  updateCampaignHeader();
  setStatus("New campaign started", true);
}

function loadCampaignToEditor(type, campaignId) {
  return editorState.loadCampaignToEditorState(getEditorStateDeps(), type, campaignId);
}

function selectBlock(idx) {
  selectedBlockIndex = idx;
  syncUiStateStore();
  renderBlocks();
  renderInspector();
}

function updateCampaignHeader() {
  const nameInput = document.getElementById("campaignNameInput");
  const typeSelect = document.getElementById("builderType");
  const statusBadge = document.getElementById("statusBadge");

  if (nameInput) nameInput.value = builder.campaignName;
  if (typeSelect) typeSelect.value = builder.type;

  if (statusBadge) {
    statusBadge.textContent = builder.blocks.length > 0 ? "Ready" : "Draft";
    statusBadge.className = `status-indicator ${builder.blocks.length > 0 ? "live" : "draft"}`;
  }

  // Update student UID field visibility
  const studentUidWrap = document.getElementById("studentUidWrap");
  if (studentUidWrap) {
    studentUidWrap.style.display = builder.type === "student" ? "block" : "none";
    const studentUidInput = document.getElementById("studentUid");
    if (studentUidInput) studentUidInput.value = builder.studentUid;
  }
}

function updateCampaignName(newName) {
  builder.campaignName = newName;
  updateCampaignHeader();
}

function updateStudentUidFromInspector(value) {
  builder.studentUid = value;
  updateCampaignHeader();
  updateSaveButtons();
}

function renderActiveCampaignPanel() {
  return inspectorComponent.renderActiveCampaignPanel({ state, escapeHtml });
}

async function applyActiveSelections() {
  return actions.applyActiveSelectionsAction(getActionDeps());
}

function changeCampaignType(newType) {
  builder.type = newType;
  // Changing type from inspector means this is now a new unsaved draft.
  builder.campaignId = null;
  selectedCampaignId = null;
  syncUiStateStore();
  updateCampaignHeader();
  renderInspector();
}

function resolveCampaignIdFromState(kind, campaignName) {
  if (!state) return null;
  if (kind === "menu") return state.menuCampaign?.campaignId || "menu-default";
  if (kind === "student") return `student-${String(builder.studentUid || "").trim()}`;

  const list = kind === "idle" ? state.idleCampaigns || [] : state.visitorCampaigns || [];
  const exact = list.find((c) => c.campaignName === campaignName);
  if (exact) return exact.campaignId;
  return list[list.length - 1]?.campaignId || null;
}

function showBlockMenu(idx) {
  // Could be expanded to a dropdown menu with more options
  const options = [
    { label: "Duplicate", action: () => duplicateBlock(idx) },
    { label: "Delete", action: () => removeBlock("blocks", idx) },
  ];
  // For now, just allow selection
  selectBlock(idx);
}

function duplicateBlock(idx) {
  if (!builder.blocks[idx]) return;
  const newBlock = { ...builder.blocks[idx] };
  newBlock.contentId = `content-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  builder.blocks.splice(idx + 1, 0, newBlock);
  renderBlocks();
  selectedBlockIndex = idx + 1;
  syncUiStateStore();
  renderInspector();
  setStatus("Block duplicated", true);
}

function startDragBlock(event, idx) {
  dragSourceIndex = idx;
  syncUiStateStore();
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("blockIndex", idx);
  const card = event.currentTarget?.closest(".block-card");
  if (card) {
    card.classList.add("dragging");
  }
}

function allowDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function dragEnterBlock(event, targetIdx) {
  event.preventDefault();
  if (targetIdx === dragSourceIndex) return;
  const card = event.currentTarget?.closest(".block-card");
  if (card) card.classList.add("drop-target");
}

function dragLeaveBlock(event) {
  const card = event.currentTarget?.closest(".block-card");
  if (card) card.classList.remove("drop-target");
}

function endDragBlock() {
  dragSourceIndex = null;
  syncUiStateStore();
  document.querySelectorAll(".block-card.dragging, .block-card.drop-target").forEach((el) => {
    el.classList.remove("dragging");
    el.classList.remove("drop-target");
  });
}

function normalizeBlockOrder(blocks) {
  blocks.forEach((block, idx) => {
    block.order = idx + 1;
  });
}

function dropBlock(event, targetIdx) {
  event.preventDefault();
  const sourceIdxRaw = event.dataTransfer.getData("blockIndex");
  const sourceIdx = Number(sourceIdxRaw || dragSourceIndex);
  if (sourceIdx === targetIdx) return;

  if (selectedBlockIndex !== null) {
    if (selectedBlockIndex === sourceIdx) {
      selectedBlockIndex = targetIdx;
    } else if (sourceIdx < selectedBlockIndex && targetIdx >= selectedBlockIndex) {
      selectedBlockIndex -= 1;
    } else if (sourceIdx > selectedBlockIndex && targetIdx <= selectedBlockIndex) {
      selectedBlockIndex += 1;
    }
  }

  const block = builder.blocks[sourceIdx];
  builder.blocks.splice(sourceIdx, 1);
  builder.blocks.splice(targetIdx, 0, block);
  normalizeBlockOrder(builder.blocks);
  endDragBlock();
  syncUiStateStore();
  renderBlocks();
  renderInspector();
  updateSaveButtons();
}

function showAddBlockMenu() {
  // Show modal or menu to add block type
  const types = ["TEXT", "IMAGE", "VIDEO"];
  let html = `<div style="display: flex; gap: 8px; flex-wrap: wrap;">`;
  types.forEach((type) => {
    html += `<button class="btn btn-secondary" onclick="addBlockOfType('${type}')">+ ${type}</button>`;
  });
  html += `</div>`;
  // In a real implementation, you'd show this in a modal
  // For now, just call the default
  addBlockOfType("TEXT");
}

function renderBuilderTypeOptions() {
  const typeSelect = document.getElementById("builderType");
  fillSelect(
    typeSelect,
    [
      { value: "idle", label: "Idle" },
      { value: "visitor", label: "Visitor" },
      { value: "student", label: "Student" },
      { value: "menu", label: "Menu" },
    ],
    builder.type,
  );
}

function renderDuplicateOptions() {
  const wrap = document.getElementById("duplicateWrap");
  const select = document.getElementById("duplicateSource");
  if (!wrap || !select) return;

  if (builder.mode !== "duplicate") {
    wrap.style.display = "none";
    builder.sourceId = "";
    select.innerHTML = "";
    return;
  }

  const options = getCampaignsByType(builder.type).map((c) => {
    const id = builder.type === "student" ? c.nfcUid : c.campaignId;
    const suffix = builder.type === "student" ? `UID: ${c.nfcUid}` : c.campaignId;
    return { value: id, label: `${c.campaignName} (${suffix})` };
  });

  wrap.style.display = "block";
  if (options.length === 0) {
    fillSelect(select, [{ value: "", label: "No source available" }], "");
    builder.sourceId = "";
    return;
  }

  if (!builder.sourceId) {
    builder.sourceId = options[0].value;
  }

  fillSelect(select, options, builder.sourceId);
}

function getBlockIssues(issues, idx, field) {
  return validation.getBlockIssues(issues, idx, field);
}

function issuePathToInputId(scope, path) {
  return validation.issuePathToInputId(scope, path);
}

function renderIssues(targetId, issues, scope) {
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!issues || issues.length === 0) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }

  const blockNotes = issues
    .filter((i) => /^items\[\d+\]/.test(i.path))
    .map((i) => {
      const m = /items\[(\d+)\]/.exec(i.path);
      const blockIndex = m ? Number(m[1]) + 1 : "?";
      return `Problem in block ${blockIndex}: ${i.message}`;
    });

  const summary = Array.from(new Set(blockNotes));
  const rows = issues
    .map((i) => {
      const inputId = issuePathToInputId(scope, i.path);
      return `<li><a href="#${escapeHtml(inputId)}" data-target="${escapeHtml(inputId)}">${escapeHtml(i.message)}</a></li>`;
    })
    .join("");
  const summaryHtml = summary.map((s) => `<div>${escapeHtml(s)}</div>`).join("");

  el.style.display = "block";
  el.innerHTML = `${summaryHtml}<ul>${rows}</ul>`;

  el.querySelectorAll("a[data-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.getAttribute("data-target");
      const target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
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
  builderIssues = validateBuilder();
  menuIssues = validateMenu();
  syncUiStateStore();

  renderIssues("builderIssues", builderIssues, "builder");
  renderIssues("menuIssues", menuIssues, "menu");
  syncInlineBlockErrors("blocks", builder.blocks, builderIssues);
  syncInlineBlockErrors("menuBlocks", menuBlocks, menuIssues);

  const nameIssue = builderIssues.find((i) => i.path === "campaignName");
  const campaignNameErrorEl = document.getElementById("campaignNameError");
  if (campaignNameErrorEl) campaignNameErrorEl.textContent = nameIssue ? nameIssue.message : "";
  const uidIssue = builderIssues.find((i) => i.path === "studentUid");
  const studentUidErrorEl = document.getElementById("studentUidError");
  if (studentUidErrorEl) studentUidErrorEl.textContent = uidIssue ? uidIssue.message : "";
}

function syncInlineBlockErrors(containerId, blocks, issues) {
  const fields = ["contentId", "type", "order", "durationSec", "data"];
  for (let idx = 0; idx < blocks.length; idx += 1) {
    for (const field of fields) {
      const el = document.getElementById(`${containerId}-err-${idx}-${field}`);
      if (!el) continue;
      const msg = getBlockIssues(issues, idx, field);
      el.textContent = msg || "";
    }
  }
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
  const campaignNameInput = document.getElementById("campaignNameInput");
  if (campaignNameInput) campaignNameInput.value = builder.campaignName;

  const typeSelect = document.getElementById("builderType");
  if (typeSelect) typeSelect.value = builder.type;

  const studentUidInput = document.getElementById("studentUid");
  if (studentUidInput) studentUidInput.value = builder.studentUid;

  renderDuplicateOptions();
  renderBlocks();
  updateSaveButtons();
}

function resetBuilderForType(type) {
  builder.type = type;
  builder.campaignId = null;
  builder.mode = "new";
  builder.sourceId = "";
  builder.campaignName = "";
  builder.studentUid = "";
  builder.blocks = [defaultBlock(1)];
  syncFormFromBuilder();
}

function setBuilderFromCampaign(campaign, type, studentUid = "") {
  builder.campaignId = campaign?.campaignId || null;
  builder.type = type;
  builder.campaignName = campaign?.campaignName || "";
  builder.studentUid = studentUid;
  builder.blocks = Array.isArray(campaign?.items) && campaign.items.length > 0
    ? campaign.items.map((item) => ({ ...item }))
    : [defaultBlock(1)];
  syncFormFromBuilder();
}

function fillInitialData() {
  renderBuilderTypeOptions();

  if (!builder.blocks.length) {
    builder.blocks = [defaultBlock(1)];
  }

  renderSidebar();
  renderBlocks();
  renderInspector();
  updateCampaignHeader();
  updateSaveButtons();
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
  builder.blocks.push(makeBlockByType("TEXT", builder.blocks.length + 1));
  syncFormFromBuilder();
}

function addBlockOfType(type) {
  builder.blocks.push(makeBlockByType(type, builder.blocks.length + 1));
  syncFormFromBuilder();
}

function addMenuBlock() {
  menuBlocks.push(makeBlockByType("TEXT", menuBlocks.length + 1));
  renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
  updateSaveButtons();
}

function removeBlock(containerId, idx) {
  const target = containerId === "menuBlocks" ? menuBlocks : builder.blocks;
  if (target.length <= 1) return;
  target.splice(idx, 1);
  if (containerId !== "menuBlocks") {
    normalizeBlockOrder(target);
    if (selectedBlockIndex !== null) {
      selectedBlockIndex = Math.min(selectedBlockIndex, target.length - 1);
    }
  }

  if (containerId === "menuBlocks") {
    renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
  } else {
    renderBlocks();
    renderInspector();
  }
  updateSaveButtons();
}

function moveBlock(containerId, idx, dir) {
  const target = containerId === "menuBlocks" ? menuBlocks : builder.blocks;
  const next = idx + dir;
  if (next < 0 || next >= target.length) return;
  const tmp = target[idx];
  target[idx] = target[next];
  target[next] = tmp;
  normalizeBlockOrder(target);

  if (containerId === "menuBlocks") {
    renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
  } else {
    renderBlocks();
    renderInspector();
  }
  updateSaveButtons();
}

function updateBlockField(containerId, idx, field, value) {
  const target = containerId === "menuBlocks" ? menuBlocks : builder.blocks;
  if (!target[idx]) return;

  if (field === "order" || field === "durationSec") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      if (field === "order") {
        setStatus("Invalid block order", false, [{ path: `items[${idx}].order`, message: "Order must be a number >= 1" }]);
      } else {
        setStatus("Invalid duration", false, [{ path: `items[${idx}].durationSec`, message: "Duration must be a number >= 1" }]);
      }
      return;
    }
    target[idx][field] = parsed;
  } else {
    target[idx][field] = value;
  }

  if (field === "type") {
    // Full reset on type change as requested: new contentId/data/default duration.
    const currentOrder = Number(target[idx].order) || idx + 1;
    target[idx] = makeBlockByType(value, currentOrder);
  }

  if (field === "order") {
    if (!Number.isInteger(target[idx].order) || target[idx].order < 1) {
      setStatus("Invalid block order", false, [{ path: `items[${idx}].order`, message: "Order must be an integer >= 1" }]);
      return;
    }
    const selectedContentId = target[idx].contentId;
    target.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    normalizeBlockOrder(target);
    if (containerId !== "menuBlocks" && selectedContentId) {
      selectedBlockIndex = target.findIndex((b) => b.contentId === selectedContentId);
    }
  }

  if (containerId === "menuBlocks") {
    if (field === "type") {
      renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
    } else if (field === "order") {
      renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
    }
  } else if (field === "type") {
    renderBlocks();
    renderInspector();
  } else if (field === "order") {
    renderBlocks();
    renderInspector();
  } else {
    renderBlocks();
  }

  updateSaveButtons();
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
