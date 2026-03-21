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
    this.lastNfcError = null;
    this.timeoutEndsAt = null;
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

    /* Preserve students that were loaded via NFC (upsertRuntimeStudent)
       but are not in the incoming admin runtime config.  Also prefer the
       NFC-loaded version when admin sync returns the same UID with a
       different (or missing) campaign — the on-demand NFC campaign is
       always more specific than what /runtime-config provides. */
    const previousStudents = this.runtime.students || [];
    const currentCampaignId = this.currentCampaign?.campaignId;
    this.runtime = normalized;
    this.inactivityTimeout = this.runtime.settings.inactivityTimeoutMs;

    const previousByUid = new Map(
      previousStudents.filter((s) => s && s.nfcUid && s.campaign).map((s) => [s.nfcUid, s]),
    );
    const merged = this.runtime.students.map((s) => {
      const prev = previousByUid.get(s.nfcUid);
      /* Keep the NFC-loaded campaign if admin version has none or a different one */
      if (prev && (!s.campaign || s.campaign.campaignId !== prev.campaign.campaignId)) {
        return prev;
      }
      return s;
    });
    /* Also add students only present in previous (not in incoming at all) */
    const incomingUids = new Set(this.runtime.students.map((s) => s.nfcUid));
    for (const prev of previousStudents) {
      if (prev && prev.nfcUid && !incomingUids.has(prev.nfcUid)) {
        merged.push(prev);
      }
    }
    this.runtime.students = merged;
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
      this.scheduleInactivityTimer();
    }

    /* Do NOT reschedule the timer here when staying in the same state —
       the existing timer is still valid and rescheduling with a stale
       lastActivityAt would shorten the remaining time incorrectly.
       The timer will be properly reset by the next handleEvent call. */
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
      this.timeoutEndsAt = Date.now() + remainingMs;
      logger.info("schedule_inactivity_timer", {
        state: this.currentState,
        remainingMs,
        inactivityTimeout: this.inactivityTimeout,
        lastActivityAgoMs: Date.now() - this.lastActivityAt,
      });
      this.inactivityTimer = setTimeout(() => {
        logger.info("inactivity_timeout", { action: "return_to_idle", state: this.currentState });
        this.transitionToIdle();
        this.timeoutEndsAt = null;
      }, remainingMs);
    } else {
      this.timeoutEndsAt = null;
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
    if (type === "presence_keepalive") return "presence_keepalive";

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
      const uid = String(event.nfcUid || event.studentId || event.uid || "").trim();
      const student = this.findStudentByUid(uid);
      if (student && student.campaign) {
        if (this.currentState === STATE.STUDENT_INFO && this.currentStudentUid === uid) {
          /* Same card tapped again — keep session alive without resetting carousel */
          handled = true;
          action = "nfc_keepalive";
        } else {
          this.currentStudentUid = student.nfcUid;
          this.transitionTo(STATE.STUDENT_INFO, student.campaign);
          handled = true;
          action = "show_student_info";
        }
      } else {
        this.transitionToMenu();
        this.lastNfcError = "card_not_recognized";
        handled = true;
        action = "student_not_found_back_to_menu";
      }
    } else if (normalized === "scroll_next") {
      handled = true;
      action = this.advance(1) ? "scroll_next" : "single_item_noop";
    } else if (normalized === "scroll_prev") {
      handled = true;
      action = this.advance(-1) ? "scroll_prev" : "single_item_noop";
    } else if (normalized === "presence_keepalive" && this.currentState !== STATE.IDLE) {
      handled = true;
      action = "presence_keepalive";
    }

    if (handled && action !== "student_not_found_back_to_menu") {
      this.lastNfcError = null;
    }

    if (handled) {
      const isKeepalive = action === "presence_keepalive" || action === "nfc_keepalive";
      logger.info("event_handled", { normalized, action, state: this.currentState });
      if (!isKeepalive) {
        /* Only real interactions reset the inactivity clock.
           Keepalives acknowledge presence but do NOT postpone timeout,
           so the display returns to IDLE after the configured duration
           of no actual gesture / tap. */
        this.lastActivityAt = Date.now();
        this.scheduleInactivityTimer();
      }
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
    const items = this.currentCampaign?.items || [];
    const student = this.currentStudentUid
      ? this.findStudentByUid(this.currentStudentUid)
      : null;
    return {
      state: this.currentState,
      campaignId: this.currentCampaign?.campaignId || null,
      campaignName: this.currentCampaign?.campaignName || null,
      itemIndex: this.currentItemIndex,
      itemTotal: items.length,
      item: this.getCurrentItem(),
      currentStudentUid: this.currentStudentUid,
      currentStudentName: student?.name || null,
      lastNfcError: this.lastNfcError,
      timeoutEndsAt: this.timeoutEndsAt,
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
