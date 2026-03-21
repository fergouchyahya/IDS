/**
 * Detector event utility functions.
 *
 * Responsibilities:
 * - Classify movement-origin events.
 * - Restrict accepted detector event types.
 */

/**
 * Returns whether an event is a movement input event.
 *
 * @param {object} event - Event payload.
 * @returns {boolean} True when event is movement-related.
 */
function isMovementInputEvent(event) {
  const normalizedType = String(event?.type || "").toLowerCase();
  return normalizedType === "movement_detected" || normalizedType === "movement" || normalizedType === "vision_present";
}

/**
 * Returns whether detector endpoint accepts a given event type.
 *
 * @param {string} eventType - Event type.
 * @returns {boolean} True when allowed.
 */
function isDetectorAllowedEvent(eventType) {
  const normalizedType = String(eventType || "").toLowerCase();
  return normalizedType === "movement_detected"
    || normalizedType === "visitor_selected"
    || normalizedType === "scroll_next"
    || normalizedType === "scroll_prev"
    || normalizedType === "nfc_tap"
    || normalizedType === "presence_keepalive";
}

module.exports = {
  isMovementInputEvent,
  isDetectorAllowedEvent,
};
