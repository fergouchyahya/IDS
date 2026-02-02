/**
 * IDS — Player State Machine (Phase 3)
 * File: player/src/fsm.js
 *
 * PURPOSE
 *   Implements a strict finite-state machine (FSM) for player behavior.
 *
 * WHY THIS EXISTS
 *   IDS behavior must be predictable. Events should not cause ambiguous states.
 *   This FSM is deliberately strict: illegal transitions are rejected loudly.
 *
 * STATES
 *   - Idle:            default informational loop (no personalization)
 *   - Interactive:     presence detected; waiting for user interaction (e.g., NFC)
 *   - PlayingCampaign: a campaign is actively playing (still no rendering here)
 *
 * TRANSITIONS (Phase 3 — simulation rules)
 *   - IDLE event always forces state to Idle.
 *   - VISION_PRESENT:
 *       Idle -> Interactive
 *       Interactive -> Interactive
 *       PlayingCampaign -> PlayingCampaign
 *   - NFC_TAP:
 *       Idle -> PlayingCampaign
 *       Interactive -> PlayingCampaign
 *       PlayingCampaign -> PlayingCampaign (ignore; we don't restart yet)
 *
 * OUTPUT
 *   transition(currentState, eventType) -> { nextState, changed }
 */

const STATES = Object.freeze({
  IDLE: "Idle",
  INTERACTIVE: "Interactive",
  PLAYING: "PlayingCampaign",
});

function transition(currentState, eventType) {
  if (!Object.values(STATES).includes(currentState)) {
    throw new Error(`Unknown current state: ${currentState}`);
  }

  // IDLE overrides everything
  if (eventType === "IDLE") {
    return { nextState: STATES.IDLE, changed: currentState !== STATES.IDLE };
  }

  if (eventType === "VISION_PRESENT") {
    if (currentState === STATES.IDLE) return { nextState: STATES.INTERACTIVE, changed: true };
    if (currentState === STATES.INTERACTIVE) return { nextState: STATES.INTERACTIVE, changed: false };
    if (currentState === STATES.PLAYING) return { nextState: STATES.PLAYING, changed: false }; 
  }

  if (eventType === "NFC_TAP") {
    if (currentState === STATES.IDLE) return { nextState: STATES.PLAYING, changed: true };
    if (currentState === STATES.INTERACTIVE) return { nextState: STATES.PLAYING, changed: true };
    if (currentState === STATES.PLAYING) return { nextState: STATES.PLAYING, changed: false };
  }

  throw new Error(`Illegal transition: state=${currentState} event=${eventType}`);
}

module.exports = {
  STATES,
  transition,
};
