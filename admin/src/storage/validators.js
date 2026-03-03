/**
 * Admin storage validators.
 *
 * Responsibilities:
 * - Validate campaign and student payloads.
 * - Normalize campaign items.
 */

const {
  ValidationError,
  issue,
  throwIfIssues,
  nowIso,
} = require("./repository");

const ALLOWED_ITEM_TYPES = new Set(["TEXT", "IMAGE", "VIDEO"]);

/**
 * Validates campaign kind.
 *
 * @param {string} kind - Campaign kind.
 * @returns {boolean} True when kind is valid.
 */
function validateCampaignKind(kind) {
  return kind === "idle" || kind === "visitor";
}

/**
 * Returns campaign list by kind.
 *
 * @param {object} state - Storage state.
 * @param {string} kind - Campaign kind.
 * @returns {Array<object>} Matching campaign list.
 */
function getCampaignListByKind(state, kind) {
  return kind === "idle" ? state.idleCampaigns : state.visitorCampaigns;
}

/**
 * Normalizes and validates campaign items.
 *
 * @param {Array<object>} items - Campaign items.
 * @param {string} [pathPrefix='items'] - Path prefix for issues.
 * @returns {Array<object>} Normalized sorted items.
 */
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

/**
 * Validates campaign name.
 *
 * @param {string} campaignName - Campaign name.
 * @param {string} [pathLabel='campaignName'] - Path for issue reporting.
 * @returns {string} Normalized campaign name.
 */
function validateCampaignName(campaignName, pathLabel = "campaignName") {
  const name = String(campaignName || "").trim();
  if (!name) {
    throw new ValidationError([issue(pathLabel, "campaignName is required", "required")]);
  }
  return name;
}

/**
 * Normalizes student payload for manual student campaign mapping.
 *
 * @param {object} payload - Student payload.
 * @returns {object} Normalized payload.
 */
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

/**
 * Validates image reference used by student profile input.
 *
 * @param {string} value - URL or media path.
 * @returns {boolean} True when safe.
 */
function isSafeImageReference(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  if (normalized.startsWith("/media/")) return true;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Normalizes and validates student profile payload.
 *
 * @param {object} profile - Student profile payload.
 * @param {string} [pathPrefix='students[]'] - Path prefix for issues.
 * @returns {object} Normalized profile.
 */
function normalizeStudentProfilePayload(profile, pathPrefix = "students[]") {
  const nfcUid = String(profile?.nfcUid || "").trim();
  const displayName = String(profile?.displayName || profile?.name || "").trim();
  const timetableImageUrl = String(profile?.timetableImageUrl || "").trim();
  const nextClassText = String(profile?.nextClassText || "").trim();
  const issues = [];

  if (!nfcUid) {
    issues.push(issue(`${pathPrefix}.nfcUid`, "nfcUid is required", "required"));
  }
  if (!displayName) {
    issues.push(issue(`${pathPrefix}.displayName`, "displayName is required", "required"));
  }
  if (!timetableImageUrl) {
    issues.push(issue(`${pathPrefix}.timetableImageUrl`, "timetableImageUrl is required", "required"));
  } else if (!isSafeImageReference(timetableImageUrl)) {
    issues.push(issue(`${pathPrefix}.timetableImageUrl`, "timetableImageUrl must be /media/* or http(s) URL", "invalid_url"));
  }

  throwIfIssues(issues);
  return {
    nfcUid,
    displayName,
    timetableImageUrl,
    nextClassText,
    updatedAt: nowIso(),
  };
}

module.exports = {
  ALLOWED_ITEM_TYPES,
  validateCampaignKind,
  getCampaignListByKind,
  normalizeAndValidateItems,
  validateCampaignName,
  normalizeStudentPayload,
  isSafeImageReference,
  normalizeStudentProfilePayload,
};
