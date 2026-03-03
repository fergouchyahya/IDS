const test = require('node:test');
const assert = require('node:assert/strict');
const { PlayerStateMachine } = require('../../src/services/state-machine');

function runtimeFixture() {
  return {
    settings: { inactivityTimeoutMs: 10000 },
    idleCampaign: { campaignId: 'idle-1', campaignName: 'Idle', items: [{ contentId: 'a', type: 'TEXT', data: 'x', order: 1, durationSec: 10 }] },
    menuCampaign: { campaignId: 'menu-1', campaignName: 'Menu', items: [{ contentId: 'm', type: 'TEXT', data: 'menu', order: 1, durationSec: 10 }] },
    visitorCampaign: { campaignId: 'visit-1', campaignName: 'Visitor', items: [{ contentId: 'v', type: 'TEXT', data: 'visit', order: 1, durationSec: 10 }] },
    students: [],
    updatedAt: new Date().toISOString(),
  };
}

test('regression: scroll does not fail on single-item campaigns', () => {
  const sm = new PlayerStateMachine(runtimeFixture());
  const result = sm.handleEvent({ type: 'scroll_next' });
  assert.equal(result.action, 'single_item_noop');
  sm.stop();
});
