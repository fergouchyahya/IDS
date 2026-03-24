/**
 * Admin runtime projection mapper.
 *
 * Responsibilities:
 * - Map storage state to player runtime config.
 * - Generate student campaign payloads from profiles.
 */

const {
  ValidationError,
  issue,
  nowIso,
} = require("./repository");
const { normalizeAndValidateItems } = require("./validators");

/**
 * Builds generated student campaign from profile.
 *
 * @param {object} profile - Student profile.
 * @returns {object} Generated student campaign.
 */
function buildGeneratedStudentCampaign(profile) {
  const headline = `Welcome ${profile.displayName}`;
  const nextClassLine = profile.nextClassText || "Please check the timetable shown.";
  return {
    campaignId: `student-${profile.nfcUid}`,
    campaignName: `${profile.displayName} Info`,
    kind: "student",
    updatedAt: nowIso(),
    items: normalizeAndValidateItems([
      {
        contentId: "student-auto-1",
        type: "TEXT",
        data: `${headline}\nYour personal info is ready`,
        order: 1,
        durationSec: 20,
      },
      {
        contentId: "student-auto-2",
        type: "IMAGE",
        data: resolveMediaUrl(profile.timetableImageUrl),
        order: 2,
        durationSec: 25,
      },
      {
        contentId: "student-auto-3",
        type: "TEXT",
        data: nextClassLine,
        order: 3,
        durationSec: 20,
      },
    ], "items"),
  };
}

/**
 * Returns generated student campaign payload by uid.
 *
 * @param {object} state - Storage state.
 * @param {string} nfcUid - Student uid.
 * @returns {object} Generated campaign payload.
 */
function getGeneratedStudentCampaignByUid(state, nfcUid) {
  const uid = String(nfcUid || "").trim();
  if (!uid) {
    throw new ValidationError([issue("nfcUid", "nfcUid is required", "required")]);
  }

  const profile = state.studentProfiles.find((item) => item.nfcUid === uid) || null;
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
 * Lists all generated student campaigns.
 *
 * @param {object} state - Storage state.
 * @returns {Array<object>} Generated campaign list.
 */
function listGeneratedStudentCampaigns(state) {
  return (state.studentProfiles || []).map((profile) => ({
    nfcUid: profile.nfcUid,
    name: profile.displayName,
    campaign: buildGeneratedStudentCampaign(profile),
  }));
}

/**
 * Resolves a single /media/ path to an absolute admin URL.
 *
 * @param {string} url - URL or path.
 * @returns {string} Resolved URL.
 */
function resolveMediaUrl(url) {
  if (typeof url === "string" && url.startsWith("/media/")) {
    const base = (process.env.IDS_PUBLIC_ADMIN_URL || "http://127.0.0.1:8081").replace(/\/$/, "");
    return `${base}${url}`;
  }
  return url;
}

/**
 * Resolves /media/ paths to absolute admin URLs so the player browser can fetch them.
 *
 * @param {object|null} campaign - Campaign object with items.
 * @returns {object|null} Campaign with resolved media URLs.
 */
function resolveMediaUrls(campaign) {
  if (!campaign || !Array.isArray(campaign.items)) return campaign;
  return {
    ...campaign,
    items: campaign.items.map((item) => ({
      ...item,
      data: resolveMediaUrl(item.data),
    })),
  };
}

/**
 * Maps storage state to runtime config used by player.
 *
 * @param {object} state - Storage state.
 * @returns {object} Player runtime config.
 */
function toRuntimeConfig(state) {
  const idleCampaign = state.idleCampaigns.find((c) => c.campaignId === state.active.idleCampaignId) || null;
  const visitorCampaign = state.visitorCampaigns.find((c) => c.campaignId === state.active.visitorCampaignId) || null;

  return {
    settings: state.settings,
    active: state.active,
    idleCampaign: resolveMediaUrls(idleCampaign),
    menuCampaign: resolveMediaUrls(state.menuCampaign),
    visitorCampaign: resolveMediaUrls(visitorCampaign),
    students: state.students,
    updatedAt: state.updatedAt,
  };
}

module.exports = {
  buildGeneratedStudentCampaign,
  getGeneratedStudentCampaignByUid,
  listGeneratedStudentCampaigns,
  toRuntimeConfig,
};
