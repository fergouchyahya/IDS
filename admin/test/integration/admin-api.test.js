const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

function clearAdminModuleCache() {
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(`${path.sep}admin${path.sep}src${path.sep}`) || modulePath.includes(`${path.sep}shared${path.sep}config${path.sep}`)) {
      delete require.cache[modulePath];
    }
  }
}

async function createAdminTestServer(t) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ids-admin-test-'));
  const previousDataDir = process.env.IDS_ADMIN_DATA_DIR;

  process.env.IDS_ADMIN_DATA_DIR = tempDir;
  clearAdminModuleCache();
  const { createServer } = require('../../src/server');
  const server = createServer({ port: 0 });
  if (!server.listening) {
    await once(server, 'listening');
  }

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => setTimeout(resolve, 150));
    clearAdminModuleCache();
    if (previousDataDir === undefined) delete process.env.IDS_ADMIN_DATA_DIR;
    else process.env.IDS_ADMIN_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  return { baseUrl };
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null,
  };
}

test('integration: settings and menu campaign updates flow through runtime-config projection', { concurrency: false }, async (t) => {
  const { baseUrl } = await createAdminTestServer(t);

  const settingsResponse = await requestJson(baseUrl, '/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inactivityTimeoutMs: 15000 }),
  });
  assert.equal(settingsResponse.status, 200);
  assert.equal(settingsResponse.body.state.settings.inactivityTimeoutMs, 15000);

  const menuResponse = await requestJson(baseUrl, '/api/menu-campaign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      campaignName: 'Main Menu',
      items: [
        { contentId: 'menu-a', type: 'TEXT', data: 'Choose your path', order: 1, durationSec: 45 },
      ],
    }),
  });
  assert.equal(menuResponse.status, 200);
  assert.equal(menuResponse.body.state.menuCampaign.campaignName, 'Main Menu');

  const runtimeResponse = await requestJson(baseUrl, '/runtime-config');
  assert.equal(runtimeResponse.status, 200);
  assert.equal(runtimeResponse.body.settings.inactivityTimeoutMs, 15000);
  assert.equal(runtimeResponse.body.menuCampaign.campaignName, 'Main Menu');
  assert.equal(runtimeResponse.body.menuCampaign.items[0].contentId, 'menu-a');
});

test('integration: student profile import exposes generated campaign via state and campaign endpoint', { concurrency: false }, async (t) => {
  const { baseUrl } = await createAdminTestServer(t);

  const importResponse = await requestJson(baseUrl, '/api/students/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      students: [
        {
          nfcUid: 'uid-100',
          displayName: 'Alice Example',
          timetableImageUrl: '/media/alice.png',
          nextClassText: 'Next class: Physics',
        },
      ],
    }),
  });
  assert.equal(importResponse.status, 200);
  assert.equal(importResponse.body.imported, 1);

  const stateResponse = await requestJson(baseUrl, '/api/state');
  assert.equal(stateResponse.status, 200);
  assert.equal(stateResponse.body.state.generatedStudentCampaigns.length, 1);
  assert.equal(stateResponse.body.state.generatedStudentCampaigns[0].nfcUid, 'uid-100');

  const campaignResponse = await requestJson(baseUrl, '/api/students/uid-100/campaign');
  assert.equal(campaignResponse.status, 200);
  assert.equal(campaignResponse.body.nfcUid, 'uid-100');
  assert.equal(campaignResponse.body.campaign.campaignName, 'Alice Example Info');
  assert.equal(campaignResponse.body.campaign.items[1].type, 'IMAGE');
});

test('integration: admin API returns expected validation and not-found errors for common failure paths', { concurrency: false }, async (t) => {
  const { baseUrl } = await createAdminTestServer(t);

  const activeResponse = await requestJson(baseUrl, '/api/active', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      idleCampaignId: 'missing-idle',
    }),
  });
  assert.equal(activeResponse.status, 404);
  assert.equal(activeResponse.body.error, 'validation_failed');
  assert.equal(activeResponse.body.issues[0].path, 'idleCampaignId');

  const mediaResponse = await requestJson(baseUrl, '/api/media/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ not: 'multipart' }),
  });
  assert.equal(mediaResponse.status, 400);
  assert.equal(mediaResponse.body.error, 'validation_failed');
  assert.equal(mediaResponse.body.issues[0].code, 'invalid_content_type');

  const missingStudentResponse = await requestJson(baseUrl, '/api/students/unknown/campaign');
  assert.equal(missingStudentResponse.status, 404);
  assert.equal(missingStudentResponse.body.issues[0].path, 'nfcUid');

  const assetResponse = await fetch(`${baseUrl}/services/runtime-deps.js`);
  assert.equal(assetResponse.status, 200);
  assert.match(await assetResponse.text(), /AdminRuntimeDeps/);

  const notFoundResponse = await requestJson(baseUrl, '/api/nope');
  assert.equal(notFoundResponse.status, 404);
  assert.equal(notFoundResponse.body.error, 'not_found: /api/nope');
});
