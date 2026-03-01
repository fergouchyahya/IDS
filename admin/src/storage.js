/**
 * IDS Admin — JSON state storage.
 *
 * Lightweight by design for Raspberry Pi demo use.
 * This can be swapped later with SQLite without changing API contracts.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.IDS_ADMIN_DATA_DIR
  ? path.resolve(process.env.IDS_ADMIN_DATA_DIR)
  : path.resolve(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

const ALLOWED_ITEM_TYPES = new Set(["TEXT", "IMAGE", "VIDEO"]);

class ValidationError extends Error {
  constructor(issues, message = "validation_failed") {
    super(message);
    this.name = "ValidationError";
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function issue(pathLabel, message, code) {
  return {
    path: pathLabel,
    message,
    code,
  };
}

function throwIfIssues(issues) {
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
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
    return defaultState();
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

function validateCampaignKind(kind) {
  return kind === "idle" || kind === "visitor";
}

function getCampaignListByKind(state, kind) {
  return kind === "idle" ? state.idleCampaigns : state.visitorCampaigns;
}

function normalizeAndValidateItems(items, pathPrefix = "items") {
  const issues = [];
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError([
      issue(pathPrefix, "At least one content block is required", "required"),
    ]);
  }

  const seenContentIds = new Set();
  const normalized = items.map((item, idx) => {
    const currentPath = `${pathPrefix}[${idx}]`;
    const contentIdRaw = String(item?.contentId || "").trim();
    const typeRaw = String(item?.type || "").trim().toUpperCase();
    const dataRaw = typeof item?.data === "string" ? item.data.trim() : "";
    const orderRaw = Number(item?.order);
    const durationRaw = Number(item?.durationSec);

    if (!contentIdRaw) {
      issues.push(issue(`${currentPath}.contentId`, "contentId is required", "required"));
    } else if (seenContentIds.has(contentIdRaw)) {
      issues.push(issue(`${currentPath}.contentId`, "contentId must be unique in a campaign", "duplicate"));
    }

    if (contentIdRaw) {
      seenContentIds.add(contentIdRaw);
    }

    if (!ALLOWED_ITEM_TYPES.has(typeRaw)) {
      issues.push(issue(`${currentPath}.type`, "type must be one of TEXT, IMAGE, VIDEO", "invalid_enum"));
    }

    if (!Number.isInteger(orderRaw) || orderRaw < 1) {
      issues.push(issue(`${currentPath}.order`, "order must be an integer >= 1", "invalid_number"));
    }

    if (!Number.isInteger(durationRaw) || durationRaw < 1) {
      issues.push(issue(`${currentPath}.durationSec`, "durationSec must be an integer >= 1", "invalid_number"));
    }

    if (typeRaw === "TEXT") {
      if (!dataRaw) {
        issues.push(issue(`${currentPath}.data`, "TEXT block requires non-empty text data", "required"));
      }
    } else if (typeRaw === "IMAGE" || typeRaw === "VIDEO") {
      if (!dataRaw) {
        issues.push(issue(`${currentPath}.data`, `${typeRaw} block requires an uploaded media URL`, "required"));
      }
    }

    return {
      contentId: contentIdRaw || `content-${idx + 1}`,
      type: typeRaw || "TEXT",
      data: dataRaw,
      order: Number.isInteger(orderRaw) ? orderRaw : idx + 1,
      durationSec: Number.isInteger(durationRaw) ? durationRaw : 30,
    };
  });

  throwIfIssues(issues);
  return normalized.sort((a, b) => a.order - b.order);
}

function validateCampaignName(campaignName, pathLabel = "campaignName") {
  const name = String(campaignName || "").trim();
  if (!name) {
    throw new ValidationError([issue(pathLabel, "campaignName is required", "required")]);
  }
  return name;
}

function createCampaign({ kind, campaignName, items }) {
  const state = readState();

  if (!validateCampaignKind(kind)) {
    throw new ValidationError([issue("kind", "kind must be idle or visitor", "invalid_enum")]);
  }

  const campaign = {
    campaignId: makeId(kind),
    campaignName: validateCampaignName(campaignName),
    kind,
    updatedAt: nowIso(),
    items: normalizeAndValidateItems(items, "items"),
  };

  const list = getCampaignListByKind(state, kind);
  list.push(campaign);

  return writeState(state);
}

function updateCampaign(campaignId, patch) {
  const state = readState();
  const campaignIdTrimmed = String(campaignId || "").trim();

  if (!campaignIdTrimmed) {
    throw new ValidationError([issue("campaignId", "campaignId is required", "required")]);
  }

  for (const list of [state.idleCampaigns, state.visitorCampaigns]) {
    const idx = list.findIndex((c) => c.campaignId === campaignIdTrimmed);
    if (idx >= 0) {
      const current = list[idx];
      const next = {
        ...current,
        campaignName:
          patch && Object.prototype.hasOwnProperty.call(patch, "campaignName")
            ? validateCampaignName(patch.campaignName)
            : current.campaignName,
        items:
          patch && Object.prototype.hasOwnProperty.call(patch, "items")
            ? normalizeAndValidateItems(patch.items, "items")
            : current.items,
        updatedAt: nowIso(),
      };
      list[idx] = next;
      return writeState(state);
    }
  }

  throw new ValidationError([issue("campaignId", "Campaign not found", "not_found")]);
}

function deleteCampaign(campaignId) {
  const state = readState();
  const id = String(campaignId || "").trim();
  if (!id) {
    throw new ValidationError([issue("campaignId", "campaignId is required", "required")]);
  }

  const removeFrom = (list) => {
    const before = list.length;
    const afterList = list.filter((c) => c.campaignId !== id);
    return { changed: afterList.length !== before, list: afterList };
  };

  const idle = removeFrom(state.idleCampaigns);
  const visitor = removeFrom(state.visitorCampaigns);
  state.idleCampaigns = idle.list;
  state.visitorCampaigns = visitor.list;

  if (!idle.changed && !visitor.changed) {
    throw new ValidationError([issue("campaignId", "Campaign not found", "not_found")]);
  }

  if (state.active.idleCampaignId === id) {
    state.active.idleCampaignId = state.idleCampaigns[0]?.campaignId || null;
  }

  if (state.active.visitorCampaignId === id) {
    state.active.visitorCampaignId = state.visitorCampaigns[0]?.campaignId || null;
  }

  return writeState(state);
}

function setActiveCampaigns({ idleCampaignId, visitorCampaignId }) {
  const state = readState();
  const issues = [];

  if (idleCampaignId) {
    const exists = state.idleCampaigns.some((c) => c.campaignId === idleCampaignId);
    if (!exists) {
      issues.push(issue("idleCampaignId", "Idle campaign not found", "not_found"));
    }
  }

  if (visitorCampaignId) {
    const exists = state.visitorCampaigns.some((c) => c.campaignId === visitorCampaignId);
    if (!exists) {
      issues.push(issue("visitorCampaignId", "Visitor campaign not found", "not_found"));
    }
  }

  throwIfIssues(issues);

  if (idleCampaignId) state.active.idleCampaignId = idleCampaignId;
  if (visitorCampaignId) state.active.visitorCampaignId = visitorCampaignId;

  return writeState(state);
}

function setSettings(patch) {
  const timeout = Number(patch?.inactivityTimeoutMs);
  if (!Number.isInteger(timeout) || timeout < 100) {
    throw new ValidationError([
      issue("inactivityTimeoutMs", "inactivityTimeoutMs must be an integer >= 100", "invalid_number"),
    ]);
  }

  const state = readState();
  state.settings.inactivityTimeoutMs = timeout;
  return writeState(state);
}

function normalizeStudentPayload({ nfcUid, name, items }) {
  const uid = String(nfcUid || "").trim();
  const studentName = String(name || "").trim();
  const issues = [];

  if (!uid) {
    issues.push(issue("nfcUid", "nfcUid is required", "required"));
  }

  if (!studentName) {
    issues.push(issue("name", "Student name is required", "required"));
  }

  if (issues.length > 0) {
    throw new ValidationError(issues);
  }

  return {
    nfcUid: uid,
    name: studentName,
    items: normalizeAndValidateItems(items, "items"),
  };
}

function upsertStudent(payload) {
  const state = readState();
  const normalized = normalizeStudentPayload(payload || {});

  const idx = state.students.findIndex((s) => s.nfcUid === normalized.nfcUid);
  const campaign = {
    campaignId: `student-${normalized.nfcUid}`,
    campaignName: `${normalized.name} Info`,
    kind: "student",
    updatedAt: nowIso(),
    items: normalized.items,
  };

  const student = {
    nfcUid: normalized.nfcUid,
    name: normalized.name,
    campaign,
  };

  if (idx >= 0) state.students[idx] = student;
  else state.students.push(student);

  return writeState(state);
}

function deleteStudent(nfcUid) {
  const state = readState();
  const uid = String(nfcUid || "").trim();
  if (!uid) {
    throw new ValidationError([issue("nfcUid", "nfcUid is required", "required")]);
  }

  const before = state.students.length;
  state.students = state.students.filter((s) => s.nfcUid !== uid);
  if (state.students.length === before) {
    throw new ValidationError([issue("nfcUid", "Student not found", "not_found")]);
  }

  return writeState(state);
}

function setMenuCampaign({ campaignName, items }) {
  const state = readState();

  state.menuCampaign = {
    campaignId: "menu-default",
    campaignName: validateCampaignName(campaignName),
    kind: "menu",
    updatedAt: nowIso(),
    items: normalizeAndValidateItems(items, "items"),
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
  ValidationError,
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
  normalizeAndValidateItems,
};
