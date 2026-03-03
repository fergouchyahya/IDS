const test = require('node:test');
const assert = require('node:assert/strict');

const storage = require('../../src/storage');

test('integration: create campaign -> set active -> runtime projection', () => {
  const created = storage.createCampaign({
    kind: 'idle',
    campaignName: `Idle ${Date.now()}`,
    items: [{ contentId: `c-${Date.now()}`, type: 'TEXT', data: 'hello', order: 1, durationSec: 10 }],
  });

  const newIdle = created.idleCampaigns[created.idleCampaigns.length - 1];
  const afterActive = storage.setActiveCampaigns({ idleCampaignId: newIdle.campaignId });
  assert.equal(afterActive.active.idleCampaignId, newIdle.campaignId);

  const runtime = storage.toRuntimeConfig(storage.readState());
  assert.equal(runtime.idleCampaign.campaignId, newIdle.campaignId);
});
