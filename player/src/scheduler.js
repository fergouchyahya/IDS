/**
 * IDS — Campaign Scheduler (Phase 4)
 * File: player/src/scheduler.js
 *
 * PURPOSE
 *   Orchestrates campaign selection, preemption, timers, and playback sequencing.
 *
 * RULES (from project decisions)
 *   - Higher campaignPriority (larger number) preempts immediately.
 *   - NFC_TAP restarts the selected campaign (interrupts the rest).
 *   - VIDEO runs until it finishes; in the dummy renderer we simulate this by durationSec.
 *   - Inactivity timer resets on any non-IDLE event and forces IDLE on timeout.
 */

const DEFAULT_INACTIVITY_MS = 30_000;
const DEFAULT_ITEM_DURATION_SEC = 5;

function sortCampaignsDeterministic(campaigns) {
  return [...campaigns].sort((a, b) => {
    if (a.campaignPriority !== b.campaignPriority) {
      return b.campaignPriority - a.campaignPriority;
    }
    return String(a.campaignId).localeCompare(String(b.campaignId));
  });
}

class Scheduler {
  constructor({
    renderer,
    campaigns,
    inactivityMs = DEFAULT_INACTIVITY_MS,
    onIdleTimeout,
    onRender,
    onClear,
  } = {}) {
    this.renderer = renderer;
    this.campaigns = Array.isArray(campaigns) ? campaigns : [];
    this.inactivityMs = inactivityMs;
    this.onIdleTimeout = onIdleTimeout;
    this.onRender = onRender;
    this.onClear = onClear;

    this.currentCampaign = null;
    this.currentIndex = 0;
    this.itemTimer = null;
    this.inactivityTimer = null;
  }

  log(msg) {
    console.log(`[SCHEDULER] ${msg}`);
  }

  setInactivityTimer() {
    this.clearInactivityTimer("reset");
    this.inactivityTimer = setTimeout(() => {
      this.log(`Inactivity timeout (${this.inactivityMs}ms) -> IDLE`);
      this.stopPlayback("inactivity-timeout");
      if (typeof this.onIdleTimeout === "function") this.onIdleTimeout();
    }, this.inactivityMs);
    this.log(`Inactivity timer started (${this.inactivityMs}ms)`);
  }

  clearInactivityTimer(reason) {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
      this.log(`Inactivity timer stopped (${reason})`);
    }
  }

  clearItemTimer(reason) {
    if (this.itemTimer) {
      clearTimeout(this.itemTimer);
      this.itemTimer = null;
      this.log(`Item timer stopped (${reason})`);
    }
  }

  selectCampaign() {
    const sorted = sortCampaignsDeterministic(this.campaigns);
    return sorted.length > 0 ? sorted[0] : null;
  }

  handleEvent(eventType) {
    if (eventType === "IDLE") {
      this.clearInactivityTimer("event IDLE");
      this.stopPlayback("event IDLE");
      return;
    }

    // Any non-IDLE event resets inactivity timeout.
    this.setInactivityTimer();

    const selected = this.selectCampaign();
    if (!selected) return;

    if (!this.currentCampaign) {
      this.startCampaign(selected, `start on ${eventType}`);
      return;
    }

    const currentPriority = this.currentCampaign.campaignPriority;
    const selectedPriority = selected.campaignPriority;

    if (selectedPriority > currentPriority) {
      this.startCampaign(selected, `preempt (priority ${currentPriority} -> ${selectedPriority})`);
      return;
    }

    if (eventType === "NFC_TAP") {
      this.startCampaign(selected, "restart on NFC_TAP");
    }
  }

  startCampaign(campaign, reason) {
    if (!campaign) return;
    this.stopPlayback(reason);
    this.currentCampaign = campaign;
    this.currentIndex = 0;
    this.log(`Start campaign ${campaign.campaignId} (priority ${campaign.campaignPriority}) [${reason}]`);
    this.renderCurrent();
  }

  stopPlayback(reason) {
    this.clearItemTimer(reason);
    if (this.currentCampaign) {
      this.log(`Stop campaign ${this.currentCampaign.campaignId} [${reason}]`);
    }
    this.currentCampaign = null;
    this.currentIndex = 0;
    if (this.renderer && typeof this.renderer.clear === "function") {
      this.renderer.clear();
    }
    if (typeof this.onClear === "function") {
      this.onClear({ reason });
    }
  }

  renderCurrent() {
    if (!this.currentCampaign) return;
    const items = this.currentCampaign.items || [];
    if (items.length === 0) return;

    if (this.currentIndex >= items.length) this.currentIndex = 0;
    const item = items[this.currentIndex];

    if (this.renderer && typeof this.renderer.render === "function") {
      this.renderer.render(item);
    }
    if (typeof this.onRender === "function") {
      this.onRender({
        item,
        campaignId: this.currentCampaign.campaignId,
        campaignName: this.currentCampaign.campaignName,
      });
    }

    const durationSec = Number.isFinite(item.durationSec) && item.durationSec > 0
      ? item.durationSec
      : DEFAULT_ITEM_DURATION_SEC;

    this.clearItemTimer("reschedule");
    this.itemTimer = setTimeout(() => {
      this.currentIndex += 1;
      this.renderCurrent();
    }, durationSec * 1000);

    this.log(`Item timer started (${durationSec}s) for ${item.type} ${item.contentId}`);
  }
}

module.exports = { Scheduler };
