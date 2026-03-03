const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAndValidateItems, validateCampaignName } = require('../../src/storage/validators');

test('validators normalize and sort items', () => {
  const out = normalizeAndValidateItems([
    { contentId: 'b', type: 'TEXT', data: '2', order: 2, durationSec: 5 },
    { contentId: 'a', type: 'TEXT', data: '1', order: 1, durationSec: 5 },
  ]);
  assert.equal(out[0].contentId, 'a');
  assert.equal(out[1].contentId, 'b');
});

test('validateCampaignName rejects empty', () => {
  assert.throws(() => validateCampaignName('   '));
});
