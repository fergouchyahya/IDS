/**
 * Admin file-backed repository and storage utilities.
 *
 * Responsibilities:
 * - FileRepository: async persistence to disk via JSON file.
 * - Shared storage utility primitives (ValidationError, id generation, etc).
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { randomUUID } = require("crypto");
const { createLogger } = require("../../../shared/utils/logger");
const { getConfig } = require("../../../shared/config");
const { AdminRepository } = require("./admin-repository");

const logger = createLogger("ids-admin-storage-repository");

const WRITE_BATCH_WINDOW_MS = 100;

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
 * File-backed admin repository implementation.
 *
 * Stores state as a JSON file with batched async writes.
 * Reads are served from an in-memory cache for speed.
 */
class FileRepository extends AdminRepository {
  /**
   * Creates a new FileRepository.
   *
   * @param {object} [options={}] - Repository options.
   * @param {string} [options.dataDir] - Data directory override.
   */
  constructor(options = {}) {
    super();
    const config = getConfig();
    const configuredDataDir = options.dataDir || config.getAdmin().dataDir;
    this.dataDir = configuredDataDir
      ? path.resolve(configuredDataDir)
      : path.resolve(__dirname, "../../data");
    this.dataFile = path.join(this.dataDir, "state.json");

    this.stateCache = null;
    this.queuedState = null;
    this.pendingWriteTimer = null;
    this.writeInFlight = Promise.resolve();
    this.hasWriteInFlight = false;
    this.lastPersistedAt = null;
    this.lastPersistError = null;
  }

  /**
   * Ensures state cache is loaded from disk or defaults.
   */
  ensureStateLoaded() {
    if (this.stateCache) return;

    fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.dataFile)) {
      const initial = defaultState();
      fs.writeFileSync(this.dataFile, JSON.stringify(initial, null, 2), "utf8");
      this.stateCache = initial;
      this.lastPersistedAt = nowIso();
      return;
    }

    const raw = fs.readFileSync(this.dataFile, "utf8");
    const parsed = JSON.parse(raw || "{}");

    this.stateCache = Array.isArray(parsed.campaigns) && !Array.isArray(parsed.idleCampaigns)
      ? defaultState()
      : parsed;

    if (!Array.isArray(this.stateCache.students)) {
      this.stateCache.students = [];
    }
    if (!Array.isArray(this.stateCache.studentProfiles)) {
      this.stateCache.studentProfiles = [];
    }
  }

  /**
   * Persists queued state snapshot to disk.
   */
  persistQueuedState() {
    if (!this.queuedState) return;

    const snapshot = this.queuedState;
    this.queuedState = null;

    this.writeInFlight = this.writeInFlight
      .then(async () => {
        this.hasWriteInFlight = true;
        await fsp.writeFile(this.dataFile, JSON.stringify(snapshot, null, 2), "utf8");
        this.lastPersistedAt = nowIso();
        this.lastPersistError = null;
      })
      .catch((err) => {
        this.lastPersistError = String(err?.message || err);
        logger.error("state_persist_failed", { error: this.lastPersistError });
      })
      .finally(() => {
        this.hasWriteInFlight = false;
        if (this.queuedState) {
          this.schedulePersist();
        }
      });
  }

  /**
   * Schedules next batched write.
   */
  schedulePersist() {
    if (this.pendingWriteTimer) return;

    this.pendingWriteTimer = setTimeout(() => {
      this.pendingWriteTimer = null;
      this.persistQueuedState();
    }, WRITE_BATCH_WINDOW_MS);

    if (typeof this.pendingWriteTimer.unref === "function") {
      this.pendingWriteTimer.unref();
    }
  }

  /**
   * Reads current cached state synchronously.
   *
   * @returns {object} Current state.
   */
  readStateSync() {
    this.ensureStateLoaded();
    return this.stateCache;
  }

  /**
   * Reads current cached state.
   *
   * @returns {Promise<object>} Current state.
   */
  async readState() {
    this.ensureStateLoaded();
    return this.stateCache;
  }

  /**
   * Writes state and updates updatedAt.
   *
   * @param {object} state - New state.
   * @returns {Promise<object>} Persisted state snapshot.
   */
  async writeState(state) {
    const next = {
      ...state,
      updatedAt: nowIso(),
    };

    this.stateCache = next;
    this.queuedState = next;
    this.schedulePersist();
    return next;
  }

  /**
   * Returns storage health diagnostics.
   *
   * @returns {Promise<object>} Storage health payload.
   */
  async getHealth() {
    this.ensureStateLoaded();

    let fileSizeBytes = 0;
    try {
      fileSizeBytes = fs.statSync(this.dataFile).size;
    } catch {
      fileSizeBytes = 0;
    }

    return {
      dataDir: this.dataDir,
      dataFile: this.dataFile,
      fileSizeBytes,
      writeBatchWindowMs: WRITE_BATCH_WINDOW_MS,
      writePending: Boolean(this.queuedState || this.pendingWriteTimer),
      writeInFlight: this.hasWriteInFlight,
      lastPersistedAt: this.lastPersistedAt,
      lastPersistError: this.lastPersistError,
    };
  }
}

module.exports = {
  ValidationError,
  FileRepository,
  nowIso,
  makeId,
  issue,
  throwIfIssues,
};
