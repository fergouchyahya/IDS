/**
 * Player event route handler.
 *
 * Responsibilities:
 * - Accept UI-triggered events.
 * - Guard movement events to detector-only path.
 * - Optionally enrich NFC events from admin sync.
 */

const { json, readJsonBody } = require("../../../shared/utils/http-helpers");
const { isMovementInputEvent } = require("../detector/event-utils");
const { STATE } = require("../services/config-service");

/**
 * Extracts NFC UID from various payload aliases.
 *
 * @param {object} event - Event payload.
 * @returns {string} Normalized UID.
 */
function extractUid(event) {
  return String(event?.nfcUid || event?.studentId || event?.uid || "").trim();
}

/**
 * Handles POST /events requests.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed request URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleEvents(req, res, url, deps) {
  let event;
  try {
    event = await readJsonBody(req);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }

  const normalizedEvent = deps.stateMachine.normalizeEvent(event);

  if (isMovementInputEvent(event)) {
    return json(res, 403, {
      error: "movement_event_requires_detector",
      hint: "Use detector endpoint with authenticated detector token.",
    });
  }

  if (deps.syncService.isConfigured()) {
    await deps.syncService.syncRuntime();

    const currentState = deps.stateMachine.getStatus().state;
    if (
      normalizedEvent === "nfc_tap"
      && (currentState === STATE.MENU
        || currentState === STATE.VISITOR_INFO
        || currentState === STATE.STUDENT_INFO)
    ) {
      const uid = extractUid(event);
      if (uid) {
        try {
          const generated = await deps.syncService.loadStudentCampaign(uid);
          if (generated?.campaign) {
            deps.stateMachine.upsertRuntimeStudent(generated);
            deps.logger.info("student_campaign_loaded", { uid });
          }
        } catch (e) {
          deps.logger.warn("student_campaign_load_failed", {
            uid,
            error: String(e?.message || e),
          });
        }
      }
    }
  }

  return json(res, 200, deps.stateMachine.handleEvent(event));
}

module.exports = {
  handleEvents,
};
