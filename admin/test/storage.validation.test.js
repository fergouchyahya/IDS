const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function loadStorageWithTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ids-admin-storage-'));
  process.env.IDS_ADMIN_DATA_DIR = tempDir;

  const modulePath = path.resolve(__dirname, '../src/storage.js');
  delete require.cache[modulePath];
  const storage = require(modulePath);

  return { storage, tempDir };
}

function validItems() {
  return [
    {
      contentId: 'item-1',
      type: 'TEXT',
      data: 'hello world',
      order: 1,
      durationSec: 10,
    },
  ];
}

test('rejects empty campaign name', () => {
  const { storage } = loadStorageWithTempDir();
  assert.throws(
    () => storage.createCampaign({ kind: 'idle', campaignName: '   ', items: validItems() }),
    (err) => err.name === 'ValidationError' && err.issues.some((i) => i.path === 'campaignName'),
  );
});

test('rejects invalid campaign kind', () => {
  const { storage } = loadStorageWithTempDir();
  assert.throws(
    () => storage.createCampaign({ kind: 'menu', campaignName: 'Invalid', items: validItems() }),
    (err) => err.name === 'ValidationError' && err.issues.some((i) => i.path === 'kind'),
  );
});

test('rejects missing data for text', () => {
  const { storage } = loadStorageWithTempDir();
  assert.throws(
    () =>
      storage.createCampaign({
        kind: 'visitor',
        campaignName: 'Visitor',
        items: [{ contentId: 'x', type: 'TEXT', data: '', order: 1, durationSec: 2 }],
      }),
    (err) => err.name === 'ValidationError' && err.issues.some((i) => i.path === 'items[0].data'),
  );
});

test('rejects missing media URL for image/video', () => {
  const { storage } = loadStorageWithTempDir();
  assert.throws(
    () =>
      storage.createCampaign({
        kind: 'visitor',
        campaignName: 'Visitor',
        items: [{ contentId: 'img-1', type: 'IMAGE', data: '', order: 1, durationSec: 2 }],
      }),
    (err) => err.name === 'ValidationError' && err.issues.some((i) => i.path === 'items[0].data'),
  );
});

test('rejects invalid duration', () => {
  const { storage } = loadStorageWithTempDir();
  assert.throws(
    () =>
      storage.createCampaign({
        kind: 'idle',
        campaignName: 'Idle',
        items: [{ contentId: 'i1', type: 'TEXT', data: 'x', order: 1, durationSec: 0 }],
      }),
    (err) => err.name === 'ValidationError' && err.issues.some((i) => i.path === 'items[0].durationSec'),
  );
});

test('rejects duplicate contentId in same campaign', () => {
  const { storage } = loadStorageWithTempDir();
  assert.throws(
    () =>
      storage.createCampaign({
        kind: 'idle',
        campaignName: 'Idle',
        items: [
          { contentId: 'dup', type: 'TEXT', data: 'A', order: 1, durationSec: 2 },
          { contentId: 'dup', type: 'TEXT', data: 'B', order: 2, durationSec: 2 },
        ],
      }),
    (err) => err.name === 'ValidationError' && err.issues.some((i) => i.path === 'items[1].contentId'),
  );
});
