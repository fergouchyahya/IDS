const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PlayerStateMachine, normalizeRuntimeConfig } = require('../src/server');

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
