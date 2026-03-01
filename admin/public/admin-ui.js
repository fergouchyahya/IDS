let state = null;

function setStatus(msg, ok = true) {
  const el = document.getElementById('status');
  el.className = ok ? 'good' : 'bad';
  el.textContent = msg;
}

function parseItems(text) {
  const parsed = JSON.parse(text || '[]');
  if (!Array.isArray(parsed)) throw new Error('Items must be a JSON array');
  return parsed;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fillSelect(selectEl, campaigns, selectedId) {
  selectEl.innerHTML = '';
  for (const c of campaigns) {
    const opt = document.createElement('option');
    opt.value = c.campaignId;
    opt.textContent = `${c.campaignName} (${c.campaignId})`;
    if (c.campaignId === selectedId) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function renderLists() {
  const idleItems = state.idleCampaigns.map((c) => `
    <div class="item">
      <div><b>${c.campaignName}</b> <span class="mono">${c.campaignId}</span></div>
      <div class="mono">${c.items.length} item(s)</div>
      <div class="row">
        <button onclick="deleteCampaignUI('${c.campaignId}')">Delete</button>
      </div>
    </div>
  `).join('');

  const visitorItems = state.visitorCampaigns.map((c) => `
    <div class="item">
      <div><b>${c.campaignName}</b> <span class="mono">${c.campaignId}</span></div>
      <div class="mono">${c.items.length} item(s)</div>
      <div class="row">
        <button onclick="deleteCampaignUI('${c.campaignId}')">Delete</button>
      </div>
    </div>
  `).join('');

  const students = state.students.map((s) => `
    <div class="item">
      <div><b>${s.name}</b> <span class="mono">${s.nfcUid}</span></div>
      <div class="mono">${s.campaign.items.length} item(s)</div>
      <div class="row">
        <button onclick="deleteStudentUI('${s.nfcUid}')">Delete</button>
      </div>
    </div>
  `).join('');

  document.getElementById('lists').innerHTML = `
    <h3>Idle campaigns</h3><div class="list">${idleItems || '<i>None</i>'}</div>
    <h3>Visitor campaigns</h3><div class="list">${visitorItems || '<i>None</i>'}</div>
    <h3>Students</h3><div class="list">${students || '<i>None</i>'}</div>
  `;
}

async function refresh() {
  const data = await api('/api/state');
  state = data.state;
  document.getElementById('timeoutMs').value = state.settings.inactivityTimeoutMs;
  document.getElementById('menuName').value = state.menuCampaign?.campaignName || 'Menu';
  document.getElementById('menuItems').value = JSON.stringify(state.menuCampaign?.items || [], null, 2);

  fillSelect(document.getElementById('activeIdle'), state.idleCampaigns, state.active.idleCampaignId);
  fillSelect(document.getElementById('activeVisitor'), state.visitorCampaigns, state.active.visitorCampaignId);

  renderLists();
  setStatus('Loaded', true);
}

async function saveSettings() {
  try {
    await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ inactivityTimeoutMs: Number(document.getElementById('timeoutMs').value) }),
    });
    await refresh();
    setStatus('Settings saved');
  } catch (e) { setStatus(e.message, false); }
}

async function saveActive() {
  try {
    await api('/api/active', {
      method: 'POST',
      body: JSON.stringify({
        idleCampaignId: document.getElementById('activeIdle').value,
        visitorCampaignId: document.getElementById('activeVisitor').value,
      }),
    });
    await refresh();
    setStatus('Active campaigns updated');
  } catch (e) { setStatus(e.message, false); }
}

async function saveMenu() {
  try {
    await api('/api/menu-campaign', {
      method: 'POST',
      body: JSON.stringify({
        campaignName: document.getElementById('menuName').value,
        items: parseItems(document.getElementById('menuItems').value),
      }),
    });
    await refresh();
    setStatus('Menu campaign saved');
  } catch (e) { setStatus(e.message, false); }
}

async function createCampaignUI() {
  try {
    await api('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        kind: document.getElementById('campaignKind').value,
        campaignName: document.getElementById('campaignName').value,
        items: parseItems(document.getElementById('campaignItems').value),
      }),
    });
    await refresh();
    setStatus('Campaign created');
  } catch (e) { setStatus(e.message, false); }
}

async function deleteCampaignUI(campaignId) {
  if (!confirm('Delete campaign ' + campaignId + '?')) return;
  try {
    await api('/api/campaigns/' + encodeURIComponent(campaignId), { method: 'DELETE' });
    await refresh();
    setStatus('Campaign deleted');
  } catch (e) { setStatus(e.message, false); }
}

async function saveStudent() {
  try {
    const uid = document.getElementById('studentUid').value;
    await api('/api/students', {
      method: 'POST',
      body: JSON.stringify({
        nfcUid: uid,
        name: document.getElementById('studentName').value,
        items: parseItems(document.getElementById('studentItems').value),
      }),
    });
    await refresh();
    setStatus('Student saved');
  } catch (e) { setStatus(e.message, false); }
}

async function deleteStudentUI(uid) {
  if (!confirm('Delete student ' + uid + '?')) return;
  try {
    await api('/api/students/' + encodeURIComponent(uid), { method: 'DELETE' });
    await refresh();
    setStatus('Student deleted');
  } catch (e) { setStatus(e.message, false); }
}

window.saveSettings = saveSettings;
window.saveActive = saveActive;
window.saveMenu = saveMenu;
window.createCampaignUI = createCampaignUI;
window.deleteCampaignUI = deleteCampaignUI;
window.saveStudent = saveStudent;
window.deleteStudentUI = deleteStudentUI;

refresh().catch((e) => setStatus(e.message, false));
