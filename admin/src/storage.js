/**
 * IDS Admin — JSON state storage.
 *
 * Lightweight by design for Raspberry Pi demo use.
 * This can be swapped later with SQLite without changing API contracts.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultMenuCampaign() {
  return {
    campaignId: "menu-default",
    campaignName: "Menu",
    kind: "menu",
    updatedAt: nowIso(),
    items: [
      {
        contentId: "menu-1",
        type: "TEXT",
        data: "Are you Student or Visitor?",
        order: 1,
        durationSec: 60,
      },
    ],
  };
}

function defaultState() {
  const idleCampaignId = "idle-default";
  const visitorCampaignId = "visitor-default";

  return {
    settings: {
      inactivityTimeoutMs: 10000,
    },
    active: {
      idleCampaignId,
      visitorCampaignId,
    },
    menuCampaign: defaultMenuCampaign(),
    idleCampaigns: [
      {
        campaignId: idleCampaignId,
        campaignName: "Default Idle",
        kind: "idle",
        updatedAt: nowIso(),
        items: [
          {
            contentId: "idle-1",
            type: "TEXT",
            data: "Welcome to the school",
            order: 1,
            durationSec: 120,
          },
          {
            contentId: "idle-2",
            type: "TEXT",
            data: "General school information",
            order: 2,
            durationSec: 120,
          },
        ],
      },
    ],
    visitorCampaigns: [
      {
        campaignId: visitorCampaignId,
        campaignName: "Default Visitor",
        kind: "visitor",
        updatedAt: nowIso(),
        items: [
          {
            contentId: "visitor-1",
            type: "TEXT",
            data: "Visitor information page 1",
            order: 1,
            durationSec: 45,
          },
          {
            contentId: "visitor-2",
            type: "TEXT",
            data: "Visitor information page 2",
            order: 2,
            durationSec: 45,
          },
        ],
      },
    ],
    students: [
      {
        nfcUid: "demo-uid-001",
        name: "Demo Student",
        campaign: {
          campaignId: "student-demo-001",
          campaignName: "Demo Student Info",
          kind: "student",
          updatedAt: nowIso(),
          items: [
            {
              contentId: "student-1",
              type: "TEXT",
              data: "Hi Demo Student\\nTimetable: Math at 09:00",
              order: 1,
              durationSec: 30,
            },
            {
              contentId: "student-2",
              type: "TEXT",
              data: "Room: A204\\nNext class: Physics",
              order: 2,
              durationSec: 30,
            },
          ],
        },
      },
    ],
    updatedAt: nowIso(),
  };
}

function ensureStateFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState(), null, 2), "utf8");
  }
}

function readState() {
  ensureStateFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");

  // Best-effort migration from legacy storage.
  if (Array.isArray(parsed.campaigns) && !Array.isArray(parsed.idleCampaigns)) {
    const migrated = defaultState();
    return migrated;
  }

  return parsed;
}

function writeState(state) {
  const next = {
    ...state,
    updatedAt: nowIso(),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function normalizeItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((item, idx) => ({
      contentId: typeof item.contentId === "string" && item.contentId.trim() ? item.contentId.trim() : `content-${idx + 1}`,
      type: typeof item.type === "string" && item.type.trim() ? item.type.trim().toUpperCase() : "TEXT",
      data: typeof item.data === "string" ? item.data : "",
      order: Number.isInteger(item.order) ? item.order : idx + 1,
      durationSec: Number.isInteger(item.durationSec) && item.durationSec > 0 ? item.durationSec : 30,
    }))
    .sort((a, b) => a.order - b.order);
}

function validateCampaignKind(kind) {
  return kind === "idle" || kind === "visitor";
}

function getCampaignListByKind(state, kind) {
  return kind === "idle" ? state.idleCampaigns : state.visitorCampaigns;
}

function createCampaign({ kind, campaignName, items }) {
  const state = readState();
  if (!validateCampaignKind(kind)) throw new Error("Invalid campaign kind");

  const campaign = {
    campaignId: makeId(kind),
    campaignName: String(campaignName || "Untitled campaign"),
    kind,
    updatedAt: nowIso(),
    items: normalizeItems(items),
  };

  const list = getCampaignListByKind(state, kind);
  list.push(campaign);

  return writeState(state);
}

function updateCampaign(campaignId, patch) {
  const state = readState();

  for (const list of [state.idleCampaigns, state.visitorCampaigns]) {
    const idx = list.findIndex((c) => c.campaignId === campaignId);
    if (idx >= 0) {
      const current = list[idx];
      const next = {
        ...current,
        campaignName: typeof patch.campaignName === "string" ? patch.campaignName : current.campaignName,
        items: patch.items ? normalizeItems(patch.items) : current.items,
        updatedAt: nowIso(),
      };
      list[idx] = next;
      return writeState(state);
    }
  }

  throw new Error("Campaign not found");
}

function deleteCampaign(campaignId) {
  const state = readState();

  const removeFrom = (list) => {
    const before = list.length;
    const afterList = list.filter((c) => c.campaignId !== campaignId);
    return { changed: afterList.length !== before, list: afterList };
  };

  const idle = removeFrom(state.idleCampaigns);
  const visitor = removeFrom(state.visitorCampaigns);
  state.idleCampaigns = idle.list;
  state.visitorCampaigns = visitor.list;

  if (!idle.changed && !visitor.changed) {
    throw new Error("Campaign not found");
  }

  if (state.active.idleCampaignId === campaignId) {
    state.active.idleCampaignId = state.idleCampaigns[0]?.campaignId || null;
  }

  if (state.active.visitorCampaignId === campaignId) {
    state.active.visitorCampaignId = state.visitorCampaigns[0]?.campaignId || null;
  }

  return writeState(state);
}

function setActiveCampaigns({ idleCampaignId, visitorCampaignId }) {
  const state = readState();

  if (idleCampaignId) {
    const exists = state.idleCampaigns.some((c) => c.campaignId === idleCampaignId);
    if (!exists) throw new Error("Idle campaign not found");
    state.active.idleCampaignId = idleCampaignId;
  }

  if (visitorCampaignId) {
    const exists = state.visitorCampaigns.some((c) => c.campaignId === visitorCampaignId);
    if (!exists) throw new Error("Visitor campaign not found");
    state.active.visitorCampaignId = visitorCampaignId;
  }

  return writeState(state);
}

function setSettings(patch) {
  const state = readState();
  const timeout = Number(patch.inactivityTimeoutMs);
  if (!Number.isInteger(timeout) || timeout < 100) {
    throw new Error("Invalid inactivityTimeoutMs");
  }

  state.settings.inactivityTimeoutMs = timeout;
  return writeState(state);
}

function upsertStudent({ nfcUid, name, items }) {
  const state = readState();
  const uid = String(nfcUid || "").trim();
  if (!uid) throw new Error("nfcUid is required");

  const idx = state.students.findIndex((s) => s.nfcUid === uid);
  const campaign = {
    campaignId: `student-${uid}`,
    campaignName: `${String(name || "Student")} Info`,
    kind: "student",
    updatedAt: nowIso(),
    items: normalizeItems(items),
  };

  const student = {
    nfcUid: uid,
    name: String(name || "Student"),
    campaign,
  };

  if (idx >= 0) state.students[idx] = student;
  else state.students.push(student);

  return writeState(state);
}

function deleteStudent(nfcUid) {
  const state = readState();
  const before = state.students.length;
  state.students = state.students.filter((s) => s.nfcUid !== nfcUid);
  if (state.students.length === before) throw new Error("Student not found");
  return writeState(state);
}

function setMenuCampaign({ campaignName, items }) {
  const state = readState();
  state.menuCampaign = {
    campaignId: "menu-default",
    campaignName: String(campaignName || "Menu"),
    kind: "menu",
    updatedAt: nowIso(),
    items: normalizeItems(items),
  };
  return writeState(state);
}

function toRuntimeConfig(state) {
  const idleCampaign = state.idleCampaigns.find((c) => c.campaignId === state.active.idleCampaignId) || null;
  const visitorCampaign = state.visitorCampaigns.find((c) => c.campaignId === state.active.visitorCampaignId) || null;

  return {
    settings: state.settings,
    active: state.active,
    idleCampaign,
    menuCampaign: state.menuCampaign,
    visitorCampaign,
    students: state.students,
    updatedAt: state.updatedAt,
  };
}

module.exports = {
  readState,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  setActiveCampaigns,
  setSettings,
  upsertStudent,
  deleteStudent,
  setMenuCampaign,
  toRuntimeConfig,
};
