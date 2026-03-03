let state = null;
let selectedCampaignId = null;
let selectedBlockIndex = null;
let sidebarQuery = "";
let dragSourceIndex = null;
let overviewTypeFilter = "all";
let overviewStatusFilter = "all";

const builder = {
  type: "idle",
  mode: "new",
  sourceId: "",
  campaignName: "",
  studentUid: "",
  blocks: [],
  campaignId: null,
};

let menuBlocks = [];
let builderIssues = [];
let menuIssues = [];
const { setStatus, escapeHtml, api } = window.AdminHttp;
const { defaultBlock, makeBlockByType } = window.AdminBlocks;

function getGeneratedStudentCampaigns() {
  return Array.isArray(state?.generatedStudentCampaigns) ? state.generatedStudentCampaigns : [];
}

function findStudentCampaignByUid(uid) {
  const key = String(uid || "").trim();
  if (!key) return null;

  const manual = (state?.students || []).find((s) => s.nfcUid === key);
  if (manual && manual.campaign) {
    return {
      source: "manual",
      nfcUid: key,
      name: manual.name || "Unnamed student",
      campaign: manual.campaign,
    };
  }

  const generated = getGeneratedStudentCampaigns().find((item) => item.nfcUid === key);
  if (generated && generated.campaign) {
    return {
      source: "generated",
      nfcUid: key,
      name: generated.name || "Generated student",
      campaign: generated.campaign,
    };
  }

  return null;
}

function getCampaignsByType(type) {
  if (!state) return [];
  if (type === "idle") return state.idleCampaigns || [];
  if (type === "visitor") return state.visitorCampaigns || [];
  if (type === "student") {
    const manual = (state.students || []).map((s) => ({
      campaignId: s.campaign?.campaignId || `student-${s.nfcUid}`,
      campaignName: s.name,
      kind: "student",
      nfcUid: s.nfcUid,
      items: s.campaign?.items || [],
      updatedAt: s.updatedAt || s.campaign?.updatedAt || state.updatedAt || "",
      source: "manual",
    }));

    const existing = new Set(manual.map((item) => item.nfcUid));
    const generated = getGeneratedStudentCampaigns()
      .filter((item) => !existing.has(item.nfcUid))
      .map((item) => ({
        campaignId: item.campaign?.campaignId || `student-${item.nfcUid}`,
        campaignName: item.name,
        kind: "student",
        nfcUid: item.nfcUid,
        items: item.campaign?.items || [],
        updatedAt: item.campaign?.updatedAt || state.updatedAt || "",
        source: "generated",
      }));

    return [...manual, ...generated];
  }
  return [];
}

function toRelativeTime(isoString) {
  const value = String(isoString || "").trim();
  if (!value) return "Unknown";
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "Unknown";

  const delta = Date.now() - ts;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 8) return `${days}d ago`;

  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeCampaignCards() {
  if (!state) return [];

  const cards = [];

  for (const campaign of state.idleCampaigns || []) {
    cards.push({
      kind: "idle",
      id: campaign.campaignId,
      name: campaign.campaignName || "Untitled idle campaign",
      status: campaign.campaignId === state.active?.idleCampaignId ? "live" : "draft",
      items: Array.isArray(campaign.items) ? campaign.items : [],
      updatedAt: campaign.updatedAt || campaign.generatedAt || state.updatedAt || "",
      subtitle: campaign.campaignId || "",
    });
  }

  for (const campaign of state.visitorCampaigns || []) {
    cards.push({
      kind: "visitor",
      id: campaign.campaignId,
      name: campaign.campaignName || "Untitled visitor campaign",
      status: campaign.campaignId === state.active?.visitorCampaignId ? "live" : "draft",
      items: Array.isArray(campaign.items) ? campaign.items : [],
      updatedAt: campaign.updatedAt || campaign.generatedAt || state.updatedAt || "",
      subtitle: campaign.campaignId || "",
    });
  }

  for (const student of getCampaignsByType("student")) {
    const isGenerated = student.source === "generated";
    cards.push({
      kind: "student",
      id: student.nfcUid,
      name: student.campaignName || "Unnamed student profile",
      status: "live",
      items: Array.isArray(student.items) ? student.items : [],
      updatedAt: student.updatedAt || state.updatedAt || "",
      subtitle: `UID: ${student.nfcUid || "n/a"}${isGenerated ? " | Auto-generated" : ""}`,
    });
  }

  if (state.menuCampaign) {
    cards.push({
      kind: "menu",
      id: state.menuCampaign.campaignId || "menu-default",
      name: state.menuCampaign.campaignName || "Menu",
      status: "live",
      items: Array.isArray(state.menuCampaign.items) ? state.menuCampaign.items : [],
      updatedAt: state.menuCampaign.updatedAt || state.updatedAt || "",
      subtitle: state.menuCampaign.campaignId || "menu-default",
    });
  }

  return cards.sort((a, b) => {
    if (a.status !== b.status) return a.status === "live" ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  });
}

function cardTypeLabel(kind) {
  return {
    idle: "Idle",
    visitor: "Visitor",
    student: "Student",
    menu: "Menu",
  }[kind] || "Campaign";
}

function renderTimelineBars(items) {
  const list = Array.isArray(items) ? items.slice(0, 6) : [];
  if (list.length === 0) {
    return '<div class="overview-timeline-empty">No blocks yet</div>';
  }

  const maxDuration = Math.max(...list.map((item) => Math.max(1, Number(item.durationSec) || 1)), 1);
  return `
    <div class="overview-timeline-bars">
      ${list
    .map((item) => {
      const duration = Math.max(1, Number(item.durationSec) || 1);
      const width = Math.max(12, Math.round((duration / maxDuration) * 100));
      return `<span class="overview-bar" style="width:${width}%"></span>`;
    })
    .join("")}
    </div>
  `;
}

/* ===== SIDEBAR RENDERING ===== */
function renderSidebar() {
  const sidebarContent = document.getElementById("overviewGrid");
  if (!sidebarContent) return;
  if (!state) {
    sidebarContent.innerHTML = '<div class="overview-empty">Loading campaigns...</div>';
    return;
  }

  const query = sidebarQuery.trim().toLowerCase();
  const cards = normalizeCampaignCards().filter((card) => {
    if (query && !String(card.name || "").toLowerCase().includes(query) && !String(card.subtitle || "").toLowerCase().includes(query)) {
      return false;
    }
    if (overviewTypeFilter !== "all" && card.kind !== overviewTypeFilter) return false;
    if (overviewStatusFilter !== "all" && card.status !== overviewStatusFilter) return false;
    return true;
  });

  const liveCount = cards.filter((card) => card.status === "live").length;
  const totalCount = cards.length;
  const countEl = document.getElementById("overviewCount");
  if (countEl) {
    countEl.textContent = `${totalCount} campaigns`;
  }
  const liveEl = document.getElementById("overviewLiveCount");
  if (liveEl) {
    liveEl.textContent = `${liveCount} live`;
  }

  const html = cards.map((card) => {
    const isActive = selectedCampaignId === card.id;
    const safeKind = escapeHtml(card.kind);
    const kindArg = JSON.stringify(String(card.kind || ""));
    const idArg = JSON.stringify(String(card.id || ""));
    return `
      <article class="overview-card type-${safeKind} status-${escapeHtml(card.status)} ${isActive ? "active" : ""}" onclick='loadCampaignToEditor(${kindArg}, ${idArg})'>
        <div class="overview-card-accent"></div>
        <div class="overview-card-top">
          <span class="type-badge">${escapeHtml(cardTypeLabel(card.kind))}</span>
          <span class="status-pill ${escapeHtml(card.status)}">${escapeHtml(card.status === "live" ? "Live" : "Draft")}</span>
        </div>
        <h3 class="overview-card-title">${escapeHtml(card.name)}</h3>
        <p class="overview-card-subtitle">${escapeHtml(card.subtitle)}</p>
        <div class="overview-meta">
          <span>${card.items.length} blocks</span>
          <span>Modified ${escapeHtml(toRelativeTime(card.updatedAt))}</span>
        </div>
        ${renderTimelineBars(card.items)}
        <div class="overview-actions" onclick="event.stopPropagation()">
          <button class="overview-action" onclick='loadCampaignToEditor(${kindArg}, ${idArg})'>Edit</button>
          <button class="overview-action" onclick='duplicateCampaignFromOverview(${kindArg}, ${idArg})'>Duplicate</button>
          <button class="overview-action primary" onclick='deployCampaignFromOverview(${kindArg}, ${idArg})'>Deploy</button>
        </div>
      </article>
    `;
  }).join("");

  sidebarContent.innerHTML = html || '<div class="overview-empty">No campaigns match your filters.</div>';
}

function duplicateCampaignFromOverview(type, id) {
  if (!state) return;

  selectedCampaignId = null;
  selectedBlockIndex = null;

  if (type === "student") {
    const student = findStudentCampaignByUid(id);
    if (!student) {
      setStatus("Student campaign not found", false);
      return;
    }
    setBuilderFromCampaign(student.campaign, "student", student.nfcUid);
    builder.campaignId = null;
    builder.studentUid = "";
    builder.campaignName = `${student.name || "Student"} Copy`;
  } else if (type === "menu") {
    if (!state.menuCampaign) {
      setStatus("Menu campaign not found", false);
      return;
    }
    setBuilderFromCampaign(state.menuCampaign, "menu");
    builder.campaignId = null;
    builder.campaignName = `${state.menuCampaign.campaignName || "Menu"} Copy`;
  } else {
    const campaign = getCampaignsByType(type).find((c) => c.campaignId === id);
    if (!campaign) {
      setStatus("Campaign not found", false);
      return;
    }
    setBuilderFromCampaign(campaign, type);
    builder.campaignId = null;
    builder.campaignName = `${campaign.campaignName || "Campaign"} Copy`;
  }

  syncFormFromBuilder();
  renderSidebar();
  renderInspector();
  updateCampaignHeader();
  setStatus("Duplicate loaded into editor draft", true);
}

async function deployCampaignFromOverview(type, id) {
  if (!state) return;

  try {
    if (type === "idle" || type === "visitor") {
      await api("/api/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idleCampaignId: type === "idle" ? id : state.active?.idleCampaignId,
          visitorCampaignId: type === "visitor" ? id : state.active?.visitorCampaignId,
        }),
      });
      await refresh();
      setStatus(`${cardTypeLabel(type)} campaign deployed`, true);
      return;
    }

    if (type === "menu") {
      loadCampaignToEditor("menu", id);
      await publishCampaign();
      return;
    }

    loadCampaignToEditor("student", id);
    setStatus("Student campaigns are available on NFC tap", true);
  } catch (e) {
    setStatus("Deploy failed", false, e.issues || []);
  }
}

/* ===== BLOCK CARD RENDERING ===== */
function renderBlocks() {
  const blocksEl = document.getElementById("blocks");
  if (!blocksEl) return;

  if (!builder.blocks || builder.blocks.length === 0) {
    blocksEl.innerHTML = '<div class="blocks-empty"><p>No blocks added yet</p><p style="font-size: 12px;">Click "Add Block" to get started</p></div>';
    return;
  }

  const html = builder.blocks
    .map((block, idx) => {
      const type = String(block.type || "TEXT").toUpperCase();
      const isSelected = selectedBlockIndex === idx;
      const preview = type === "TEXT" ? block.data : `${type.toLowerCase()} content`;

      return `
        <div class="block-card ${isSelected ? "selected" : ""}"
             draggable="true"
             onclick="selectBlock(${idx})"
             ondragstart="startDragBlock(event, ${idx})"
             ondragover="allowDrop(event)"
             ondragenter="dragEnterBlock(event, ${idx})"
             ondragleave="dragLeaveBlock(event, ${idx})"
             ondrop="dropBlock(event, ${idx})"
             ondragend="endDragBlock()">
          <div class="block-drag-handle">⋮⋮</div>
          <div class="block-content">
            <div class="block-head">
              <span class="block-type-badge">${escapeHtml(type)}</span>
              <span class="block-preview">${escapeHtml(preview.slice(0, 60))}</span>
              <span class="block-duration">${block.durationSec || 30}s</span>
            </div>
          </div>
          <div class="block-menu" onclick="event.stopPropagation(); showBlockMenu(${idx})">∴</div>
        </div>
      `;
    })
    .join("");

  blocksEl.innerHTML = html;
}

/* ===== INSPECTOR PANEL RENDERING ===== */
function renderInspector() {
  const inspectorContent = document.getElementById("inspectorContent");
  if (!inspectorContent) return;

  if (selectedBlockIndex !== null && builder.blocks[selectedBlockIndex]) {
    const block = builder.blocks[selectedBlockIndex];
    const type = String(block.type || "TEXT").toUpperCase();

    let html = `
      <div class="inspector-section">
        <h4 class="section-title">Block Details</h4>
        <div class="form-group">
          <label class="form-label">Block ID</label>
          <input class="form-input" value="${escapeHtml(block.contentId)}" onclick="selectBlock(${selectedBlockIndex})" readonly style="opacity: 0.6; cursor: not-allowed;" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" onchange="updateBlockField('blocks', ${selectedBlockIndex}, 'type', this.value)">
            <option value="TEXT" ${type === "TEXT" ? "selected" : ""}>Text</option>
            <option value="IMAGE" ${type === "IMAGE" ? "selected" : ""}>Image</option>
            <option value="VIDEO" ${type === "VIDEO" ? "selected" : ""}>Video</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Duration (seconds)</label>
          <input type="number" class="form-input" min="1" value="${block.durationSec || 30}" oninput="updateBlockField('blocks', ${selectedBlockIndex}, 'durationSec', this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Order</label>
          <input type="number" class="form-input" min="1" value="${block.order || (selectedBlockIndex + 1)}" onchange="updateBlockField('blocks', ${selectedBlockIndex}, 'order', this.value)" />
        </div>
      </div>

      <div class="inspector-section">
        <h4 class="section-title">${type === "TEXT" ? "Content" : "Media"}</h4>
        ${type === "TEXT"
        ? `<textarea class="form-input form-textarea" oninput="updateBlockField('blocks', ${selectedBlockIndex}, 'data', this.value)">${escapeHtml(block.data || "")}</textarea>`
        : `
              <input type="text" class="form-input" value="${escapeHtml(block.data || "")}" oninput="updateBlockField('blocks', ${selectedBlockIndex}, 'data', this.value)" placeholder="Paste image/video URL" />
              <div style="margin-top: 10px;">
                <label class="form-label">Upload ${type.toLowerCase()}</label>
                <input type="file" id="blocks-file-${selectedBlockIndex}" accept="${type === "IMAGE" ? "image/*" : "video/*"}" />
                <button class="btn btn-secondary" style="width: 100%; margin-top: 8px;" onclick="uploadForBlock('blocks', ${selectedBlockIndex})">Upload</button>
              </div>
            `
      }
      </div>

      <div class="inspector-section">
        <h4 class="section-title">Actions</h4>
        <button class="btn btn-secondary" style="width: 100%; margin-bottom: 8px;" onclick="duplicateBlock(${selectedBlockIndex})">Duplicate</button>
        <button class="btn btn-secondary" style="width: 100%; color: var(--danger); border-color: var(--danger);" onclick="removeBlock('blocks', ${selectedBlockIndex})">Delete</button>
      </div>
    `;

    inspectorContent.innerHTML = html;
  } else if (selectedCampaignId || builder) {
    // Campaign properties
    const inspectorHtml = `
      <div class="inspector-section">
        <h4 class="section-title">Campaign Settings</h4>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" id="inspectorCampaignName" value="${escapeHtml(builder.campaignName)}" oninput="updateCampaignName(this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" id="inspectorType" onchange="changeCampaignType(this.value)">
            <option value="idle" ${builder.type === "idle" ? "selected" : ""}>Idle</option>
            <option value="visitor" ${builder.type === "visitor" ? "selected" : ""}>Visitor</option>
            <option value="student" ${builder.type === "student" ? "selected" : ""}>Student</option>
            <option value="menu" ${builder.type === "menu" ? "selected" : ""}>Menu</option>
          </select>
        </div>
        ${builder.type === "student"
        ? `<div class="form-group">
                <label class="form-label">Student UID</label>
                <input type="text" class="form-input" value="${escapeHtml(builder.studentUid)}" oninput="updateStudentUidFromInspector(this.value)" />
              </div>`
        : ""
      }
      </div>

      <div class="inspector-section">
        <h4 class="section-title">Status</h4>
        <div style="padding: 12px; background: var(--bg-primary); border-radius: 6px; font-size: 13px;">
          <span class="status-indicator ${builder.blocks.length > 0 ? "live" : "draft"}">
            ${builder.blocks.length > 0 ? "Ready" : "Draft"}
          </span>
        </div>
      </div>
      <div class="inspector-section">
        <h4 class="section-title">Campaign Actions</h4>
        <button class="btn btn-secondary" style="width: 100%; color: var(--danger); border-color: var(--danger);" onclick="deleteCurrentCampaign()">Delete Campaign</button>
      </div>
      ${renderActiveCampaignPanel()}
    `;
    inspectorContent.innerHTML = inspectorHtml;
  } else {
    inspectorContent.innerHTML = '<div class="blocks-empty" style="text-align: center; color: var(--text-tertiary); font-size: 12px; padding: 24px;">Select a campaign or block to view properties</div>';
  }
}

function fillSelect(selectEl, options, selectedValue) {
  selectEl.innerHTML = "";
  for (const optData of options) {
    const opt = document.createElement("option");
    opt.value = optData.value;
    opt.textContent = optData.label;
    if (String(optData.value) === String(selectedValue)) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

/* ===== UI INTERACTION HANDLERS ===== */
function createNewCampaign() {
  selectedCampaignId = null;
  selectedBlockIndex = null;
  resetBuilderForType("idle");
  renderSidebar();
  renderBlocks();
  renderInspector();
  updateCampaignHeader();
  setStatus("New campaign started", true);
}

function loadCampaignToEditor(type, campaignId) {
  selectedCampaignId = campaignId;
  selectedBlockIndex = null;

  if (type === "menu") {
    if (state.menuCampaign) {
      builder.campaignId = "menu";
      builder.type = "menu";
      builder.campaignName = state.menuCampaign.campaignName || "Menu";
      builder.blocks = Array.isArray(state.menuCampaign.items) ? state.menuCampaign.items.map((b) => ({ ...b })) : [defaultBlock(1)];
    }
  } else if (type === "student") {
    const student = findStudentCampaignByUid(campaignId);
    if (student) {
      builder.campaignId = `student-${campaignId}`;
      builder.type = "student";
      builder.campaignName = student.name || "";
      builder.studentUid = campaignId;
      builder.blocks = Array.isArray(student.campaign?.items) && student.campaign.items.length > 0
        ? student.campaign.items.map((b) => ({ ...b }))
        : [defaultBlock(1)];
    }
  } else {
    const campaign = getCampaignsByType(type).find((c) => c.campaignId === campaignId);
    if (campaign) {
      builder.campaignId = campaignId;
      builder.type = type;
      builder.campaignName = campaign.campaignName || "";
      builder.blocks = Array.isArray(campaign.items) && campaign.items.length > 0
        ? campaign.items.map((b) => ({ ...b }))
        : [defaultBlock(1)];
    }
  }

  renderSidebar();
  renderBlocks();
  renderInspector();
  updateCampaignHeader();
}

function selectBlock(idx) {
  selectedBlockIndex = idx;
  renderBlocks();
  renderInspector();
}

function updateCampaignHeader() {
  const nameInput = document.getElementById("campaignNameInput");
  const typeSelect = document.getElementById("builderType");
  const statusBadge = document.getElementById("statusBadge");

  if (nameInput) nameInput.value = builder.campaignName;
  if (typeSelect) typeSelect.value = builder.type;

  if (statusBadge) {
    statusBadge.textContent = builder.blocks.length > 0 ? "Ready" : "Draft";
    statusBadge.className = `status-indicator ${builder.blocks.length > 0 ? "live" : "draft"}`;
  }

  // Update student UID field visibility
  const studentUidWrap = document.getElementById("studentUidWrap");
  if (studentUidWrap) {
    studentUidWrap.style.display = builder.type === "student" ? "block" : "none";
    const studentUidInput = document.getElementById("studentUid");
    if (studentUidInput) studentUidInput.value = builder.studentUid;
  }
}

function updateCampaignName(newName) {
  builder.campaignName = newName;
  updateCampaignHeader();
}

function updateStudentUidFromInspector(value) {
  builder.studentUid = value;
  updateCampaignHeader();
  updateSaveButtons();
}

function renderActiveCampaignPanel() {
  if (!state) return "";

  const idleOptions = (state.idleCampaigns || [])
    .map((c) => `<option value="${escapeHtml(c.campaignId)}"${c.campaignId === state.active?.idleCampaignId ? " selected" : ""}>${escapeHtml(c.campaignName)}</option>`)
    .join("");
  const visitorOptions = (state.visitorCampaigns || [])
    .map((c) => `<option value="${escapeHtml(c.campaignId)}"${c.campaignId === state.active?.visitorCampaignId ? " selected" : ""}>${escapeHtml(c.campaignName)}</option>`)
    .join("");

  const menuOption = state.menuCampaign
    ? `<option value="${escapeHtml(state.menuCampaign.campaignId || "menu-default")}" selected>${escapeHtml(state.menuCampaign.campaignName || "Menu")}</option>`
    : `<option value="" selected>No menu campaign</option>`;

  return `
    <div class="inspector-section">
      <h4 class="section-title">Active Campaigns</h4>
      <div class="form-group">
        <label class="form-label">Idle</label>
        <select class="form-select" id="activeIdleSelect">${idleOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Visitor</label>
        <select class="form-select" id="activeVisitorSelect">${visitorOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Menu</label>
        <select class="form-select" id="activeMenuSelect" disabled>${menuOption}</select>
      </div>
      <button class="btn btn-primary" style="width: 100%;" onclick="applyActiveSelections()">Apply</button>
    </div>
  `;
}

async function applyActiveSelections() {
  const idleEl = document.getElementById("activeIdleSelect");
  const visitorEl = document.getElementById("activeVisitorSelect");
  if (!idleEl || !visitorEl) return;

  try {
    await api("/api/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idleCampaignId: idleEl.value,
        visitorCampaignId: visitorEl.value,
      }),
    });
    await refresh();
    setStatus("Active campaigns updated", true);
  } catch (e) {
    setStatus("Active campaigns update failed", false, e.issues || []);
  }
}

function changeCampaignType(newType) {
  builder.type = newType;
  // Changing type from inspector means this is now a new unsaved draft.
  builder.campaignId = null;
  selectedCampaignId = null;
  updateCampaignHeader();
  renderInspector();
}

function resolveCampaignIdFromState(kind, campaignName) {
  if (!state) return null;
  if (kind === "menu") return state.menuCampaign?.campaignId || "menu-default";
  if (kind === "student") return `student-${String(builder.studentUid || "").trim()}`;

  const list = kind === "idle" ? state.idleCampaigns || [] : state.visitorCampaigns || [];
  const exact = list.find((c) => c.campaignName === campaignName);
  if (exact) return exact.campaignId;
  return list[list.length - 1]?.campaignId || null;
}

function showBlockMenu(idx) {
  // Could be expanded to a dropdown menu with more options
  const options = [
    { label: "Duplicate", action: () => duplicateBlock(idx) },
    { label: "Delete", action: () => removeBlock("blocks", idx) },
  ];
  // For now, just allow selection
  selectBlock(idx);
}

function duplicateBlock(idx) {
  if (!builder.blocks[idx]) return;
  const newBlock = { ...builder.blocks[idx] };
  newBlock.contentId = `content-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  builder.blocks.splice(idx + 1, 0, newBlock);
  renderBlocks();
  selectedBlockIndex = idx + 1;
  renderInspector();
  setStatus("Block duplicated", true);
}

function startDragBlock(event, idx) {
  dragSourceIndex = idx;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("blockIndex", idx);
  const card = event.currentTarget?.closest(".block-card");
  if (card) {
    card.classList.add("dragging");
  }
}

function allowDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function dragEnterBlock(event, targetIdx) {
  event.preventDefault();
  if (targetIdx === dragSourceIndex) return;
  const card = event.currentTarget?.closest(".block-card");
  if (card) card.classList.add("drop-target");
}

function dragLeaveBlock(event) {
  const card = event.currentTarget?.closest(".block-card");
  if (card) card.classList.remove("drop-target");
}

function endDragBlock() {
  dragSourceIndex = null;
  document.querySelectorAll(".block-card.dragging, .block-card.drop-target").forEach((el) => {
    el.classList.remove("dragging");
    el.classList.remove("drop-target");
  });
}

function normalizeBlockOrder(blocks) {
  blocks.forEach((block, idx) => {
    block.order = idx + 1;
  });
}

function dropBlock(event, targetIdx) {
  event.preventDefault();
  const sourceIdxRaw = event.dataTransfer.getData("blockIndex");
  const sourceIdx = Number(sourceIdxRaw || dragSourceIndex);
  if (sourceIdx === targetIdx) return;

  if (selectedBlockIndex !== null) {
    if (selectedBlockIndex === sourceIdx) {
      selectedBlockIndex = targetIdx;
    } else if (sourceIdx < selectedBlockIndex && targetIdx >= selectedBlockIndex) {
      selectedBlockIndex -= 1;
    } else if (sourceIdx > selectedBlockIndex && targetIdx <= selectedBlockIndex) {
      selectedBlockIndex += 1;
    }
  }

  const block = builder.blocks[sourceIdx];
  builder.blocks.splice(sourceIdx, 1);
  builder.blocks.splice(targetIdx, 0, block);
  normalizeBlockOrder(builder.blocks);
  endDragBlock();
  renderBlocks();
  renderInspector();
  updateSaveButtons();
}

function showAddBlockMenu() {
  // Show modal or menu to add block type
  const types = ["TEXT", "IMAGE", "VIDEO"];
  let html = `<div style="display: flex; gap: 8px; flex-wrap: wrap;">`;
  types.forEach((type) => {
    html += `<button class="btn btn-secondary" onclick="addBlockOfType('${type}')">+ ${type}</button>`;
  });
  html += `</div>`;
  // In a real implementation, you'd show this in a modal
  // For now, just call the default
  addBlockOfType("TEXT");
}

function renderBuilderTypeOptions() {
  const typeSelect = document.getElementById("builderType");
  fillSelect(
    typeSelect,
    [
      { value: "idle", label: "Idle" },
      { value: "visitor", label: "Visitor" },
      { value: "student", label: "Student" },
      { value: "menu", label: "Menu" },
    ],
    builder.type,
  );
}

function renderDuplicateOptions() {
  const wrap = document.getElementById("duplicateWrap");
  const select = document.getElementById("duplicateSource");
  if (!wrap || !select) return;

  if (builder.mode !== "duplicate") {
    wrap.style.display = "none";
    builder.sourceId = "";
    select.innerHTML = "";
    return;
  }

  const options = getCampaignsByType(builder.type).map((c) => {
    const id = builder.type === "student" ? c.nfcUid : c.campaignId;
    const suffix = builder.type === "student" ? `UID: ${c.nfcUid}` : c.campaignId;
    return { value: id, label: `${c.campaignName} (${suffix})` };
  });

  wrap.style.display = "block";
  if (options.length === 0) {
    fillSelect(select, [{ value: "", label: "No source available" }], "");
    builder.sourceId = "";
    return;
  }

  if (!builder.sourceId) {
    builder.sourceId = options[0].value;
  }

  fillSelect(select, options, builder.sourceId);
}

function getBlockIssues(issues, idx, field) {
  const path = `items[${idx}].${field}`;
  const issue = issues.find((i) => i.path === path);
  return issue ? issue.message : "";
}

function issuePathToInputId(scope, path) {
  if (scope === "builder") {
    if (path === "campaignName") return "campaignName";
    if (path === "studentUid") return "studentUid";
    const m = /^items\[(\d+)\]\.(.+)$/.exec(path);
    if (m) return `blocks-input-${m[1]}-${m[2]}`;
    return "campaignName";
  }

  if (scope === "menu") {
    if (path === "campaignName") return "menuName";
    const m = /^items\[(\d+)\]\.(.+)$/.exec(path);
    if (m) return `menuBlocks-input-${m[1]}-${m[2]}`;
    return "menuName";
  }

  return "status";
}

function renderIssues(targetId, issues, scope) {
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!issues || issues.length === 0) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }

  const blockNotes = issues
    .filter((i) => /^items\[\d+\]/.test(i.path))
    .map((i) => {
      const m = /items\[(\d+)\]/.exec(i.path);
      const blockIndex = m ? Number(m[1]) + 1 : "?";
      return `Problem in block ${blockIndex}: ${i.message}`;
    });

  const summary = Array.from(new Set(blockNotes));
  const rows = issues
    .map((i) => {
      const inputId = issuePathToInputId(scope, i.path);
      return `<li><a href="#${escapeHtml(inputId)}" data-target="${escapeHtml(inputId)}">${escapeHtml(i.message)}</a></li>`;
    })
    .join("");
  const summaryHtml = summary.map((s) => `<div>${escapeHtml(s)}</div>`).join("");

  el.style.display = "block";
  el.innerHTML = `${summaryHtml}<ul>${rows}</ul>`;

  el.querySelectorAll("a[data-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.getAttribute("data-target");
      const target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
}

function validateBlocks(blocks) {
  const issues = [];
  const seenContentIds = new Set();

  if (!Array.isArray(blocks) || blocks.length === 0) {
    issues.push({ path: "items", message: "At least one block is required", code: "required" });
    return issues;
  }

  blocks.forEach((block, idx) => {
    const p = `items[${idx}]`;
    const type = String(block.type || "").toUpperCase();
    const contentId = String(block.contentId || "").trim();
    const data = String(block.data || "").trim();
    const order = Number(block.order);
    const durationSec = Number(block.durationSec);

    if (!contentId) {
      issues.push({ path: `${p}.contentId`, message: "contentId is required", code: "required" });
    } else if (seenContentIds.has(contentId)) {
      issues.push({ path: `${p}.contentId`, message: "contentId must be unique", code: "duplicate" });
    }
    if (contentId) seenContentIds.add(contentId);

    if (!["TEXT", "IMAGE", "VIDEO"].includes(type)) {
      issues.push({ path: `${p}.type`, message: "type must be TEXT, IMAGE or VIDEO", code: "invalid_enum" });
    }

    if (!Number.isInteger(order) || order < 1) {
      issues.push({ path: `${p}.order`, message: "order must be an integer >= 1", code: "invalid_number" });
    }

    if (!Number.isInteger(durationSec) || durationSec < 1) {
      issues.push({ path: `${p}.durationSec`, message: "durationSec must be an integer >= 1", code: "invalid_number" });
    }

    if (!data) {
      issues.push({ path: `${p}.data`, message: `${type || "Block"} data is required`, code: "required" });
    }
  });

  return issues;
}

function validateBuilder() {
  const issues = [];

  if (builder.type === "student") {
    if (!String(builder.campaignName || "").trim()) {
      issues.push({ path: "campaignName", message: "Student name is required", code: "required" });
    }
    if (!String(builder.studentUid || "").trim()) {
      issues.push({ path: "studentUid", message: "Student UID is required", code: "required" });
    }
  } else if (!String(builder.campaignName || "").trim()) {
    issues.push({ path: "campaignName", message: "Campaign name is required", code: "required" });
  }

  issues.push(...validateBlocks(builder.blocks));
  return issues;
}

function validateMenu() {
  const issues = [];
  const menuNameEl = document.getElementById("menuName");
  if (!menuNameEl) return [];
  if (!String(menuNameEl.value || "").trim()) {
    issues.push({ path: "campaignName", message: "Menu campaign name is required", code: "required" });
  }
  issues.push(...validateBlocks(menuBlocks));
  return issues;
}

function normalizeBlock(block) {
  return {
    contentId: String(block.contentId || "").trim(),
    type: String(block.type || "TEXT").toUpperCase(),
    data: String(block.data || "").trim(),
    order: Number(block.order),
    durationSec: Number(block.durationSec),
  };
}

function updateSaveButtons() {
  builderIssues = validateBuilder();
  menuIssues = validateMenu();

  renderIssues("builderIssues", builderIssues, "builder");
  renderIssues("menuIssues", menuIssues, "menu");
  syncInlineBlockErrors("blocks", builder.blocks, builderIssues);
  syncInlineBlockErrors("menuBlocks", menuBlocks, menuIssues);

  const nameIssue = builderIssues.find((i) => i.path === "campaignName");
  const campaignNameErrorEl = document.getElementById("campaignNameError");
  if (campaignNameErrorEl) campaignNameErrorEl.textContent = nameIssue ? nameIssue.message : "";
  const uidIssue = builderIssues.find((i) => i.path === "studentUid");
  const studentUidErrorEl = document.getElementById("studentUidError");
  if (studentUidErrorEl) studentUidErrorEl.textContent = uidIssue ? uidIssue.message : "";
}

function syncInlineBlockErrors(containerId, blocks, issues) {
  const fields = ["contentId", "type", "order", "durationSec", "data"];
  for (let idx = 0; idx < blocks.length; idx += 1) {
    for (const field of fields) {
      const el = document.getElementById(`${containerId}-err-${idx}-${field}`);
      if (!el) continue;
      const msg = getBlockIssues(issues, idx, field);
      el.textContent = msg || "";
    }
  }
}

function renderBlockEditor(containerId, blocks, issues, options = {}) {
  const isMenu = Boolean(options.isMenu);
  const html = blocks
    .map((b, idx) => {
      const type = String(b.type || "TEXT").toUpperCase();
      const dataLabel = type === "TEXT" ? "Text content" : `${type} URL`;
      const uploadVisible = type === "IMAGE" || type === "VIDEO";

      return `
        <div class="block">
          <div class="block-head">
            <strong>Block ${idx + 1}</strong>
            <div class="row" style="margin:0">
              <button class="ghost" onclick="moveBlock('${containerId}', ${idx}, -1)" ${idx === 0 ? "disabled" : ""}>Up</button>
              <button class="ghost" onclick="moveBlock('${containerId}', ${idx}, 1)" ${idx === blocks.length - 1 ? "disabled" : ""}>Down</button>
              <button class="danger" onclick="removeBlock('${containerId}', ${idx})" ${blocks.length <= 1 ? "disabled" : ""}>Remove</button>
            </div>
          </div>
          <div class="row">
            <div class="stack">
              <label>contentId</label>
              <input id="${containerId}-input-${idx}-contentId" value="${escapeHtml(b.contentId)}" oninput="updateBlockField('${containerId}', ${idx}, 'contentId', this.value)" />
              <div id="${containerId}-err-${idx}-contentId" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "contentId"))}</div>
            </div>
            <div class="stack">
              <label>type</label>
              <select id="${containerId}-input-${idx}-type" onchange="updateBlockField('${containerId}', ${idx}, 'type', this.value)">
                <option value="TEXT" ${type === "TEXT" ? "selected" : ""}>TEXT</option>
                <option value="IMAGE" ${type === "IMAGE" ? "selected" : ""}>IMAGE</option>
                <option value="VIDEO" ${type === "VIDEO" ? "selected" : ""}>VIDEO</option>
              </select>
              <div id="${containerId}-err-${idx}-type" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "type"))}</div>
            </div>
            <div class="stack">
              <label>order</label>
              <input id="${containerId}-input-${idx}-order" type="number" min="1" value="${Number(b.order)}" onchange="updateBlockField('${containerId}', ${idx}, 'order', this.value)" />
              <div id="${containerId}-err-${idx}-order" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "order"))}</div>
            </div>
            <div class="stack">
              <label>durationSec</label>
              <input id="${containerId}-input-${idx}-durationSec" type="number" min="1" value="${Number(b.durationSec)}" oninput="updateBlockField('${containerId}', ${idx}, 'durationSec', this.value)" />
              <div id="${containerId}-err-${idx}-durationSec" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "durationSec"))}</div>
            </div>
          </div>

          <div class="stack">
            <label>${dataLabel}</label>
            ${type === "TEXT"
          ? `<textarea id="${containerId}-input-${idx}-data" oninput="updateBlockField('${containerId}', ${idx}, 'data', this.value)">${escapeHtml(b.data || "")}</textarea>`
          : `<input id="${containerId}-input-${idx}-data" value="${escapeHtml(b.data || "")}" oninput="updateBlockField('${containerId}', ${idx}, 'data', this.value)" placeholder="https://... or uploaded URL" />`
        }
            <div id="${containerId}-err-${idx}-data" class="inline-error">${escapeHtml(getBlockIssues(issues, idx, "data"))}</div>
          </div>

          <div class="row" style="display:${uploadVisible ? "flex" : "none"}">
            <input id="${containerId}-file-${idx}" type="file" accept="${type === "IMAGE" ? "image/*" : "video/*"}" />
            <button class="secondary" onclick="uploadForBlock('${containerId}', ${idx})">Upload ${type.toLowerCase()}</button>
            <div class="mini">Max 20MB, stored in admin uploads.</div>
          </div>
        </div>
      `;
    })
    .join("");

  document.getElementById(containerId).innerHTML = html || "<i>No blocks</i>";

  if (!isMenu) {
    const uidWrap = document.getElementById("studentUidWrap");
    uidWrap.style.display = builder.type === "student" ? "block" : "none";
  }
}

function syncFormFromBuilder() {
  const campaignNameInput = document.getElementById("campaignNameInput");
  if (campaignNameInput) campaignNameInput.value = builder.campaignName;

  const typeSelect = document.getElementById("builderType");
  if (typeSelect) typeSelect.value = builder.type;

  const studentUidInput = document.getElementById("studentUid");
  if (studentUidInput) studentUidInput.value = builder.studentUid;

  renderDuplicateOptions();
  renderBlocks();
  updateSaveButtons();
}

function resetBuilderForType(type) {
  builder.type = type;
  builder.campaignId = null;
  builder.mode = "new";
  builder.sourceId = "";
  builder.campaignName = "";
  builder.studentUid = "";
  builder.blocks = [defaultBlock(1)];
  syncFormFromBuilder();
}

function setBuilderFromCampaign(campaign, type, studentUid = "") {
  builder.campaignId = campaign?.campaignId || null;
  builder.type = type;
  builder.campaignName = campaign?.campaignName || "";
  builder.studentUid = studentUid;
  builder.blocks = Array.isArray(campaign?.items) && campaign.items.length > 0
    ? campaign.items.map((item) => ({ ...item }))
    : [defaultBlock(1)];
  syncFormFromBuilder();
}

function renderLists() {
  const idleItems = (state.idleCampaigns || [])
    .map((c) => `
      <div class="item">
        <div><b>${escapeHtml(c.campaignName)}</b> <span class="mono">${escapeHtml(c.campaignId)}</span></div>
        <div class="mono">${c.items.length} block(s)</div>
        <div class="row">
          <button class="ghost" onclick="loadExistingCampaign('idle','${escapeHtml(c.campaignId)}')">Load in builder</button>
          <button class="danger" onclick="deleteCampaignUI('${escapeHtml(c.campaignId)}')">Delete</button>
        </div>
      </div>
    `)
    .join("");

  const visitorItems = (state.visitorCampaigns || [])
    .map((c) => `
      <div class="item">
        <div><b>${escapeHtml(c.campaignName)}</b> <span class="mono">${escapeHtml(c.campaignId)}</span></div>
        <div class="mono">${c.items.length} block(s)</div>
        <div class="row">
          <button class="ghost" onclick="loadExistingCampaign('visitor','${escapeHtml(c.campaignId)}')">Load in builder</button>
          <button class="danger" onclick="deleteCampaignUI('${escapeHtml(c.campaignId)}')">Delete</button>
        </div>
      </div>
    `)
    .join("");

  const students = getCampaignsByType("student")
    .map((s) => `
      <div class="item">
        <div><b>${escapeHtml(s.campaignName || "Student")}</b> <span class="mono">${escapeHtml(s.nfcUid)}</span></div>
        <div class="mono">${s.items?.length || 0} block(s)${s.source === "generated" ? " | Auto" : ""}</div>
        <div class="row">
          <button class="ghost" onclick="loadExistingStudent('${escapeHtml(s.nfcUid)}')">Load in builder</button>
          ${s.source === "manual"
    ? `<button class="danger" onclick="deleteStudentUI('${escapeHtml(s.nfcUid)}')">Delete</button>`
    : `<button class="ghost" disabled title="Managed by import">Imported</button>`}
        </div>
      </div>
    `)
    .join("");

  document.getElementById("lists").innerHTML = `
    <h3>Idle campaigns</h3><div class="list">${idleItems || "<i>None</i>"}</div>
    <h3>Visitor campaigns</h3><div class="list">${visitorItems || "<i>None</i>"}</div>
    <h3>Students</h3><div class="list">${students || "<i>None</i>"}</div>
  `;
}

function populateActiveSelectors() {
  fillSelect(
    document.getElementById("activeIdle"),
    (state.idleCampaigns || []).map((c) => ({ value: c.campaignId, label: `${c.campaignName} (${c.campaignId})` })),
    state.active?.idleCampaignId,
  );

  fillSelect(
    document.getElementById("activeVisitor"),
    (state.visitorCampaigns || []).map((c) => ({ value: c.campaignId, label: `${c.campaignName} (${c.campaignId})` })),
    state.active?.visitorCampaignId,
  );
}

function fillInitialData() {
  renderBuilderTypeOptions();

  if (!builder.blocks.length) {
    builder.blocks = [defaultBlock(1)];
  }

  renderSidebar();
  renderBlocks();
  renderInspector();
  updateCampaignHeader();
  updateSaveButtons();
}

async function refresh() {
  const data = await api("/api/state");
  state = data.state;
  fillInitialData();
  setStatus("Loaded", true);
}

async function publishCampaign() {
  try {
    await saveBuilderCampaign();
    const currentType = builder.type;
    const currentId = builder.campaignId || resolveCampaignIdFromState(currentType, builder.campaignName);

    if (!currentId) {
      setStatus("Publish failed: save campaign first", false);
      return;
    }

    if (currentType === "idle" || currentType === "visitor") {
      await api("/api/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idleCampaignId: currentType === "idle" ? currentId : state.active?.idleCampaignId,
          visitorCampaignId: currentType === "visitor" ? currentId : state.active?.visitorCampaignId,
        }),
      });
      await refresh();
      setStatus(`${currentType} campaign published and set active`, true);
      return;
    }

    if (currentType === "menu") {
      await refresh();
      setStatus("Menu campaign published", true);
      return;
    }

    // Student campaigns are selected by UID; publish means save was successful.
    setStatus("Student campaign published (saved)", true);
  } catch (e) {
    setStatus("Publish failed", false, e.issues || []);
  }
}

async function saveBuilderCampaign() {
  builderIssues = validateBuilder();
  if (builderIssues.length > 0) {
    setStatus("Fix validation errors first", false);
    renderInspector();
    return;
  }

  try {
    if (builder.type === "menu") {
      await api("/api/menu-campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignName: builder.campaignName.trim(),
          items: builder.blocks.map(normalizeBlock),
        }),
      });
      builder.campaignId = "menu-default";
    } else if (builder.type === "student") {
      await api("/api/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nfcUid: builder.studentUid.trim(),
          name: builder.campaignName.trim(),
          items: builder.blocks.map(normalizeBlock),
        }),
      });
      builder.campaignId = `student-${builder.studentUid.trim()}`;
    } else {
      const isExisting = Boolean(builder.campaignId);
      await api(isExisting ? `/api/campaigns/${encodeURIComponent(builder.campaignId)}` : "/api/campaigns", {
        method: isExisting ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: builder.type,
          campaignName: builder.campaignName.trim(),
          items: builder.blocks.map(normalizeBlock),
        }),
      });
      if (!isExisting) {
        await refresh();
        builder.campaignId = resolveCampaignIdFromState(builder.type, builder.campaignName.trim());
      }
    }

    await refresh();
    setStatus("Campaign saved", true);
    return true;
  } catch (e) {
    builderIssues = e.issues || [];
    setStatus("Campaign save failed", false, e.issues || []);
    throw e;
  }
}

async function deleteCampaignUI(campaignId) {
  if (!confirm(`Delete campaign ${campaignId}?`)) return;
  try {
    await api(`/api/campaigns/${encodeURIComponent(campaignId)}`, { method: "DELETE" });
    await refresh();
    setStatus("Campaign deleted", true);
  } catch (e) {
    setStatus("Delete failed", false, e.issues);
  }
}

async function deleteStudentUI(uid) {
  if (!confirm(`Delete student ${uid}?`)) return;
  try {
    await api(`/api/students/${encodeURIComponent(uid)}`, { method: "DELETE" });
    await refresh();
    setStatus("Student deleted", true);
  } catch (e) {
    setStatus("Delete failed", false, e.issues);
  }
}

async function deleteCurrentCampaign() {
  if (!builder.campaignId) {
    setStatus("No saved campaign selected to delete", false);
    return;
  }

  if (builder.type === "menu") {
    setStatus("Menu campaign cannot be deleted from here", false);
    return;
  }

  if (builder.type === "student") {
    const uid = String(builder.studentUid || "").trim();
    if (!uid) {
      setStatus("Student UID missing for delete", false);
      return;
    }
    await deleteStudentUI(uid);
    createNewCampaign();
    return;
  }

  await deleteCampaignUI(builder.campaignId);
  createNewCampaign();
}

function addBlock() {
  builder.blocks.push(makeBlockByType("TEXT", builder.blocks.length + 1));
  syncFormFromBuilder();
}

function addBlockOfType(type) {
  builder.blocks.push(makeBlockByType(type, builder.blocks.length + 1));
  syncFormFromBuilder();
}

function addMenuBlock() {
  menuBlocks.push(makeBlockByType("TEXT", menuBlocks.length + 1));
  renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
  updateSaveButtons();
}

function removeBlock(containerId, idx) {
  const target = containerId === "menuBlocks" ? menuBlocks : builder.blocks;
  if (target.length <= 1) return;
  target.splice(idx, 1);
  if (containerId !== "menuBlocks") {
    normalizeBlockOrder(target);
    if (selectedBlockIndex !== null) {
      selectedBlockIndex = Math.min(selectedBlockIndex, target.length - 1);
    }
  }

  if (containerId === "menuBlocks") {
    renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
  } else {
    renderBlocks();
    renderInspector();
  }
  updateSaveButtons();
}

function moveBlock(containerId, idx, dir) {
  const target = containerId === "menuBlocks" ? menuBlocks : builder.blocks;
  const next = idx + dir;
  if (next < 0 || next >= target.length) return;
  const tmp = target[idx];
  target[idx] = target[next];
  target[next] = tmp;
  normalizeBlockOrder(target);

  if (containerId === "menuBlocks") {
    renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
  } else {
    renderBlocks();
    renderInspector();
  }
  updateSaveButtons();
}

function updateBlockField(containerId, idx, field, value) {
  const target = containerId === "menuBlocks" ? menuBlocks : builder.blocks;
  if (!target[idx]) return;

  if (field === "order" || field === "durationSec") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      if (field === "order") {
        setStatus("Invalid block order", false, [{ path: `items[${idx}].order`, message: "Order must be a number >= 1" }]);
      } else {
        setStatus("Invalid duration", false, [{ path: `items[${idx}].durationSec`, message: "Duration must be a number >= 1" }]);
      }
      return;
    }
    target[idx][field] = parsed;
  } else {
    target[idx][field] = value;
  }

  if (field === "type") {
    // Full reset on type change as requested: new contentId/data/default duration.
    const currentOrder = Number(target[idx].order) || idx + 1;
    target[idx] = makeBlockByType(value, currentOrder);
  }

  if (field === "order") {
    if (!Number.isInteger(target[idx].order) || target[idx].order < 1) {
      setStatus("Invalid block order", false, [{ path: `items[${idx}].order`, message: "Order must be an integer >= 1" }]);
      return;
    }
    const selectedContentId = target[idx].contentId;
    target.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    normalizeBlockOrder(target);
    if (containerId !== "menuBlocks" && selectedContentId) {
      selectedBlockIndex = target.findIndex((b) => b.contentId === selectedContentId);
    }
  }

  if (containerId === "menuBlocks") {
    if (field === "type") {
      renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
    } else if (field === "order") {
      renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
    }
  } else if (field === "type") {
    renderBlocks();
    renderInspector();
  } else if (field === "order") {
    renderBlocks();
    renderInspector();
  } else {
    renderBlocks();
  }

  updateSaveButtons();
}

async function uploadForBlock(containerId, idx) {
  const input = document.getElementById(`${containerId}-file-${idx}`) || document.getElementById("blockFileUpload");
  const target = containerId === "menuBlocks" ? menuBlocks : builder.blocks;
  const block = target[idx];

  if (!block) return;

  // URL-only flow: no file selected but a media URL is already provided.
  if (!input || !input.files || input.files.length === 0) {
    if ((block.type === "IMAGE" || block.type === "VIDEO") && String(block.data || "").trim()) {
      setStatus("Using pasted media URL (no file upload needed)", true);
      updateSaveButtons();
      return;
    }
    setStatus("Select a file or paste a media URL", false);
    return;
  }

  const file = input.files[0];
  if (file.size > 20 * 1024 * 1024) {
    setStatus("File too large (max 20MB)", false);
    return;
  }

  const allowed = block.type === "IMAGE" ? file.type.startsWith("image/") : file.type.startsWith("video/");
  if (!allowed) {
    setStatus(`Selected file is not a ${block.type.toLowerCase()} file`, false);
    return;
  }

  try {
    const form = new FormData();
    form.append("file", file);
    const result = await api("/api/media/upload", {
      method: "POST",
      body: form,
    });

    block.data = result.url;

    if (containerId === "menuBlocks") {
      renderBlockEditor("menuBlocks", menuBlocks, menuIssues, { isMenu: true });
    } else {
      syncFormFromBuilder();
      renderInspector();
    }

    updateSaveButtons();
    setStatus(`Uploaded ${result.filename}`, true);
  } catch (e) {
    setStatus("Upload failed", false, e.issues);
  }
}

function loadDuplicateSource() {
  if (builder.mode !== "duplicate") {
    setStatus("Switch to duplicate mode to load a source campaign", false);
    return;
  }

  if (!builder.sourceId) {
    setStatus("No source campaign selected", false);
    return;
  }

  if (builder.type === "student") {
    const student = findStudentCampaignByUid(builder.sourceId);
    if (!student) {
      setStatus("Selected student source not found", false);
      return;
    }
    setBuilderFromCampaign(student.campaign, "student", student.nfcUid);
    builder.campaignId = null;
    builder.studentUid = "";
    builder.campaignName = `${student.name} Copy`;
  } else {
    const campaign = getCampaignsByType(builder.type).find((c) => c.campaignId === builder.sourceId);
    if (!campaign) {
      setStatus("Selected campaign source not found", false);
      return;
    }
    setBuilderFromCampaign(campaign, builder.type);
    builder.campaignId = null;
    builder.campaignName = `${campaign.campaignName} Copy`;
  }

  syncFormFromBuilder();
  setStatus("Duplicate source loaded", true);
}

function loadExistingCampaign(type, campaignId) {
  const campaign = getCampaignsByType(type).find((c) => c.campaignId === campaignId);
  if (!campaign) return;

  builder.mode = "duplicate";
  builder.sourceId = campaignId;
  setBuilderFromCampaign(campaign, type);
  syncFormFromBuilder();
}

function loadExistingStudent(uid) {
  const student = findStudentCampaignByUid(uid);
  if (!student) return;

  builder.mode = "duplicate";
  builder.sourceId = uid;
  setBuilderFromCampaign(student.campaign, "student", student.nfcUid);
  syncFormFromBuilder();
}

function bindEvents() {
  const typeEl = document.getElementById("builderType");
  if (typeEl) {
    typeEl.addEventListener("change", (e) => {
      resetBuilderForType(e.target.value);
      renderInspector();
      renderSidebar();
    });
  }

  const modeEl = document.getElementById("builderMode");
  if (modeEl) {
    modeEl.addEventListener("change", (e) => {
      builder.mode = e.target.value;
      renderDuplicateOptions();
      updateSaveButtons();
    });
  }

  const duplicateEl = document.getElementById("duplicateSource");
  if (duplicateEl) {
    duplicateEl.addEventListener("change", (e) => {
      builder.sourceId = e.target.value;
      loadDuplicateSource();
    });
  }

  const campaignNameHeaderEl = document.getElementById("campaignNameInput");
  if (campaignNameHeaderEl) {
    campaignNameHeaderEl.addEventListener("input", (e) => {
      updateCampaignName(e.target.value);
      updateSaveButtons();
    });
  }

  const legacyCampaignNameEl = document.getElementById("campaignName");
  if (legacyCampaignNameEl) {
    legacyCampaignNameEl.addEventListener("input", (e) => {
      builder.campaignName = e.target.value;
      updateSaveButtons();
    });
  }

  const studentUidEl = document.getElementById("studentUid");
  if (studentUidEl) {
    studentUidEl.addEventListener("input", (e) => {
      builder.studentUid = e.target.value;
      updateSaveButtons();
    });
  }

  const menuNameEl = document.getElementById("menuName");
  if (menuNameEl) {
    menuNameEl.addEventListener("input", () => {
      updateSaveButtons();
    });
  }

  const searchEl = document.getElementById("sidebarSearch");
  if (searchEl) {
    searchEl.addEventListener("input", (e) => {
      sidebarQuery = String(e.target.value || "");
      renderSidebar();
    });
  }

  const typeFilterEl = document.getElementById("overviewTypeFilter");
  if (typeFilterEl) {
    typeFilterEl.addEventListener("change", (e) => {
      overviewTypeFilter = String(e.target.value || "all");
      renderSidebar();
    });
  }

  const statusFilterEl = document.getElementById("overviewStatusFilter");
  if (statusFilterEl) {
    statusFilterEl.addEventListener("change", (e) => {
      overviewStatusFilter = String(e.target.value || "all");
      renderSidebar();
    });
  }
}

window.saveBuilderCampaign = saveBuilderCampaign;
window.publishCampaign = publishCampaign;
window.deleteCampaignUI = deleteCampaignUI;
window.deleteStudentUI = deleteStudentUI;
window.deleteCurrentCampaign = deleteCurrentCampaign;
window.addBlock = addBlock;
window.addBlockOfType = addBlockOfType;
window.addMenuBlock = addMenuBlock;
window.removeBlock = removeBlock;
window.moveBlock = moveBlock;
window.updateBlockField = updateBlockField;
window.uploadForBlock = uploadForBlock;
window.loadDuplicateSource = loadDuplicateSource;
window.loadExistingCampaign = loadExistingCampaign;
window.loadExistingStudent = loadExistingStudent;
window.createNewCampaign = createNewCampaign;
window.loadCampaignToEditor = loadCampaignToEditor;
window.duplicateCampaignFromOverview = duplicateCampaignFromOverview;
window.deployCampaignFromOverview = deployCampaignFromOverview;
window.selectBlock = selectBlock;
window.duplicateBlock = duplicateBlock;
window.showBlockMenu = showBlockMenu;
window.showAddBlockMenu = showAddBlockMenu;
window.updateCampaignName = updateCampaignName;
window.changeCampaignType = changeCampaignType;
window.applyActiveSelections = applyActiveSelections;
window.updateStudentUidFromInspector = updateStudentUidFromInspector;

bindEvents();
resetBuilderForType("idle");
refresh().catch((e) => setStatus(e.message || "Failed to load", false, e.issues || []));
