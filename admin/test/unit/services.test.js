const test = require('node:test');
const assert = require('node:assert/strict');
const { createCampaignService } = require('../../src/services/campaign-service');
const { createConfigService } = require('../../src/services/config-service');
const { createStudentService } = require('../../src/services/student-service');

function makeStorageStub() {
  return {
    createCampaign: async (x) => ({ created: x }),
    updateCampaign: async (id, x) => ({ id, patch: x }),
    deleteCampaign: async (id) => ({ deleted: id }),
    setActiveCampaigns: async (x) => ({ active: x }),
    setSettings: async (x) => ({ settings: x }),
    setMenuCampaign: async (x) => ({ menu: x }),
    upsertStudent: async (x) => ({ student: x }),
    importStudentProfiles: async (x) => ({ profiles: x }),
    getGeneratedStudentCampaignByUid: async (uid) => ({ uid }),
    deleteStudent: async (uid) => ({ deleted: uid }),
    listGeneratedStudentCampaigns: async () => ([]),
  };
}

test('campaign service delegates to storage', async () => {
  const svc = createCampaignService({ storage: makeStorageStub() });
  assert.deepEqual(await svc.create({ a: 1 }), { created: { a: 1 } });
  assert.deepEqual(await svc.update('x', { b: 2 }), { id: 'x', patch: { b: 2 } });
  assert.deepEqual(await svc.remove('x'), { deleted: 'x' });
});

test('config service delegates to storage', async () => {
  const svc = createConfigService({ storage: makeStorageStub() });
  assert.deepEqual(await svc.setActive({ idleCampaignId: 'a' }), { active: { idleCampaignId: 'a' } });
  assert.deepEqual(await svc.setSettings({ inactivityTimeoutMs: 500 }), { settings: { inactivityTimeoutMs: 500 } });
});

test('student service delegates to storage', async () => {
  const svc = createStudentService({ storage: makeStorageStub() });
  assert.deepEqual(await svc.upsert({ nfcUid: '1' }), { student: { nfcUid: '1' } });
  assert.deepEqual(await svc.getGeneratedCampaign('u1'), { uid: 'u1' });
});
