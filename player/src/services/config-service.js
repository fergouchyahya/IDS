/**
 * Player configuration services.
 *
 * Responsibilities:
 * - Normalize detector runtime configuration.
 * - Normalize player runtime campaign configuration.
 * - Provide compatibility with legacy config shape.
 */

/**
 * Player state constants.
 */
const STATE = {
  IDLE: "IDLE",
  MENU: "MENU",
  VISITOR_INFO: "VISITOR_INFO",
  STUDENT_INFO: "STUDENT_INFO",
};

/**
 * Default detector configuration values.
 */
const DEFAULT_DETECTOR_CONFIG = Object.freeze({
  analyzeEveryMs: 120,
  movementPixelThreshold: 22,
  foregroundDeltaThreshold: 20,
  backgroundAlpha: 0.05,
  minPresenceRatio: 0.03,
  minPresenceBoxRatio: 0.10,
  maxPresenceBoxRatio: 0.85,
  minMotionRatio: 0.018,
  motionStreakRequired: 2,
  minSideMotionPixels: 18,
  dominanceFactor: 1.45,
  presenceStreakRequired: 3,
  handMoveStreakRequired: 3,
  handDirectionStreakRequired: 3,
  menuDecisionDelayMs: 900,
  handZoneTopRatio: 0.12,
  handZoneBottomRatio: 0.78,
  handZoneSideRatio: 0.24,
  mirrorHandedness: true,
  cooldownByEvent: {
    movement_detected: 1700,
    visitor_selected: 800,
    scroll_next: 460,
    scroll_prev: 460,
  },
});

/**
 * Converts a value to number or uses fallback when invalid.
 *
 * @param {*} value - Value to convert.
 * @param {number} fallback - Fallback value.
 * @returns {number} Parsed number or fallback.
 */
function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Limits a numeric value to a minimum and maximum.
 *
 * @param {number} value - Value to clamp.
 * @param {number} min - Minimum accepted value.
 * @param {number} max - Maximum accepted value.
 * @returns {number} Clamped value.
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Converts a value to boolean or uses fallback when invalid.
 *
 * @param {*} value - Value to convert.
 * @param {boolean} fallback - Fallback value.
 * @returns {boolean} Parsed boolean or fallback.
 */
function toBool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Returns a sorted copy of campaign items by order field.
 *
 * @param {Array<object>} items - Raw campaign items.
 * @returns {Array<object>} Sorted campaign items.
 */
function sortItems(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Normalizes detector config by applying defaults and bounds.
 *
 * @param {object} [input={}] - User-provided detector config.
 * @returns {object} Sanitized detector config.
 */
function normalizeDetectorConfig(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const baseCooldowns = {
    ...DEFAULT_DETECTOR_CONFIG.cooldownByEvent,
    ...(source.cooldownByEvent && typeof source.cooldownByEvent === "object" ? source.cooldownByEvent : {}),
  };

  const minPresenceBoxRatio = clamp(
    toNumber(source.minPresenceBoxRatio, DEFAULT_DETECTOR_CONFIG.minPresenceBoxRatio),
    0,
    1,
  );
  const maxPresenceBoxRatio = clamp(
    toNumber(source.maxPresenceBoxRatio, DEFAULT_DETECTOR_CONFIG.maxPresenceBoxRatio),
    minPresenceBoxRatio,
    1,
  );
  const handZoneTopRatio = clamp(
    toNumber(source.handZoneTopRatio, DEFAULT_DETECTOR_CONFIG.handZoneTopRatio),
    0,
    0.95,
  );
  const handZoneBottomRatio = clamp(
    toNumber(source.handZoneBottomRatio, DEFAULT_DETECTOR_CONFIG.handZoneBottomRatio),
    handZoneTopRatio + 0.01,
    1,
  );

  return {
    analyzeEveryMs: Math.round(clamp(toNumber(source.analyzeEveryMs, DEFAULT_DETECTOR_CONFIG.analyzeEveryMs), 30, 1200)),
    movementPixelThreshold: Math.round(clamp(
      toNumber(source.movementPixelThreshold, DEFAULT_DETECTOR_CONFIG.movementPixelThreshold),
      1,
      255,
    )),
    foregroundDeltaThreshold: Math.round(clamp(
      toNumber(source.foregroundDeltaThreshold, DEFAULT_DETECTOR_CONFIG.foregroundDeltaThreshold),
      1,
      255,
    )),
    backgroundAlpha: clamp(toNumber(source.backgroundAlpha, DEFAULT_DETECTOR_CONFIG.backgroundAlpha), 0.001, 0.35),
    minPresenceRatio: clamp(toNumber(source.minPresenceRatio, DEFAULT_DETECTOR_CONFIG.minPresenceRatio), 0.001, 1),
    minPresenceBoxRatio,
    maxPresenceBoxRatio,
    minMotionRatio: clamp(toNumber(source.minMotionRatio, DEFAULT_DETECTOR_CONFIG.minMotionRatio), 0.001, 1),
    motionStreakRequired: Math.round(clamp(
      toNumber(source.motionStreakRequired, DEFAULT_DETECTOR_CONFIG.motionStreakRequired),
      1,
      20,
    )),
    minSideMotionPixels: Math.round(clamp(
      toNumber(source.minSideMotionPixels, DEFAULT_DETECTOR_CONFIG.minSideMotionPixels),
      1,
      2000,
    )),
    dominanceFactor: clamp(toNumber(source.dominanceFactor, DEFAULT_DETECTOR_CONFIG.dominanceFactor), 1, 4),
    presenceStreakRequired: Math.round(clamp(
      toNumber(source.presenceStreakRequired, DEFAULT_DETECTOR_CONFIG.presenceStreakRequired),
      1,
      20,
    )),
    handMoveStreakRequired: Math.round(clamp(
      toNumber(source.handMoveStreakRequired, DEFAULT_DETECTOR_CONFIG.handMoveStreakRequired),
      1,
      20,
    )),
    handDirectionStreakRequired: Math.round(clamp(
      toNumber(source.handDirectionStreakRequired, DEFAULT_DETECTOR_CONFIG.handDirectionStreakRequired),
      1,
      20,
    )),
    menuDecisionDelayMs: Math.round(clamp(
      toNumber(source.menuDecisionDelayMs, DEFAULT_DETECTOR_CONFIG.menuDecisionDelayMs),
      0,
      12000,
    )),
    handZoneTopRatio,
    handZoneBottomRatio,
    handZoneSideRatio: clamp(
      toNumber(source.handZoneSideRatio, DEFAULT_DETECTOR_CONFIG.handZoneSideRatio),
      0.05,
      0.45,
    ),
    mirrorHandedness: toBool(source.mirrorHandedness, DEFAULT_DETECTOR_CONFIG.mirrorHandedness),
    cooldownByEvent: {
      movement_detected: Math.round(clamp(
        toNumber(baseCooldowns.movement_detected, DEFAULT_DETECTOR_CONFIG.cooldownByEvent.movement_detected),
        0,
        10000,
      )),
      visitor_selected: Math.round(clamp(
        toNumber(baseCooldowns.visitor_selected, DEFAULT_DETECTOR_CONFIG.cooldownByEvent.visitor_selected),
        0,
        10000,
      )),
      scroll_next: Math.round(clamp(
        toNumber(baseCooldowns.scroll_next, DEFAULT_DETECTOR_CONFIG.cooldownByEvent.scroll_next),
        0,
        10000,
      )),
      scroll_prev: Math.round(clamp(
        toNumber(baseCooldowns.scroll_prev, DEFAULT_DETECTOR_CONFIG.cooldownByEvent.scroll_prev),
        0,
        10000,
      )),
    },
  };
}

/**
 * Normalizes runtime config from new or legacy schema.
 *
 * @param {object} input - Raw runtime config.
 * @returns {object|null} Normalized runtime config or null when invalid.
 */
function normalizeRuntimeConfig(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  if (input.idleCampaign && input.menuCampaign && input.visitorCampaign) {
    return {
      settings: {
        inactivityTimeoutMs: Number(input.settings?.inactivityTimeoutMs) || 10000,
      },
      idleCampaign: {
        ...input.idleCampaign,
        items: sortItems(input.idleCampaign.items),
      },
      menuCampaign: {
        ...input.menuCampaign,
        items: sortItems(input.menuCampaign.items),
      },
      visitorCampaign: {
        ...input.visitorCampaign,
        items: sortItems(input.visitorCampaign.items),
      },
      students: Array.isArray(input.students)
        ? input.students.map((s) => ({
            ...s,
            campaign: s.campaign
              ? {
                  ...s.campaign,
                  items: sortItems(s.campaign.items),
                }
              : null,
          }))
        : [],
      updatedAt: input.updatedAt,
    };
  }

  if (Array.isArray(input.campaigns)) {
    const byId = new Map(input.campaigns.map((c) => [c.campaignId, { ...c, items: sortItems(c.items) }]));
    const idleCampaign = byId.get("idle-welcome") || input.campaigns[0] || null;
    const menuCampaign = byId.get("menu-choices") || null;
    const visitorCampaign = byId.get("info-visitor") || null;

    if (!idleCampaign || !menuCampaign || !visitorCampaign) {
      return null;
    }

    return {
      settings: { inactivityTimeoutMs: 10000 },
      idleCampaign,
      menuCampaign,
      visitorCampaign,
      students: Array.from(byId.values())
        .filter((c) => c.campaignId === "info-nfc")
        .map((c) => ({
          nfcUid: "demo-uid-001",
          name: "Demo Student",
          campaign: c,
        })),
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

module.exports = {
  STATE,
  DEFAULT_DETECTOR_CONFIG,
  normalizeDetectorConfig,
  normalizeRuntimeConfig,
  sortItems,
};
