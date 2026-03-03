/**
 * Admin storage repository.
 *
 * Responsibilities:
 * - Load and persist state to disk.
 * - Provide state defaults and health info.
 * - Expose shared storage utility primitives.
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { randomUUID } = require("crypto");
const { createLogger } = require("../../../shared/utils/logger");
const { getConfig } = require("../../../shared/config");

const logger = createLogger("ids-admin-storage-repository");

const config = getConfig();
const configuredDataDir = config.getAdmin().dataDir;
const DATA_DIR = configuredDataDir
  ? path.resolve(configuredDataDir)
  : path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "state.json");
const WRITE_BATCH_WINDOW_MS = 100;

let stateCache = null;
let queuedState = null;
let pendingWriteTimer = null;
let writeInFlight = Promise.resolve();
let hasWriteInFlight = false;
let lastPersistedAt = null;
let lastPersistError = null;

/**
 * Validation error type used by admin storage operations.
 */
class ValidationError extends Error {
  /**
   * Creates validation error.
   *
   * @param {Array<object>} issues - Validation issues.
   * @param {string} [message='validation_failed'] - Error message.
   */
  constructor(issues, message = "validation_failed") {
    super(message);
    this.name = "ValidationError";
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

/**
 * Returns current timestamp as ISO string.
 *
 * @returns {string} Current ISO time.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Generates id with prefix.
 *
 * @param {string} prefix - ID prefix.
 * @returns {string} Generated ID.
 */
function makeId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

/**
 * Creates a validation issue object.
 *
 * @param {string} pathLabel - Field path.
 * @param {string} message - Issue message.
 * @param {string} code - Issue code.
 * @returns {object} Issue object.
 */
function issue(pathLabel, message, code) {
  return {
    path: pathLabel,
    message,
    code,
  };
}

/**
 * Throws validation error when issues array is not empty.
 *
 * @param {Array<object>} issues - Issues list.
 */
function throwIfIssues(issues) {
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}

/**
 * Builds default menu campaign.
 *
 * @returns {object} Default menu campaign.
 */
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

/**
 * Builds full default storage state.
 *
 * @returns {object} Default state object.
 */
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
    studentProfiles: [],
    updatedAt: nowIso(),
  };
}

/**
 * Ensures state cache is loaded from disk or defaults.
 */
function ensureStateLoaded() {
  if (stateCache) return;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = defaultState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
    stateCache = initial;
    lastPersistedAt = nowIso();
    return;
  }

  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");

  stateCache = Array.isArray(parsed.campaigns) && !Array.isArray(parsed.idleCampaigns)
    ? defaultState()
    : parsed;

  if (!Array.isArray(stateCache.students)) {
    stateCache.students = [];
  }
  if (!Array.isArray(stateCache.studentProfiles)) {
    stateCache.studentProfiles = [];
  }
}

/**
 * Persists queued state snapshot to disk.
 */
function persistQueuedState() {
  if (!queuedState) return;

  const snapshot = queuedState;
  queuedState = null;

  writeInFlight = writeInFlight
    .then(async () => {
      hasWriteInFlight = true;
      await fsp.writeFile(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
      lastPersistedAt = nowIso();
      lastPersistError = null;
    })
    .catch((err) => {
      lastPersistError = String(err?.message || err);
      logger.error("state_persist_failed", { error: lastPersistError });
    })
    .finally(() => {
      hasWriteInFlight = false;
      if (queuedState) {
        schedulePersist();
      }
    });
}

/**
 * Schedules next batched write.
 */
function schedulePersist() {
  if (pendingWriteTimer) return;

  pendingWriteTimer = setTimeout(() => {
    pendingWriteTimer = null;
    persistQueuedState();
  }, WRITE_BATCH_WINDOW_MS);

  if (typeof pendingWriteTimer.unref === "function") {
    pendingWriteTimer.unref();
  }
}

/**
 * Queues state write operation.
 *
 * @param {object} nextState - Next state snapshot.
 */
function queueStateWrite(nextState) {
  queuedState = nextState;
  schedulePersist();
}

/**
 * Reads current cached state.
 *
 * @returns {object} Current state.
 */
function readState() {
  ensureStateLoaded();
  return stateCache;
}

/**
 * Writes state and updates updatedAt.
 *
 * @param {object} state - New state.
 * @returns {object} Persisted state snapshot.
 */
function writeState(state) {
  const next = {
    ...state,
    updatedAt: nowIso(),
  };

  stateCache = next;
  queueStateWrite(next);
  return next;
}

/**
 * Returns storage health diagnostics.
 *
 * @returns {object} Storage health payload.
 */
function getStorageHealth() {
  ensureStateLoaded();

  let fileSizeBytes = 0;
  try {
    fileSizeBytes = fs.statSync(DATA_FILE).size;
  } catch {
    fileSizeBytes = 0;
  }

  return {
    dataDir: DATA_DIR,
    dataFile: DATA_FILE,
    fileSizeBytes,
    writeBatchWindowMs: WRITE_BATCH_WINDOW_MS,
    writePending: Boolean(queuedState || pendingWriteTimer),
    writeInFlight: hasWriteInFlight,
    lastPersistedAt,
    lastPersistError,
  };
}

module.exports = {
  ValidationError,
  DATA_DIR,
  DATA_FILE,
  nowIso,
  makeId,
  issue,
  throwIfIssues,
  readState,
  writeState,
  getStorageHealth,
};
