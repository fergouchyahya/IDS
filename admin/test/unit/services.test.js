const test = require('node:test');
const assert = require('node:assert/strict');
const { createCampaignService } = require('../../src/services/campaign-service');
const { createConfigService } = require('../../src/services/config-service');
const { createStudentService } = require('../../src/services/student-service');

function makeStorageStub() {
  return {
    createCampaign: (x) => ({ created: x }),
    updateCampaign: (id, x) => ({ id, patch: x }),
    deleteCampaign: (id) => ({ deleted: id }),
    setActiveCampaigns: (x) => ({ active: x }),
    setSettings: (x) => ({ settings: x }),
    setMenuCampaign: (x) => ({ menu: x }),
    upsertStudent: (x) => ({ student: x }),
    importStudentProfiles: (x) => ({ profiles: x }),
    getGeneratedStudentCampaignByUid: (uid) => ({ uid }),
    deleteStudent: (uid) => ({ deleted: uid }),
    listGeneratedStudentCampaigns: () => ([]),
  };
}

test('campaign service delegates to storage', () => {
  const svc = createCampaignService({ storage: makeStorageStub() });
  assert.deepEqual(svc.create({ a: 1 }), { created: { a: 1 } });
  assert.deepEqual(svc.update('x', { b: 2 }), { id: 'x', patch: { b: 2 } });
  assert.deepEqual(svc.remove('x'), { deleted: 'x' });
});

test('config service delegates to storage', () => {
  const svc = createConfigService({ storage: makeStorageStub() });
  assert.deepEqual(svc.setActive({ idleCampaignId: 'a' }), { active: { idleCampaignId: 'a' } });
  assert.deepEqual(svc.setSettings({ inactivityTimeoutMs: 500 }), { settings: { inactivityTimeoutMs: 500 } });
});

test('student service delegates to storage', () => {
  const svc = createStudentService({ storage: makeStorageStub() });
  assert.deepEqual(svc.upsert({ nfcUid: '1' }), { student: { nfcUid: '1' } });
  assert.deepEqual(svc.getGeneratedCampaign('u1'), { uid: 'u1' });
});
