const test = require('node:test');
const assert = require('node:assert/strict');
const { PlayerStateMachine, STATE } = require('../../src/services/state-machine');

function runtimeFixture() {
  return {
    settings: { inactivityTimeoutMs: 10000 },
    idleCampaign: { campaignId: 'idle-1', campaignName: 'Idle', items: [{ contentId: 'a', type: 'TEXT', data: 'x', order: 1, durationSec: 10 }] },
    menuCampaign: { campaignId: 'menu-1', campaignName: 'Menu', items: [{ contentId: 'm', type: 'TEXT', data: 'menu', order: 1, durationSec: 10 }] },
    visitorCampaign: { campaignId: 'visit-1', campaignName: 'Visitor', items: [{ contentId: 'v', type: 'TEXT', data: 'visit', order: 1, durationSec: 10 }] },
    students: [{ nfcUid: 'uid-1', name: 'A', campaign: { campaignId: 's-1', campaignName: 'S', items: [{ contentId: 's', type: 'TEXT', data: 's', order: 1, durationSec: 10 }] } }],
    updatedAt: new Date().toISOString(),
  };
}

test('state machine idle -> menu -> visitor flow', () => {
  const sm = new PlayerStateMachine(runtimeFixture());
  assert.equal(sm.getStatus().state, STATE.IDLE);

  sm.handleEvent({ type: 'movement_detected' });
  assert.equal(sm.getStatus().state, STATE.MENU);

  sm.handleEvent({ type: 'visitor_selected' });
  assert.equal(sm.getStatus().state, STATE.VISITOR_INFO);

  sm.stop();
});

test('state machine student NFC flow', () => {
  const sm = new PlayerStateMachine(runtimeFixture());
  sm.handleEvent({ type: 'movement_detected' });
  sm.handleEvent({ type: 'nfc_tap', nfcUid: 'uid-1' });
  assert.equal(sm.getStatus().state, STATE.STUDENT_INFO);
  assert.equal(sm.getStatus().currentStudentUid, 'uid-1');
  sm.stop();
});

test('state machine NFC tap from VISITOR_INFO transitions to STUDENT_INFO', () => {
  const sm = new PlayerStateMachine(runtimeFixture());
  sm.handleEvent({ type: 'movement_detected' });
  assert.equal(sm.getStatus().state, STATE.MENU);

  sm.handleEvent({ type: 'visitor_selected' });
  assert.equal(sm.getStatus().state, STATE.VISITOR_INFO);

  const result = sm.handleEvent({ type: 'nfc_tap', nfcUid: 'uid-1' });
  assert.equal(result.state, STATE.STUDENT_INFO);
  assert.equal(result.action, 'show_student_info');
  assert.equal(result.currentStudentUid, 'uid-1');
  sm.stop();
});

test('state machine NFC tap with unknown uid from VISITOR_INFO returns to MENU', () => {
  const sm = new PlayerStateMachine(runtimeFixture());
  sm.handleEvent({ type: 'movement_detected' });
  sm.handleEvent({ type: 'visitor_selected' });
  assert.equal(sm.getStatus().state, STATE.VISITOR_INFO);

  const result = sm.handleEvent({ type: 'nfc_tap', nfcUid: 'unknown' });
  assert.equal(result.state, STATE.MENU);
  assert.equal(result.action, 'student_not_found_back_to_menu');
  sm.stop();
});
