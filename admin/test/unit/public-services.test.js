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

test('runtime context syncs snapshot and exposes selector helpers', () => {
  const { AdminRuntimeContext } = loadBrowserScript('services/runtime-context.js', {
    document: {
      getElementById() {
        return null;
      },
    },
  });

  const uiState = {
    state: { idleCampaigns: [], visitorCampaigns: [], students: [] },
    selectedCampaignId: 'idle-1',
    selectedBlockIndex: 2,
    sidebarQuery: 'welcome',
    dragSourceIndex: 1,
    overviewTypeFilter: 'idle',
    overviewStatusFilter: 'live',
    builder: { type: 'idle', blocks: [] },
    menuBlocks: [{ contentId: 'm1' }],
    builderIssues: [{ path: 'campaignName' }],
    menuIssues: [{ path: 'items[0].data' }],
  };

  const store = {
    getSnapshot() {
      return { ...uiState };
    },
    getBuilder() {
      return uiState.builder;
    },
    setSnapshot(patch) {
      Object.assign(uiState, patch);
    },
  };

  const runtime = AdminRuntimeContext.createRuntimeContext({
    uiStateStore: store,
    campaignSelectors: {
      findStudentCampaignByUid(state, uid) {
        return { state, uid, source: 'selector' };
      },
      getCampaignsByType(state, type) {
        return [{ state, type }];
      },
      toRelativeTime(value) {
        return `time:${value}`;
      },
      normalizeCampaignCards(state) {
        return [{ id: 'x', state }];
      },
      cardTypeLabel(kind) {
        return `label:${kind}`;
      },
    },
    validation: {
      validateBuilder(builder) {
        return builder.blocks.length ? [] : [{ path: 'blocks' }];
      },
      validateMenu(blocks, name) {
        return [{ blocks, name }];
      },
      getBlockIssues() {
        return 'issue';
      },
      issuePathToInputId() {
        return 'input-id';
      },
    },
    setStatus() {},
    escapeHtml(value) {
      return String(value);
    },
    api() {},
    defaultBlock() {
      return { contentId: 'd1' };
    },
    makeBlockByType(type, order) {
      return { type, order };
    },
  });

  runtime.setState({ hello: 'world' });
  runtime.setSelectedCampaignId('idle-2');
  runtime.setSelectedBlockIndex(0);
  runtime.setSidebarQuery('next');
  runtime.setDragSourceIndex(9);
  runtime.setOverviewTypeFilter('student');
  runtime.setOverviewStatusFilter('draft');
  runtime.setMenuBlocks([{ contentId: 'm2' }]);
  runtime.setBuilderIssues([{ path: 'builder' }]);
  runtime.setMenuIssues([{ path: 'menu' }]);
  runtime.syncUiStateStore();

  assert.deepEqual(uiState.state, { hello: 'world' });
  assert.equal(uiState.selectedCampaignId, 'idle-2');
  assert.equal(uiState.selectedBlockIndex, 0);
  assert.equal(uiState.sidebarQuery, 'next');
  assert.equal(uiState.dragSourceIndex, 9);
  assert.equal(uiState.overviewTypeFilter, 'student');
  assert.equal(uiState.overviewStatusFilter, 'draft');
  assert.deepEqual(uiState.menuBlocks, [{ contentId: 'm2' }]);
  assert.deepEqual(uiState.builderIssues, [{ path: 'builder' }]);
  assert.deepEqual(uiState.menuIssues, [{ path: 'menu' }]);
  assert.deepEqual(runtime.findStudentCampaignByUid('u-1'), { state: { hello: 'world' }, uid: 'u-1', source: 'selector' });
  assert.deepEqual(runtime.getCampaignsByType('idle'), [{ state: { hello: 'world' }, type: 'idle' }]);
  assert.equal(runtime.toRelativeTime('iso'), 'time:iso');
  assert.deepEqual(runtime.normalizeCampaignCards(), [{ id: 'x', state: { hello: 'world' } }]);
  assert.equal(runtime.cardTypeLabel('menu'), 'label:menu');
  assert.deepEqual(runtime.validateBuilder(), [{ path: 'blocks' }]);
  assert.deepEqual(runtime.validateMenu(), [{ blocks: [{ contentId: 'm2' }], name: '' }]);
  assert.equal(runtime.getBlockIssues(), 'issue');
  assert.equal(runtime.issuePathToInputId(), 'input-id');
});

test('legacy bridge binds handlers and creates boot init', async () => {
  const { AdminLegacyBridge } = loadBrowserScript('services/legacy-bridge.js');
  const windowObj = {};
  global.window = windowObj;
  let bindCalls = 0;
  let resetType = null;
  let syncCalls = 0;
  let refreshCalls = 0;
  let statusCall = null;

  AdminLegacyBridge.bindGlobalHandlers.call(windowObj, {
    testHandler() {
      return 'ok';
    },
  });

  const extra = loadBrowserScript('services/legacy-bridge.js');
  extra.AdminLegacyBridge.bindGlobalHandlers({
    localHandler() {
      return 'fine';
    },
  });

  const init = extra.AdminLegacyBridge.createLegacyInit({
    bindEvents() {
      bindCalls += 1;
    },
    resetBuilderForType(type) {
      resetType = type;
    },
    syncUiStateStore() {
      syncCalls += 1;
    },
    async refresh() {
      refreshCalls += 1;
      throw { message: 'load failed', issues: [{ path: 'x' }] };
    },
    setStatus(message, ok, issues) {
      statusCall = { message, ok, issues };
    },
  });

  init();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(typeof extra.testHandler, 'undefined');
  assert.equal(typeof extra.localHandler, 'function');
  assert.equal(bindCalls, 1);
  assert.equal(resetType, 'idle');
  assert.equal(syncCalls, 1);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(statusCall, { message: 'load failed', ok: false, issues: [{ path: 'x' }] });
});
