/**
 * IDS Admin storage facade factory.
 *
 * Responsibilities:
 * - Expose stable async storage API used by handlers/services.
 * - Coordinate repository, validators and runtime mapper modules.
 */

const {
  ValidationError,
  nowIso,
  makeId,
  issue,
  throwIfIssues,
} = require("./storage/repository");
const {
  validateCampaignKind,
  getCampaignListByKind,
  normalizeAndValidateItems,
  validateCampaignName,
  normalizeStudentPayload,
  normalizeStudentProfilePayload,
} = require("./storage/validators");
const {
  buildGeneratedStudentCampaign,
  toRuntimeConfig,
} = require("./storage/runtime-mapper");

/**
 * Creates an async storage facade backed by the given repository.
 *
 * @param {import('./storage/admin-repository').AdminRepository} repository - Repository instance.
 * @returns {object} Async storage API.
 */
function createStorage(repository, studentDb) {
  /**
   * Reads current persisted state.
   *
   * @returns {Promise<object>} Current state.
   */
  async function readState() {
    return await repository.readState();
  }

  /**
   * Creates a new idle/visitor campaign.
   *
   * @param {object} payload - Campaign payload.
   * @returns {Promise<object>} Updated state.
   */
  async function createCampaign({ kind, campaignName, items }) {
    const state = await repository.readState();

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

    return await repository.writeState(state);
  }

  /**
   * Updates existing campaign by id.
   *
   * @param {string} campaignId - Campaign id.
   * @param {object} patch - Campaign patch.
   * @returns {Promise<object>} Updated state.
   */
  async function updateCampaign(campaignId, patch) {
    const state = await repository.readState();
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
        return await repository.writeState(state);
      }
    }

    throw new ValidationError([issue("campaignId", "Campaign not found", "not_found")]);
  }

  /**
   * Deletes campaign by id.
   *
   * @param {string} campaignId - Campaign id.
   * @returns {Promise<object>} Updated state.
   */
  async function deleteCampaign(campaignId) {
    const state = await repository.readState();
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

    return await repository.writeState(state);
  }

  /**
   * Sets active campaign ids.
   *
   * @param {object} payload - Active mapping payload.
   * @returns {Promise<object>} Updated state.
   */
  async function setActiveCampaigns({ idleCampaignId, visitorCampaignId }) {
    const state = await repository.readState();
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

    return await repository.writeState(state);
  }

  /**
   * Sets global admin settings.
   *
   * @param {object} patch - Settings patch.
   * @returns {Promise<object>} Updated state.
   */
  async function setSettings(patch) {
    const timeout = Number(patch?.inactivityTimeoutMs);
    if (!Number.isInteger(timeout) || timeout < 100) {
      throw new ValidationError([
        issue("inactivityTimeoutMs", "inactivityTimeoutMs must be an integer >= 100", "invalid_number"),
      ]);
    }

    const state = await repository.readState();
    state.settings.inactivityTimeoutMs = timeout;
    return await repository.writeState(state);
  }

  /**
   * Imports student profile list into SQLite, replacing all existing profiles.
   *
   * @param {object} payload - Student profile import payload.
   * @returns {Promise<object>} State augmented with studentProfiles from DB.
   */
  async function importStudentProfiles(payload) {
    const inputStudents = Array.isArray(payload?.students) ? payload.students : null;
    if (!inputStudents) {
      throw new ValidationError([issue("students", "students must be an array", "invalid_type")]);
    }

    const normalized = [];
    const seen = new Set();
    const issues = [];

    inputStudents.forEach((entry, idx) => {
      const prefix = `students[${idx}]`;
      try {
        const profile = normalizeStudentProfilePayload(entry, prefix);
        if (seen.has(profile.nfcUid)) {
          issues.push(issue(`${prefix}.nfcUid`, "nfcUid must be unique", "duplicate"));
        } else {
          seen.add(profile.nfcUid);
          normalized.push(profile);
        }
      } catch (err) {
        if (err instanceof ValidationError) {
          issues.push(...err.issues);
        } else {
          issues.push(issue(prefix, err?.message || "invalid_profile", "invalid_profile"));
        }
      }
    });

    throwIfIssues(issues);
    studentDb.importProfiles(normalized);

    const state = await repository.readState();
    return { ...state, studentProfiles: studentDb.listAll() };
  }

  /**
   * Returns generated student campaign payload by UID from SQLite.
   *
   * @param {string} nfcUid - Student UID.
   * @returns {Promise<object>} Generated student campaign payload.
   */
  async function getGeneratedStudentCampaignByUid(nfcUid) {
    const uid = String(nfcUid || "").trim();
    if (!uid) {
      throw new ValidationError([issue("nfcUid", "nfcUid is required", "required")]);
    }

    const profile = studentDb.getByUid(uid);
    if (!profile) {
      throw new ValidationError([issue("nfcUid", "Student profile not found", "not_found")]);
    }

    return {
      nfcUid: profile.nfcUid,
      name: profile.displayName,
      campaign: buildGeneratedStudentCampaign(profile),
    };
  }

  /**
   * Lists all generated student campaigns from SQLite profiles.
   *
   * @returns {Promise<Array<object>>} Generated student campaigns.
   */
  async function listGeneratedStudentCampaigns() {
    return studentDb.listAll().map((profile) => ({
      nfcUid: profile.nfcUid,
      name: profile.displayName,
      campaign: buildGeneratedStudentCampaign(profile),
    }));
  }

  /**
   * Returns all student profiles from SQLite.
   *
   * @returns {Array<object>} Profile list.
   */
  function listStudentProfiles() {
    return studentDb.listAll();
  }

  /**
   * Returns student profile count from SQLite.
   *
   * @returns {number} Profile count.
   */
  function getStudentProfileCount() {
    return studentDb.count();
  }

  /**
   * Creates or updates a manual student campaign mapping.
   *
   * @param {object} payload - Student payload.
   * @returns {Promise<object>} Updated state.
   */
  async function upsertStudent(payload) {
    const state = await repository.readState();
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

    return await repository.writeState(state);
  }

  /**
   * Deletes manual student mapping by UID.
   *
   * @param {string} nfcUid - Student UID.
   * @returns {Promise<object>} Updated state.
   */
  async function deleteStudent(nfcUid) {
    const state = await repository.readState();
    const uid = String(nfcUid || "").trim();
    if (!uid) {
      throw new ValidationError([issue("nfcUid", "nfcUid is required", "required")]);
    }

    const before = state.students.length;
    state.students = state.students.filter((s) => s.nfcUid !== uid);
    if (state.students.length === before) {
      throw new ValidationError([issue("nfcUid", "Student not found", "not_found")]);
    }

    return await repository.writeState(state);
  }

  /**
   * Sets menu campaign.
   *
   * @param {object} payload - Menu campaign payload.
   * @returns {Promise<object>} Updated state.
   */
  async function setMenuCampaign({ campaignName, items }) {
    const state = await repository.readState();

    state.menuCampaign = {
      campaignId: "menu-default",
      campaignName: validateCampaignName(campaignName),
      kind: "menu",
      updatedAt: nowIso(),
      items: normalizeAndValidateItems(items, "items"),
    };
    return await repository.writeState(state);
  }

  /**
   * Returns storage health diagnostics.
   *
   * @returns {Promise<object>} Health payload.
   */
  async function getStorageHealth() {
    return await repository.getHealth();
  }

  return {
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
    importStudentProfiles,
    getGeneratedStudentCampaignByUid,
    listGeneratedStudentCampaigns,
    listStudentProfiles,
    getStudentProfileCount,
    toRuntimeConfig,
    normalizeAndValidateItems,
    getStorageHealth,
  };
}

module.exports = {
  createStorage,
  ValidationError,
};
