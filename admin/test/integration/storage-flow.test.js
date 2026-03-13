const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { FileRepository } = require('../../src/storage/repository');
const { createStorage } = require('../../src/storage');

test('integration: create campaign -> set active -> runtime projection', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ids-storage-flow-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const repo = new FileRepository({ dataDir: tempDir });
  const storage = createStorage(repo);

  const created = await storage.createCampaign({
    kind: 'idle',
    campaignName: `Idle ${Date.now()}`,
    items: [{ contentId: `c-${Date.now()}`, type: 'TEXT', data: 'hello', order: 1, durationSec: 10 }],
  });

  const newIdle = created.idleCampaigns[created.idleCampaigns.length - 1];
  const afterActive = await storage.setActiveCampaigns({ idleCampaignId: newIdle.campaignId });
  assert.equal(afterActive.active.idleCampaignId, newIdle.campaignId);

  const state = await storage.readState();
  const runtime = storage.toRuntimeConfig(state);
  assert.equal(runtime.idleCampaign.campaignId, newIdle.campaignId);
});
