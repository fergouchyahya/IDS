const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBrowserScript(relativePath, extra = {}) {
  const scriptPath = path.resolve(__dirname, '../../public', relativePath);
  const source = fs.readFileSync(scriptPath, 'utf8');
  const context = {
    console,
    setTimeout,
    clearTimeout,
    ...extra,
  };
  context.window = context.window || {};
  context.document = context.document || {};
  vm.createContext(context);
  vm.runInContext(source, context, { filename: scriptPath });
  return context.window;
}

function createElement(id = '') {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    focus() {},
    scrollIntoView() {},
  };
}

test('block ops duplicateBlockState duplicates and selects the copied block', () => {
  const { AdminBlockOps } = loadBrowserScript('services/block-ops.js');
  const builder = {
    blocks: [{ contentId: 'one', type: 'TEXT', data: 'hello', order: 1, durationSec: 10 }],
  };
  let selectedBlockIndex = null;
  let syncCalls = 0;
  let renderBlocksCalls = 0;
  let renderInspectorCalls = 0;
  let lastStatus = null;

  AdminBlockOps.duplicateBlockState({
    builder,
    setSelectedBlockIndex(value) {
      selectedBlockIndex = value;
    },
    syncUiStateStore() {
      syncCalls += 1;
    },
    renderBlocks() {
      renderBlocksCalls += 1;
    },
    renderInspector() {
      renderInspectorCalls += 1;
    },
    setStatus(message, ok) {
      lastStatus = { message, ok };
    },
  }, 0);

  assert.equal(builder.blocks.length, 2);
  assert.equal(selectedBlockIndex, 1);
  assert.equal(builder.blocks[1].data, 'hello');
  assert.notEqual(builder.blocks[1].contentId, 'one');
  assert.equal(syncCalls, 1);
  assert.equal(renderBlocksCalls, 1);
  assert.equal(renderInspectorCalls, 1);
  assert.deepEqual(lastStatus, { message: 'Block duplicated', ok: true });
});

test('block ops updateBlockFieldState reorders builder blocks and preserves selected block identity', () => {
  const { AdminBlockOps } = loadBrowserScript('services/block-ops.js');
  const builder = {
    blocks: [
      { contentId: 'a', type: 'TEXT', data: 'A', order: 1, durationSec: 10 },
      { contentId: 'b', type: 'TEXT', data: 'B', order: 2, durationSec: 10 },
    ],
  };
  let selectedBlockIndex = 1;
  let renderBlocksCalls = 0;
  let renderInspectorCalls = 0;
  let saveButtonCalls = 0;

  AdminBlockOps.updateBlockFieldState({
    builder,
    menuBlocks: [],
    makeBlockByType(type, order) {
      return { contentId: 'new', type, data: '', order, durationSec: 12 };
    },
    setStatus() {
      throw new Error('setStatus should not be called');
    },
    setSelectedBlockIndex(value) {
      selectedBlockIndex = value;
    },
    renderBlocks() {
      renderBlocksCalls += 1;
    },
    renderInspector() {
      renderInspectorCalls += 1;
    },
    updateSaveButtons() {
      saveButtonCalls += 1;
    },
  }, 'blocks', 1, 'order', '1');

  assert.deepEqual(builder.blocks.map((block) => block.contentId), ['a', 'b']);
  assert.deepEqual(builder.blocks.map((block) => block.order), [1, 2]);
  assert.equal(selectedBlockIndex, 1);
  assert.equal(renderBlocksCalls, 1);
  assert.equal(renderInspectorCalls, 1);
  assert.equal(saveButtonCalls, 1);
});

test('editor view renderDuplicateOptions populates first available source', () => {
  const selectEl = createElement('duplicateSource');
  const wrapEl = createElement('duplicateWrap');
  const elements = {
    duplicateSource: selectEl,
    duplicateWrap: wrapEl,
  };
  const document = {
    getElementById(id) {
      return elements[id] || null;
    },
    createElement() {
      return createElement();
    },
  };
  const { AdminEditorView } = loadBrowserScript('services/editor-view.js', { document });
  const builder = {
    mode: 'duplicate',
    type: 'idle',
    sourceId: '',
  };

  AdminEditorView.renderDuplicateOptions({
    builder,
    getCampaignsByType() {
      return [
        { campaignId: 'idle-1', campaignName: 'Idle A' },
        { campaignId: 'idle-2', campaignName: 'Idle B' },
      ];
    },
  });

  assert.equal(wrapEl.style.display, 'block');
  assert.equal(builder.sourceId, 'idle-1');
  assert.equal(selectEl.children.length, 2);
  assert.equal(selectEl.children[0].value, 'idle-1');
});

test('editor controller resolveCampaignIdFromState resolves by exact name and student uid', () => {
  const { AdminEditorController } = loadBrowserScript('services/editor-controller.js');
  const deps = {
    builder: { studentUid: 'stu-42' },
    getState() {
      return {
        idleCampaigns: [
          { campaignId: 'idle-1', campaignName: 'Welcome' },
          { campaignId: 'idle-2', campaignName: 'Default' },
        ],
        visitorCampaigns: [
          { campaignId: 'visitor-1', campaignName: 'Visitor' },
        ],
        menuCampaign: { campaignId: 'menu-1' },
      };
    },
  };

  assert.equal(AdminEditorController.resolveCampaignIdFromState(deps, 'idle', 'Welcome'), 'idle-1');
  assert.equal(AdminEditorController.resolveCampaignIdFromState(deps, 'menu', 'ignored'), 'menu-1');
  assert.equal(AdminEditorController.resolveCampaignIdFromState(deps, 'student', 'ignored'), 'student-stu-42');
});

test('editor state loadCampaignToEditorState loads student campaign into builder state', () => {
  const { AdminEditorState } = loadBrowserScript('services/editor-state.js');
  const builder = {};
  let selectedCampaignId = null;
  let selectedBlockIndex = 99;
  let syncCalls = 0;
  let sidebarCalls = 0;
  let blockCalls = 0;
  let inspectorCalls = 0;
  let headerCalls = 0;

  AdminEditorState.loadCampaignToEditorState({
    state: {},
    builder,
    defaultBlock() {
      return { contentId: 'default', type: 'TEXT', data: '', order: 1, durationSec: 30 };
    },
    findStudentCampaignByUid(uid) {
      return {
        nfcUid: uid,
        name: 'Alice',
        campaign: {
          items: [{ contentId: 's1', type: 'TEXT', data: 'Hi', order: 1, durationSec: 10 }],
        },
      };
    },
    getCampaignsByType() {
      return [];
    },
    setSelectedCampaignId(value) {
      selectedCampaignId = value;
    },
    setSelectedBlockIndex(value) {
      selectedBlockIndex = value;
    },
    syncUiStateStore() {
      syncCalls += 1;
    },
    renderSidebar() {
      sidebarCalls += 1;
    },
    renderBlocks() {
      blockCalls += 1;
    },
    renderInspector() {
      inspectorCalls += 1;
    },
    updateCampaignHeader() {
      headerCalls += 1;
    },
  }, 'student', 'uid-1');

  assert.equal(selectedCampaignId, 'uid-1');
  assert.equal(selectedBlockIndex, null);
  assert.equal(builder.campaignId, 'student-uid-1');
  assert.equal(builder.type, 'student');
  assert.equal(builder.campaignName, 'Alice');
  assert.equal(builder.studentUid, 'uid-1');
  assert.equal(builder.blocks.length, 1);
  assert.equal(syncCalls, 1);
  assert.equal(sidebarCalls, 1);
  assert.equal(blockCalls, 1);
  assert.equal(inspectorCalls, 1);
  assert.equal(headerCalls, 1);
});

test('editor state duplicateCampaignFromOverviewState reports missing campaign', () => {
  const { AdminEditorState } = loadBrowserScript('services/editor-state.js');
  let status = null;

  AdminEditorState.duplicateCampaignFromOverviewState({
    state: { idleCampaigns: [] },
    builder: {},
    findStudentCampaignByUid() {
      return null;
    },
    getCampaignsByType() {
      return [];
    },
    setSelectedCampaignId() {},
    setSelectedBlockIndex() {},
    setBuilderFromCampaign() {
      throw new Error('should not load builder');
    },
    syncFormFromBuilder() {},
    renderSidebar() {},
    renderInspector() {},
    updateCampaignHeader() {},
    setStatus(message, ok) {
      status = { message, ok };
    },
  }, 'idle', 'missing');

  assert.deepEqual(status, { message: 'Campaign not found', ok: false });
});

test('actions saveBuilderCampaignAction stops on validation errors', async () => {
  const { AdminActions } = loadBrowserScript('services/actions.js');
  let status = null;
  let inspectorCalls = 0;
  let apiCalls = 0;

  const result = await AdminActions.saveBuilderCampaignAction({
    builder: { type: 'idle', campaignName: '', blocks: [] },
    validateBuilder() {
      return [{ path: 'campaignName', message: 'required' }];
    },
    setBuilderIssues(issues) {
      assert.equal(issues.length, 1);
    },
    setStatus(message, ok) {
      status = { message, ok };
    },
    renderInspector() {
      inspectorCalls += 1;
    },
    async api() {
      apiCalls += 1;
    },
  });

  assert.equal(result, undefined);
  assert.deepEqual(status, { message: 'Fix validation errors first', ok: false });
  assert.equal(inspectorCalls, 1);
  assert.equal(apiCalls, 0);
});

test('actions saveBuilderCampaignAction creates student campaign and updates campaign id', async () => {
  const { AdminActions } = loadBrowserScript('services/actions.js');
  const calls = [];
  let refreshCalls = 0;
  let status = null;
  const builder = {
    type: 'student',
    studentUid: 'stu-7',
    campaignName: 'Student Seven',
    blocks: [{ contentId: 'c1', type: 'TEXT', data: 'Hello', order: 1, durationSec: 10 }],
    campaignId: null,
  };

  const result = await AdminActions.saveBuilderCampaignAction({
    builder,
    validateBuilder() {
      return [];
    },
    setBuilderIssues() {},
    async api(url, options) {
      calls.push({ url, options });
      return {};
    },
    normalizeBlock(block) {
      return block;
    },
    async refresh() {
      refreshCalls += 1;
    },
    setStatus(message, ok) {
      status = { message, ok };
    },
  });

  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/students');
  assert.equal(builder.campaignId, 'student-stu-7');
  assert.equal(refreshCalls, 1);
  assert.deepEqual(status, { message: 'Campaign saved', ok: true });
});

test('actions publishCampaignAction publishes idle campaign to active selection', async () => {
  const { AdminActions } = loadBrowserScript('services/actions.js');
  const apiCalls = [];
  let refreshCalls = 0;
  let status = null;

  await AdminActions.publishCampaignAction({
    builder: { type: 'idle', campaignName: 'Welcome', campaignId: 'idle-9' },
    async saveBuilderCampaign() {},
    resolveCampaignIdFromState() {
      return 'idle-9';
    },
    getState() {
      return {
        active: {
          idleCampaignId: 'idle-1',
          visitorCampaignId: 'visitor-1',
        },
      };
    },
    async api(url, options) {
      apiCalls.push({ url, options });
    },
    async refresh() {
      refreshCalls += 1;
    },
    setStatus(message, ok) {
      status = { message, ok };
    },
  });

  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].url, '/api/active');
  assert.equal(refreshCalls, 1);
  assert.deepEqual(status, { message: 'idle campaign published and set active', ok: true });
});
