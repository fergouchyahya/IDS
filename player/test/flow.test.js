const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PlayerStateMachine,
  normalizeRuntimeConfig,
  renderUI,
  isMovementInputEvent,
  isDetectorAllowedEvent,
} = require('../src/server');

function loadConfig() {
  const p = path.resolve(__dirname, '../../shared/contract/examples/config.welcome.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('idle -> menu -> visitor info with canonical events', () => {
  const sm = new PlayerStateMachine(loadConfig());

  let status = sm.getStatus();
  assert.equal(status.state, 'IDLE');

  status = sm.handleEvent({ type: 'movement_detected' });
  assert.equal(status.state, 'MENU');

  status = sm.handleEvent({ type: 'visitor_selected' });
  assert.equal(status.state, 'VISITOR_INFO');
  assert.equal(status.campaignId, 'info-visitor');
  sm.stop();
});

test('menu -> nfc_tap known UID -> student info', () => {
  const sm = new PlayerStateMachine(loadConfig());

  sm.handleEvent({ type: 'movement_detected' });
  const status = sm.handleEvent({ type: 'nfc_tap', nfcUid: 'demo-uid-001' });

  assert.equal(status.state, 'STUDENT_INFO');
  assert.equal(status.currentStudentUid, 'demo-uid-001');
  assert.equal(status.campaignId, 'info-nfc');
  sm.stop();
});

test('menu -> nfc_tap unknown UID returns to menu', () => {
  const sm = new PlayerStateMachine(loadConfig());

  sm.handleEvent({ type: 'movement_detected' });
  const status = sm.handleEvent({ type: 'nfc_tap', nfcUid: 'unknown-uid' });

  assert.equal(status.state, 'MENU');
  assert.equal(status.action, 'student_not_found_back_to_menu');
  sm.stop();
});

test('scroll is circular in both directions', () => {
  const sm = new PlayerStateMachine(loadConfig());

  sm.handleEvent({ type: 'movement_detected' });
  sm.handleEvent({ type: 'visitor_selected' });

  let status = sm.getStatus();
  assert.equal(status.item.contentId, 'visitor-info-1');

  status = sm.handleEvent({ type: 'scroll_prev' });
  assert.equal(status.item.contentId, 'visitor-info-2');

  status = sm.handleEvent({ type: 'scroll_next' });
  assert.equal(status.item.contentId, 'visitor-info-1');
  sm.stop();
});

test('inactivity sends any non-idle state back to idle', async () => {
  const sm = new PlayerStateMachine(loadConfig());
  sm.inactivityTimeout = 120;

  sm.handleEvent({ type: 'movement_detected' });
  sm.handleEvent({ type: 'visitor_selected' });
  assert.equal(sm.getStatus().state, 'VISITOR_INFO');

  await wait(180);

  const status = sm.getStatus();
  assert.equal(status.state, 'IDLE');
  assert.equal(status.campaignId, 'idle-welcome');
  sm.stop();
});

test('runtime config refresh does not extend inactivity timeout', async () => {
  const cfg = loadConfig();
  const sm = new PlayerStateMachine(cfg);
  const runtime = normalizeRuntimeConfig(cfg);
  runtime.settings.inactivityTimeoutMs = 140;
  sm.inactivityTimeout = 140;

  sm.handleEvent({ type: 'movement_detected' });
  sm.handleEvent({ type: 'visitor_selected' });
  assert.equal(sm.getStatus().state, 'VISITOR_INFO');

  await wait(60);
  sm.setRuntimeConfig(runtime);

  await wait(110);
  assert.equal(sm.getStatus().state, 'IDLE');
  sm.stop();
});

test('renderUI menu includes both visitor and nfc decision cards', () => {
  const sm = new PlayerStateMachine(loadConfig());
  sm.handleEvent({ type: 'movement_detected' });
  const html = renderUI(sm);

  assert.match(html, /Continue as visitor/);
  assert.match(html, /Tap NFC card/);
  sm.stop();
});

test('renderUI debug panel is hidden by default and visible with forced debug', () => {
  const sm = new PlayerStateMachine(loadConfig());
  const normal = renderUI(sm);
  const forced = renderUI(sm, { forceDebug: true });

  assert.match(normal, /class="debug-panel"/);
  assert.doesNotMatch(normal, /class="debug-panel visible"/);
  assert.match(forced, /class="debug-panel visible"/);
  sm.stop();
});

test('renderUI includes state marker classes for idle, menu, and info states', () => {
  const sm = new PlayerStateMachine(loadConfig());
  assert.match(renderUI(sm), /class="player-body state-idle"/);

  sm.handleEvent({ type: 'movement_detected' });
  assert.match(renderUI(sm), /class="player-body state-menu"/);

  sm.handleEvent({ type: 'visitor_selected' });
  assert.match(renderUI(sm), /class="player-body state-info"/);
  sm.stop();
});

test('movement event gate allows only non-movement events via generic endpoint', () => {
  assert.equal(isMovementInputEvent({ type: 'movement_detected' }), true);
  assert.equal(isMovementInputEvent({ type: 'movement' }), true);
  assert.equal(isMovementInputEvent({ type: 'vision_present' }), true);
  assert.equal(isMovementInputEvent({ type: 'visitor_selected' }), false);
  assert.equal(isMovementInputEvent({ type: 'scroll_next' }), false);
});

test('detector endpoint allows only gesture-related runtime events', () => {
  assert.equal(isDetectorAllowedEvent('movement_detected'), true);
  assert.equal(isDetectorAllowedEvent('visitor_selected'), true);
  assert.equal(isDetectorAllowedEvent('scroll_next'), true);
  assert.equal(isDetectorAllowedEvent('scroll_prev'), true);
  assert.equal(isDetectorAllowedEvent('nfc_tap'), false);
  assert.equal(isDetectorAllowedEvent('runtime_config'), false);
});
