/**
 * Player detector route handlers.
 *
 * Responsibilities:
 * - Authenticate detector source by token.
 * - Validate detector event types.
 * - Forward detector events to state machine.
 */

const { json, readJsonBody } = require("../../../shared/utils/http-helpers");
const { isDetectorAllowedEvent } = require("../detector/event-utils");

/**
 * Checks whether detector token is valid for incoming request.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {string} expectedToken - Expected detector token.
 * @returns {boolean} True when token is valid.
 */
function hasValidDetectorToken(req, expectedToken) {
  const incomingToken = String(req.headers["x-detector-token"] || "");
  return Boolean(incomingToken) && incomingToken === expectedToken;
}

/**
 * Handles POST /detector/movement requests.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed request URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleDetectorMovement(req, res, url, deps) {
  if (!hasValidDetectorToken(req, deps.detectorToken)) {
    return json(res, 403, { error: "forbidden_detector_source" });
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }

  if (deps.syncService.isConfigured()) {
    await deps.syncService.syncRuntime();
  }

  const event = {
    type: "movement_detected",
    source: "motion_detector",
    confidence: Number(payload?.confidence) || undefined,
  };
  return json(res, 200, deps.stateMachine.handleEvent(event));
}

/**
 * Handles POST /detector/events requests.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed request URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleDetectorEvents(req, res, url, deps) {
  if (!hasValidDetectorToken(req, deps.detectorToken)) {
    return json(res, 403, { error: "forbidden_detector_source" });
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }

  const eventType = String(payload?.type || "").toLowerCase();
  if (!isDetectorAllowedEvent(eventType)) {
    return json(res, 400, { error: "invalid_detector_event_type" });
  }

  if (deps.syncService.isConfigured()) {
    await deps.syncService.syncRuntime();
  }

  const event = {
    type: eventType,
    source: "motion_detector",
    confidence: Number(payload?.confidence) || undefined,
    direction: payload?.direction,
  };
  return json(res, 200, deps.stateMachine.handleEvent(event));
}

module.exports = {
  handleDetectorMovement,
  handleDetectorEvents,
};
