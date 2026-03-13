/**
 * Player state machine service.
 *
 * Responsibilities:
 * - Track current runtime state.
 * - Apply event transitions.
 * - Manage inactivity timeout.
 */

const { createLogger } = require("../../../shared/utils/logger");
const { normalizeRuntimeConfig, sortItems, STATE } = require("./config-service");

const logger = createLogger("ids-player-state-machine");

/**
 * Manages player state transitions for campaign playback.
 */
class PlayerStateMachine {
  /**
   * Creates a new state machine from runtime config.
   *
   * @param {object} runtimeConfig - Runtime config payload.
   */
  constructor(runtimeConfig) {
    const normalized = normalizeRuntimeConfig(runtimeConfig);
    if (!normalized) {
      throw new Error("Invalid runtime config");
    }

    this.runtime = normalized;
    this.currentState = STATE.IDLE;
    this.currentCampaign = this.runtime.idleCampaign;
    this.currentItemIndex = 0;
    this.currentStudentUid = null;
    this.inactivityTimer = null;
    this.inactivityTimeout = this.runtime.settings.inactivityTimeoutMs;
    this.lastActivityAt = Date.now();
    this.refreshStudentIndex();
  }

  /**
   * Rebuilds UID-to-student lookup map.
   */
  refreshStudentIndex() {
    this.studentsByUid = new Map(
      this.runtime.students
        .filter((s) => s && s.nfcUid)
        .map((s) => [String(s.nfcUid), s]),
    );
  }

  /**
   * Replaces runtime configuration and keeps current campaign when possible.
   *
   * @param {object} nextRuntime - New runtime config payload.
   * @returns {boolean} True when applied.
   */
  setRuntimeConfig(nextRuntime) {
    const normalized = normalizeRuntimeConfig(nextRuntime);
    if (!normalized) return false;

    const currentCampaignId = this.currentCampaign?.campaignId;
    this.runtime = normalized;
    this.inactivityTimeout = this.runtime.settings.inactivityTimeoutMs;
    this.refreshStudentIndex();

    const candidates = [
      this.runtime.idleCampaign,
      this.runtime.menuCampaign,
      this.runtime.visitorCampaign,
      ...this.runtime.students.map((s) => s.campaign).filter(Boolean),
    ];

    const stillExists = candidates.find((c) => c?.campaignId === currentCampaignId);
    if (stillExists) {
      this.currentCampaign = stillExists;
      const size = stillExists.items.length;
      if (size === 0) this.currentItemIndex = 0;
      else this.currentItemIndex %= size;
    } else {
      this.transitionToIdle();
    }

    this.scheduleInactivityTimer();
    return true;
  }

  /**
   * Returns current campaign item based on current index.
   *
   * @returns {object|null} Current item.
   */
  getCurrentItem() {
    const items = this.currentCampaign?.items || [];
    if (items.length === 0) return null;
    if (this.currentItemIndex >= items.length) this.currentItemIndex = 0;
    if (this.currentItemIndex < 0) this.currentItemIndex = items.length - 1;
    return items[this.currentItemIndex];
  }

  /**
   * Transitions to a state and campaign, resetting item index.
   *
   * @param {string} state - Target state.
   * @param {object} campaign - Target campaign.
   */
  transitionTo(state, campaign) {
    this.currentState = state;
    this.currentCampaign = campaign;
    this.currentItemIndex = 0;
  }

  /**
   * Transitions to IDLE state.
   */
  transitionToIdle() {
    this.currentStudentUid = null;
    this.transitionTo(STATE.IDLE, this.runtime.idleCampaign);
  }

  /**
   * Transitions to MENU state.
   */
  transitionToMenu() {
    this.currentStudentUid = null;
    this.transitionTo(STATE.MENU, this.runtime.menuCampaign);
  }

  /**
   * Finds student by NFC UID.
   *
   * @param {string} nfcUid - NFC UID.
   * @returns {object|null} Student profile.
   */
  findStudentByUid(nfcUid) {
    const uid = String(nfcUid || "").trim();
    if (!uid) return null;
    return this.studentsByUid.get(uid) || null;
  }

  /**
   * Adds or updates student campaign in current runtime.
   *
   * @param {object} student - Student payload from admin.
   * @returns {boolean} True when updated.
   */
  upsertRuntimeStudent(student) {
    const uid = String(student?.nfcUid || "").trim();
    if (!uid || !student?.campaign) return false;

    const normalizedStudent = {
      nfcUid: uid,
      name: String(student?.name || "").trim() || uid,
      campaign: {
        ...student.campaign,
        items: sortItems(student.campaign.items),
      },
    };

    const index = this.runtime.students.findIndex((item) => item.nfcUid === uid);
    if (index >= 0) {
      this.runtime.students[index] = normalizedStudent;
    } else {
      this.runtime.students.push(normalizedStudent);
    }
    this.refreshStudentIndex();
    return true;
  }

  /**
   * Advances current item index by offset in circular mode.
   *
   * @param {number} offset - Relative move.
   * @returns {boolean} True when changed.
   */
  advance(offset) {
    const items = this.currentCampaign?.items || [];
    if (items.length <= 1) return false;
    this.currentItemIndex = (this.currentItemIndex + offset + items.length) % items.length;
    return true;
  }

  /**
   * Schedules inactivity timeout for non-IDLE states.
   */
  scheduleInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.currentState !== STATE.IDLE) {
      const remainingMs = Math.max(1, this.lastActivityAt + this.inactivityTimeout - Date.now());
      this.inactivityTimer = setTimeout(() => {
        logger.info("inactivity_timeout", { action: "return_to_idle" });
        this.transitionToIdle();
      }, remainingMs);
    }
  }

  /**
   * Normalizes input event type aliases to canonical event names.
   *
   * @param {object} [event={}] - Incoming event payload.
   * @returns {string} Canonical event type.
   */
  normalizeEvent(event = {}) {
    const type = String(event.type || "").toLowerCase();

    if (type === "movement_detected" || type === "movement" || type === "vision_present") return "movement_detected";
    if (type === "visitor_selected" || type === "visitor_detected") return "visitor_selected";
    if (type === "nfc_tap" || type === "nfc") return "nfc_tap";
    if (type === "scroll_next" || type === "right_hand_move" || type === "right_hand") return "scroll_next";
    if (type === "scroll_prev" || type === "left_hand_move" || type === "left_hand") return "scroll_prev";

    if (type === "select") {
      const choice = String(event.choice || "").toLowerCase();
      if (choice === "visitor") return "visitor_selected";
      if (choice === "nfc") return "nfc_tap";
    }

    return "unknown";
  }

  /**
   * Handles a single event and returns updated runtime status.
   *
   * @param {object} [event={}] - Incoming event payload.
   * @returns {object} Event handling result and status.
   */
  handleEvent(event = {}) {
    const normalized = this.normalizeEvent(event);
    let handled = false;
    let action = "noop";

    if (normalized === "movement_detected" && this.currentState === STATE.IDLE) {
      this.transitionToMenu();
      handled = true;
      action = "show_menu";
    } else if (normalized === "visitor_selected" && this.currentState === STATE.MENU) {
      this.transitionTo(STATE.VISITOR_INFO, this.runtime.visitorCampaign);
      handled = true;
      action = "show_visitor_info";
    } else if (
      normalized === "nfc_tap"
      && (this.currentState === STATE.MENU
        || this.currentState === STATE.VISITOR_INFO
        || this.currentState === STATE.STUDENT_INFO)
    ) {
      const student = this.findStudentByUid(event.nfcUid || event.studentId || event.uid);
      if (student && student.campaign) {
        this.currentStudentUid = student.nfcUid;
        this.transitionTo(STATE.STUDENT_INFO, student.campaign);
        handled = true;
        action = "show_student_info";
      } else {
        this.transitionToMenu();
        handled = true;
        action = "student_not_found_back_to_menu";
      }
    } else if (normalized === "scroll_next") {
      handled = true;
      action = this.advance(1) ? "scroll_next" : "single_item_noop";
    } else if (normalized === "scroll_prev") {
      handled = true;
      action = this.advance(-1) ? "scroll_prev" : "single_item_noop";
    }

    if (handled) {
      this.lastActivityAt = Date.now();
      this.scheduleInactivityTimer();
    }

    return {
      status: handled ? "ok" : "ignored",
      normalizedEvent: normalized,
      action,
      ...this.getStatus(),
    };
  }

  /**
   * Returns current state payload used by APIs and UI rendering.
   *
   * @returns {object} Current state snapshot.
   */
  getStatus() {
    return {
      state: this.currentState,
      campaignId: this.currentCampaign?.campaignId || null,
      campaignName: this.currentCampaign?.campaignName || null,
      itemIndex: this.currentItemIndex,
      item: this.getCurrentItem(),
      currentStudentUid: this.currentStudentUid,
      inactivityTimeoutMs: this.inactivityTimeout,
      runtimeUpdatedAt: this.runtime.updatedAt,
    };
  }

  /**
   * Stops timers and releases resources.
   */
  stop() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = null;
  }
}

module.exports = {
  PlayerStateMachine,
  STATE,
};
