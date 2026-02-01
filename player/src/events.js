/**
 * IDS — Event Model (Phase 3)
 * File: player/src/events.js
 *
 * PURPOSE
 *   Defines event types and basic validation for incoming events.
 *
 * WHY THIS EXISTS
 *   Hardware integrations (NFC, vision) will eventually produce events.
 *   For now we simulate them. We keep the model strict to avoid "mystery events".
 *
 * EVENT TYPES (locked for Phase 3)
 *   - IDLE: explicit "go back to idle mode"
 *   - VISION_PRESENT: presence detected (payload may include timestamp)
 *   - NFC_TAP: NFC badge tap (payload includes studentId)
 *
 * EVENT SHAPE (canonical)
 *   {
 *     "type": "NFC_TAP" | "VISION_PRESENT" | "IDLE",
 *     "timestamp": "2026-02-01T10:00:00Z",
 *     "studentId": "optional string"
 *   }
 *
 * NOTES
 *   - timestamp is required (ISO date-time string) for consistent logs/debugging.
 *   - studentId is required ONLY for NFC_TAP.
 */

const EVENT_TYPES = Object.freeze({
  IDLE: "IDLE",
  VISION_PRESENT: "VISION_PRESENT",
  NFC_TAP: "NFC_TAP",
});

function isIsoDateTimeString(s) {
  // Basic sanity check. Full validation is not needed here.
  // We mainly want: string + Date can parse it.
  if (typeof s !== "string") return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

function validateEvent(e) {
  if (typeof e !== "object" || e === null || Array.isArray(e)) {
    return { ok: false, error: "Event must be a JSON object" };
  }

  if (typeof e.type !== "string") {
    return { ok: false, error: "Event.type must be a string" };
  }

  const type = e.type;
  const known = Object.values(EVENT_TYPES);
  if (!known.includes(type)) {
    return { ok: false, error: `Unknown event type: ${type}` };
  }

  if (!isIsoDateTimeString(e.timestamp)) {
    return { ok: false, error: "Event.timestamp must be an ISO date-time string" };
  }

  if (type === EVENT_TYPES.NFC_TAP) {
    if (typeof e.studentId !== "string" || e.studentId.trim().length === 0) {
      return { ok: false, error: "NFC_TAP requires non-empty studentId" };
    }
  } else {
    // For non-NFC events, studentId must not be present (keeps model clean)
    if (Object.prototype.hasOwnProperty.call(e, "studentId")) {
      return { ok: false, error: `${type} must not include studentId` };
    }
  }

  return { ok: true };
}

module.exports = {
  EVENT_TYPES,
  validateEvent,
};
