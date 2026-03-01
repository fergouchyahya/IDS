/**
 * IDS Player — HTTP Server with runtime campaigns.
 */

const http = require("http");
const crypto = require("crypto");

const STATE = {
  IDLE: "IDLE",
  MENU: "MENU",
  VISITOR_INFO: "VISITOR_INFO",
  STUDENT_INFO: "STUDENT_INFO",
};

function sortItems(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function normalizeRuntimeConfig(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  // New runtime model from Admin.
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

  // Backward compatibility with old config examples.
  if (Array.isArray(input.campaigns)) {
    const byId = new Map(input.campaigns.map((c) => [c.campaignId, { ...c, items: sortItems(c.items) }]));
    const idleCampaign = byId.get("idle-welcome") || input.campaigns[0] || null;
    const menuCampaign = byId.get("menu-choices") || null;
    const visitorCampaign = byId.get("info-visitor") || null;

    if (!idleCampaign || !menuCampaign || !visitorCampaign) return null;

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

class PlayerStateMachine {
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
  }

  setRuntimeConfig(nextRuntime) {
    const normalized = normalizeRuntimeConfig(nextRuntime);
    if (!normalized) return false;

    const currentCampaignId = this.currentCampaign?.campaignId;
    this.runtime = normalized;
    this.inactivityTimeout = this.runtime.settings.inactivityTimeoutMs;

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

  getCurrentItem() {
    const items = this.currentCampaign?.items || [];
    if (items.length === 0) return null;
    if (this.currentItemIndex >= items.length) this.currentItemIndex = 0;
    if (this.currentItemIndex < 0) this.currentItemIndex = items.length - 1;
    return items[this.currentItemIndex];
  }

  transitionTo(state, campaign) {
    this.currentState = state;
    this.currentCampaign = campaign;
    this.currentItemIndex = 0;
  }

  transitionToIdle() {
    this.currentStudentUid = null;
    this.transitionTo(STATE.IDLE, this.runtime.idleCampaign);
  }

  transitionToMenu() {
    this.currentStudentUid = null;
    this.transitionTo(STATE.MENU, this.runtime.menuCampaign);
  }

  findStudentByUid(nfcUid) {
    const uid = String(nfcUid || "").trim();
    if (!uid) return null;
    return this.runtime.students.find((s) => s.nfcUid === uid) || null;
  }

  advance(offset) {
    const items = this.currentCampaign?.items || [];
    if (items.length <= 1) return false;
    this.currentItemIndex = (this.currentItemIndex + offset + items.length) % items.length;
    return true;
  }

  scheduleInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.currentState !== STATE.IDLE) {
      const remainingMs = Math.max(1, this.lastActivityAt + this.inactivityTimeout - Date.now());
      this.inactivityTimer = setTimeout(() => {
        console.log("[Player] Inactivity timeout -> returning to IDLE");
        this.transitionToIdle();
      }, remainingMs);
    }
  }

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
    } else if (normalized === "nfc_tap" && this.currentState === STATE.MENU) {
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

  stop() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = null;
  }
}

function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function html(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isMovementInputEvent(event) {
  const normalizedType = String(event?.type || "").toLowerCase();
  return normalizedType === "movement_detected" || normalizedType === "movement" || normalizedType === "vision_present";
}

function isDetectorAllowedEvent(eventType) {
  const normalizedType = String(eventType || "").toLowerCase();
  return normalizedType === "movement_detected"
    || normalizedType === "visitor_selected"
    || normalizedType === "scroll_next"
    || normalizedType === "scroll_prev";
}

function getStateVisualClass(state) {
  if (state === STATE.IDLE) return "state-idle";
  if (state === STATE.MENU) return "state-menu";
  return "state-info";
}

function renderHead(status) {
  const info = `${status.campaignName || "Unknown"} | item ${status.itemIndex + 1}`;
  return `
    <header class="head">
      <div class="state">${escapeHtml(status.state)}</div>
      <div class="sub">${escapeHtml(info)}</div>
    </header>
  `;
}

function renderMenuSurface(status, lines) {
  const prompt = lines[0] || "Choose your path";
  const helper = lines[1] || "Select Visitor or scan NFC";
  return `
    <section class="menu-surface">
      <div class="menu-copy">
        <h2>${escapeHtml(prompt)}</h2>
        <p>${escapeHtml(helper)}</p>
      </div>
      <div class="menu-grid">
        <button class="choice-card visitor-card" onclick="sendEvent({type:'visitor_selected'})">
          <span class="choice-kicker">Visitor</span>
          <span class="choice-title">Continue as visitor</span>
          <span class="choice-sub">Open visitor information campaign</span>
        </button>
        <div class="choice-card nfc-card">
          <span class="choice-kicker">Student</span>
          <span class="choice-title">Tap NFC card</span>
          <span class="choice-sub">Use UID in simulation mode</span>
          <div class="nfc-row">
            <input id="uid" placeholder="Enter NFC UID" aria-label="NFC UID" />
            <button class="nfc-submit" onclick="sendEvent({type:'nfc_tap', nfcUid: document.getElementById('uid').value})">Scan</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderViewport(status, item) {
  if (!item) {
    return `
      <section class="viewport-inner empty-state">
        <h2>No content available</h2>
        <p>Sync a campaign from Admin or check runtime configuration.</p>
      </section>
    `;
  }

  const lines = String(item.data || "").split("\n");
  const itemType = String(item.type || "TEXT").toUpperCase();

  if (status.state === STATE.MENU) {
    return renderMenuSurface(status, lines);
  }

  let mediaHtml = "";
  if (itemType === "VIDEO") {
    mediaHtml = `
      <div class="media-stage">
        <video id="idleVideo" class="media" src="${escapeHtml(item.data || "")}" autoplay muted playsinline controls></video>
      </div>
    `;
  } else if (itemType === "IMAGE") {
    mediaHtml = `
      <div class="media-stage">
        <img class="media" src="${escapeHtml(item.data || "")}" alt="Campaign media" />
      </div>
    `;
  } else {
    mediaHtml = `
      <div class="text-stage">
        ${lines.map((line, idx) => (idx === 0
    ? `<h2>${escapeHtml(line || " ")}</h2>`
    : `<p>${escapeHtml(line)}</p>`)).join("")}
      </div>
    `;
  }

  const guidance = status.state === STATE.IDLE
    ? `<div class="guidance-chip">Move to start</div>`
    : "";
  const controls = status.state === STATE.IDLE
    ? ""
    : `
      <div class="control-rail">
        <button class="control-btn" onclick="sendEvent({type:'scroll_prev'})">Previous</button>
        <button class="control-btn" onclick="sendEvent({type:'scroll_next'})">Next</button>
      </div>
    `;

  return `
    <section class="viewport-inner">
      ${mediaHtml}
      ${guidance}
      ${controls}
    </section>
  `;
}

function renderFooter(status) {
  return `
    <footer class="foot">
      <span>Inactivity timeout: ${Number(status.inactivityTimeoutMs)}ms</span>
    </footer>
  `;
}

function renderDebugPanel(status, forceDebug) {
  return `
    <aside id="debugPanel" class="debug-panel${forceDebug ? " visible" : ""}">
      <h3>Player Debug</h3>
      <dl>
        <dt>State</dt><dd>${escapeHtml(status.state)}</dd>
        <dt>Campaign ID</dt><dd>${escapeHtml(status.campaignId || "n/a")}</dd>
        <dt>Campaign</dt><dd>${escapeHtml(status.campaignName || "n/a")}</dd>
        <dt>Item Index</dt><dd>${Number(status.itemIndex)}</dd>
        <dt>Inactivity</dt><dd>${Number(status.inactivityTimeoutMs)}ms</dd>
        <dt>Updated At</dt><dd>${escapeHtml(status.runtimeUpdatedAt || "n/a")}</dd>
      </dl>
    </aside>
  `;
}

function renderUI(sm, options = {}) {
  const status = sm.getStatus();
  const item = status.item;
  const itemType = String(item?.type || "TEXT").toUpperCase();
  const durationSec = Number.isInteger(item?.durationSec) && item.durationSec > 0 ? item.durationSec : 12;
  const stateClass = getStateVisualClass(status.state);
  const forceDebug = options.forceDebug === true;
  const detectorToken = String(options.detectorToken || "");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IDS Player</title>
  <style>
    :root {
      --bg-0: #070d18;
      --bg-1: #0f1b2f;
      --panel: rgba(255, 255, 255, 0.08);
      --panel-strong: rgba(255, 255, 255, 0.12);
      --text-primary: #f8fbff;
      --text-secondary: #b9c7dd;
      --border-soft: rgba(255, 255, 255, 0.18);
      --accent-idle: #2dd4bf;
      --accent-menu: #60a5fa;
      --accent-info: #34d399;
      --shadow-soft: 0 22px 60px rgba(0, 0, 0, 0.35);
      --ease: 180ms ease;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; min-height: 100%; }
    body {
      font-family: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--text-primary);
      background:
        radial-gradient(1200px 650px at 0% 0%, rgba(96, 165, 250, 0.12), transparent 62%),
        radial-gradient(1000px 550px at 100% 100%, rgba(45, 212, 191, 0.10), transparent 60%),
        linear-gradient(160deg, var(--bg-0), var(--bg-1));
      overflow-x: hidden;
    }
    body::after {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(circle at center, transparent 28%, rgba(0, 0, 0, 0.35) 100%);
    }

    .wrap {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      position: relative;
      isolation: isolate;
    }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 14px;
      padding: 20px 28px;
      border-bottom: 1px solid var(--border-soft);
      backdrop-filter: blur(8px);
      background: rgba(8, 14, 24, 0.45);
    }

    .state {
      font-size: clamp(22px, 3vw, 34px);
      line-height: 1.1;
      letter-spacing: 0.01em;
      font-weight: 700;
    }

    .sub {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .state-idle .state { color: var(--accent-idle); }
    .state-menu .state { color: var(--accent-menu); }
    .state-info .state { color: var(--accent-info); }

    .viewport {
      padding: clamp(16px, 2.2vw, 28px);
      display: grid;
      place-items: center;
    }

    .viewport-inner {
      width: min(1300px, 98%);
      min-height: min(72vh, 820px);
      border: 1px solid var(--border-soft);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
      border-radius: 18px;
      box-shadow: var(--shadow-soft);
      padding: clamp(18px, 2.8vw, 34px);
      position: relative;
      display: grid;
      place-items: center;
      text-align: center;
      animation: surfaceIn var(--ease);
    }

    .viewport-inner::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 44%;
      border-radius: 0 0 18px 18px;
      background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.3));
      pointer-events: none;
    }

    .media-stage, .text-stage {
      position: relative;
      z-index: 2;
      width: 100%;
    }

    .media {
      width: min(100%, 1200px);
      max-height: 64vh;
      border-radius: 14px;
      object-fit: contain;
      box-shadow: 0 14px 42px rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(0, 0, 0, 0.16);
    }

    .text-stage h2 {
      margin: 0 0 12px 0;
      font-size: clamp(34px, 6vw, 68px);
      line-height: 1.1;
      letter-spacing: -0.01em;
    }

    .text-stage p {
      margin: 6px 0;
      color: #d9e5f7;
      font-size: clamp(20px, 2.5vw, 34px);
      line-height: 1.35;
    }

    .guidance-chip {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      padding: 9px 14px;
      border-radius: 999px;
      border: 1px solid var(--border-soft);
      background: rgba(6, 10, 16, 0.55);
      color: #deebff;
      font-size: 12px;
      z-index: 3;
    }

    .menu-surface {
      width: 100%;
      position: relative;
      z-index: 2;
      text-align: left;
    }

    .menu-copy h2 {
      margin: 0;
      font-size: clamp(34px, 5.5vw, 56px);
      line-height: 1.1;
      letter-spacing: -0.01em;
    }

    .menu-copy p {
      margin: 8px 0 0 0;
      color: var(--text-secondary);
      font-size: clamp(15px, 2vw, 19px);
    }

    .menu-grid {
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .choice-card {
      text-align: left;
      width: 100%;
      border-radius: 16px;
      border: 1px solid var(--border-soft);
      background: linear-gradient(165deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
      padding: 18px;
      transition: transform var(--ease), box-shadow var(--ease), border-color var(--ease);
    }

    button.choice-card {
      cursor: pointer;
      color: inherit;
      font: inherit;
    }

    .choice-card:hover, .choice-card:focus-within {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.35);
      box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
    }

    .choice-kicker {
      display: inline-flex;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.16);
      color: #dce9ff;
    }

    .choice-title {
      display: block;
      margin-top: 12px;
      font-weight: 700;
      font-size: clamp(24px, 3.2vw, 34px);
      line-height: 1.1;
      letter-spacing: -0.01em;
    }

    .choice-sub {
      display: block;
      margin-top: 8px;
      color: var(--text-secondary);
      font-size: 14px;
    }

    .nfc-row {
      margin-top: 14px;
      display: flex;
      gap: 8px;
      align-items: center;
    }

    input, button {
      font: inherit;
    }

    .nfc-row input {
      flex: 1;
      min-width: 120px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border-soft);
      background: rgba(9, 14, 23, 0.5);
      color: var(--text-primary);
    }

    .nfc-row input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.42);
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
    }

    .nfc-submit, .control-btn {
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid transparent;
      font-weight: 650;
      cursor: pointer;
      background: #d9e8ff;
      color: #0b2344;
      transition: transform var(--ease), background var(--ease), box-shadow var(--ease);
    }

    .nfc-submit:hover, .control-btn:hover {
      transform: translateY(-1px);
      background: #e8f1ff;
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }

    .control-rail {
      margin-top: 14px;
      position: relative;
      z-index: 3;
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .empty-state h2 {
      margin: 0;
      font-size: 36px;
      line-height: 1.15;
    }

    .empty-state p {
      margin: 12px 0 0;
      color: var(--text-secondary);
      font-size: 16px;
    }

    .foot {
      padding: 10px 24px;
      color: var(--text-secondary);
      border-top: 1px solid var(--border-soft);
      backdrop-filter: blur(8px);
      background: rgba(8, 14, 24, 0.35);
      font-size: 12px;
    }

    .debug-panel {
      position: fixed;
      right: 14px;
      top: 14px;
      z-index: 20;
      width: min(330px, calc(100vw - 28px));
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.24);
      background: rgba(4, 8, 14, 0.78);
      color: #dbeafe;
      padding: 12px;
      backdrop-filter: blur(8px);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.34);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-6px);
      transition: opacity var(--ease), transform var(--ease);
    }

    .debug-panel.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .debug-panel h3 {
      margin: 0 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #93c5fd;
    }

    .debug-panel dl {
      margin: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 8px;
      font-size: 12px;
    }

    .debug-panel dt {
      color: #93a8c7;
    }

    .debug-panel dd {
      margin: 0;
      text-align: right;
      font-weight: 600;
      word-break: break-word;
    }

    .movement-widget {
      position: fixed;
      left: 14px;
      bottom: 14px;
      z-index: 18;
      width: min(260px, calc(100vw - 28px));
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.24);
      background: rgba(5, 10, 18, 0.78);
      backdrop-filter: blur(8px);
      box-shadow: 0 12px 26px rgba(0, 0, 0, 0.34);
      padding: 10px;
      overflow: hidden;
    }

    .movement-head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #dbeafe;
      margin-bottom: 8px;
    }

    .movement-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: #64748b;
      box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.2);
      transition: background var(--ease), box-shadow var(--ease);
    }

    .movement-dot.active {
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
    }

    .movement-cam {
      width: 100%;
      height: 130px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: #020617;
      transform: scaleX(-1);
    }

    .movement-toast {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(34, 197, 94, 0.18);
      border: 1px solid rgba(34, 197, 94, 0.32);
      color: #dcfce7;
      font-size: 12px;
      text-align: center;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity var(--ease), transform var(--ease);
      pointer-events: none;
    }

    .movement-toast.visible {
      opacity: 1;
      transform: translateY(0);
    }

    @keyframes surfaceIn {
      from { opacity: 0; transform: translateY(8px) scale(0.995); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (max-width: 920px) {
      .menu-grid {
        grid-template-columns: 1fr;
      }
      .head {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    @media (max-width: 640px) {
      .viewport {
        padding: 12px;
      }
      .viewport-inner {
        min-height: 68vh;
        padding: 16px;
        border-radius: 14px;
      }
      .media {
        max-height: 56vh;
      }
      .nfc-row {
        flex-direction: column;
        align-items: stretch;
      }
      .movement-widget {
        width: min(210px, calc(100vw - 24px));
      }
      .movement-cam {
        height: 102px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    }
  </style>
</head>
<body class="player-body ${stateClass}">
  <div class="wrap">
    ${renderHead(status)}
    <main class="viewport">${renderViewport(status, item)}</main>
    ${renderFooter(status)}
  </div>
  <aside class="movement-widget">
    <div class="movement-head">
      <span id="movementDot" class="movement-dot"></span>
      <span id="movementStatus">Detector booting...</span>
    </div>
    <video id="movementCam" class="movement-cam" autoplay muted playsinline></video>
    <div id="movementToast" class="movement-toast">Movement detected</div>
  </aside>
  ${renderDebugPanel(status, forceDebug)}
  <script>
    function sendEvent(payload) {
      fetch('/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(() => location.reload());
    }

    function scheduleIdleAutoScroll() {
      if (${JSON.stringify(status.state)} !== 'IDLE') return;
      if (${JSON.stringify(Boolean(item))} !== true) return;

      const eventPayload = { type: 'scroll_next', source: 'auto_idle' };
      const currentType = ${JSON.stringify(itemType)};

      if (currentType === 'VIDEO') {
        const video = document.getElementById('idleVideo');
        if (!video) return;
        video.addEventListener('ended', () => sendEvent(eventPayload), { once: true });
        return;
      }

      const waitMs = ${durationSec * 1000};
      setTimeout(() => sendEvent(eventPayload), waitMs);
    }

    function initDebugPanel() {
      const panel = document.getElementById('debugPanel');
      if (!panel) return;

      const forced = ${JSON.stringify(forceDebug)};
      let isVisible = forced;

      function sync() {
        panel.classList.toggle('visible', isVisible);
      }

      sync();

      document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() !== 'd') return;
        const tag = (event.target && event.target.tagName) ? event.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea') return;
        isVisible = !isVisible;
        sync();
      });
    }

    async function initMovementDetector() {
      const token = ${JSON.stringify(detectorToken)};
      const currentState = ${JSON.stringify(status.state)};
      const camEl = document.getElementById('movementCam');
      const dotEl = document.getElementById('movementDot');
      const statusEl = document.getElementById('movementStatus');
      const toastEl = document.getElementById('movementToast');
      if (!token || !camEl || !dotEl || !statusEl || !toastEl) return;

      function setDetectorUi(active, label) {
        dotEl.classList.toggle('active', Boolean(active));
        statusEl.textContent = label;
      }

      function showMovementToast() {
        toastEl.classList.add('visible');
        setTimeout(() => toastEl.classList.remove('visible'), 1400);
      }

      async function sendDetectorEvent(type, extra = {}) {
        await fetch('/detector/events', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-detector-token': token
          },
          body: JSON.stringify({ type, source: 'motion_detector', ...extra })
        });
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setDetectorUi(false, 'Camera API unavailable');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 180 }, frameRate: { ideal: 10, max: 12 } },
          audio: false
        });
        camEl.srcObject = stream;
      } catch (e) {
        setDetectorUi(false, 'Camera blocked');
        return;
      }

      const hiddenCanvas = document.createElement('canvas');
      const ctx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
      let lastFrame = null;
      let backgroundFrame = null;
      let lastAnalysisAt = 0;
      let lastDetectedAt = 0;
      let presenceStreak = 0;
      let handMoveStreak = 0;
      let rightHandStreak = 0;
      let leftHandStreak = 0;
      const analyzeEveryMs = 120;
      const movementPixelThreshold = 22;
      const foregroundDeltaThreshold = 20;
      const backgroundAlpha = 0.05;
      const minPresenceRatio = 0.035;
      const minPresenceBoxRatio = 0.10;
      const maxPresenceBoxRatio = 0.72;
      const minSideMotionPixels = 24;
      const cooldownByEvent = {
        movement_detected: 1700,
        visitor_selected: 800,
        scroll_next: 460,
        scroll_prev: 460,
      };
      const mirrorHandedness = true;

      function analyze(now) {
        if (!camEl.videoWidth || !camEl.videoHeight) {
          requestAnimationFrame(analyze);
          return;
        }

        if (now - lastAnalysisAt < analyzeEveryMs) {
          requestAnimationFrame(analyze);
          return;
        }
        lastAnalysisAt = now;

        hiddenCanvas.width = 96;
        hiddenCanvas.height = 54;
        ctx.drawImage(camEl, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        const frame = ctx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height).data;

        if (!lastFrame || !backgroundFrame) {
          lastFrame = frame;
          backgroundFrame = frame.slice();
          setDetectorUi(false, 'Watching for movement...');
          requestAnimationFrame(analyze);
          return;
        }

        let changed = 0;
        let samples = 0;
        let leftChanged = 0;
        let rightChanged = 0;
        let foregroundPixels = 0;
        let minX = hiddenCanvas.width;
        let minY = hiddenCanvas.height;
        let maxX = -1;
        let maxY = -1;

        for (let i = 0; i < frame.length; i += 16) {
          const pixelIndex = i / 4;
          const x = pixelIndex % hiddenCanvas.width;
          const y = Math.floor(pixelIndex / hiddenCanvas.width);

          const dr = Math.abs(frame[i] - lastFrame[i]);
          const dg = Math.abs(frame[i + 1] - lastFrame[i + 1]);
          const db = Math.abs(frame[i + 2] - lastFrame[i + 2]);
          const delta = (dr + dg + db) / 3;

          if (delta > movementPixelThreshold) {
            changed += 1;
            if (x < hiddenCanvas.width / 2) leftChanged += 1;
            else rightChanged += 1;
          }

          const bdr = Math.abs(frame[i] - backgroundFrame[i]);
          const bdg = Math.abs(frame[i + 1] - backgroundFrame[i + 1]);
          const bdb = Math.abs(frame[i + 2] - backgroundFrame[i + 2]);
          const bgDelta = (bdr + bdg + bdb) / 3;
          const isForeground = bgDelta > foregroundDeltaThreshold;
          if (isForeground) {
            foregroundPixels += 1;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          } else {
            backgroundFrame[i] = Math.round(backgroundFrame[i] * (1 - backgroundAlpha) + frame[i] * backgroundAlpha);
            backgroundFrame[i + 1] = Math.round(backgroundFrame[i + 1] * (1 - backgroundAlpha) + frame[i + 1] * backgroundAlpha);
            backgroundFrame[i + 2] = Math.round(backgroundFrame[i + 2] * (1 - backgroundAlpha) + frame[i + 2] * backgroundAlpha);
          }

          samples += 1;
        }

        const presenceRatio = samples > 0 ? foregroundPixels / samples : 0;
        let presenceBoxRatio = 0;
        if (foregroundPixels > 0 && maxX >= minX && maxY >= minY) {
          const boxArea = (maxX - minX + 1) * (maxY - minY + 1);
          presenceBoxRatio = boxArea / (hiddenCanvas.width * hiddenCanvas.height);
        }

        const hasPresence = presenceRatio >= minPresenceRatio
          && presenceBoxRatio >= minPresenceBoxRatio
          && presenceBoxRatio <= maxPresenceBoxRatio;
        if (hasPresence) presenceStreak += 1;
        else presenceStreak = Math.max(0, presenceStreak - 1);

        const hasAnyHandMotion = changed >= minSideMotionPixels;
        if (hasAnyHandMotion) handMoveStreak += 1;
        else handMoveStreak = Math.max(0, handMoveStreak - 1);

        const dominantLeft = leftChanged >= minSideMotionPixels && leftChanged > rightChanged * 1.15;
        const dominantRight = rightChanged >= minSideMotionPixels && rightChanged > leftChanged * 1.15;
        const rightHandDetected = mirrorHandedness ? dominantLeft : dominantRight;
        const leftHandDetected = mirrorHandedness ? dominantRight : dominantLeft;

        if (rightHandDetected) {
          rightHandStreak += 1;
          leftHandStreak = Math.max(0, leftHandStreak - 1);
        } else if (leftHandDetected) {
          leftHandStreak += 1;
          rightHandStreak = Math.max(0, rightHandStreak - 1);
        } else {
          rightHandStreak = Math.max(0, rightHandStreak - 1);
          leftHandStreak = Math.max(0, leftHandStreak - 1);
        }

        let eventType = null;
        let detectorLabel = 'Watching for movement...';
        let handSide = null;

        if (currentState === 'IDLE') {
          if (presenceStreak >= 3) {
            eventType = 'movement_detected';
            detectorLabel = 'Presence detected';
          } else {
            detectorLabel = 'Waiting for presence';
          }
        } else if (currentState === 'MENU') {
          if (handMoveStreak >= 2) {
            eventType = 'visitor_selected';
            detectorLabel = 'Hand movement detected';
          }
        } else if (currentState === 'VISITOR_INFO' || currentState === 'STUDENT_INFO') {
          if (rightHandDetected && rightHandStreak >= 2) {
            eventType = 'scroll_next';
            handSide = 'right';
            detectorLabel = 'Right hand -> next';
          } else if (leftHandDetected && leftHandStreak >= 2) {
            eventType = 'scroll_prev';
            handSide = 'left';
            detectorLabel = 'Left hand -> previous';
          }
        }

        if (eventType) {
          const eventCooldownMs = cooldownByEvent[eventType] || 900;
          const inCooldown = now - lastDetectedAt < eventCooldownMs;
          if (!inCooldown) {
            lastDetectedAt = now;
            setDetectorUi(true, detectorLabel);
            showMovementToast();
            sendDetectorEvent(eventType, {
              confidence: Number(presenceRatio.toFixed(3)),
              direction: handSide,
              handSide,
            }).catch(() => {
              setDetectorUi(false, 'Detector event failed');
            });
            handMoveStreak = 0;
            rightHandStreak = 0;
            leftHandStreak = 0;
          }
        } else {
          setDetectorUi(false, detectorLabel);
        }

        lastFrame = frame;
        requestAnimationFrame(analyze);
      }

      requestAnimationFrame(analyze);
    }

    scheduleIdleAutoScroll();
    initDebugPanel();
    initMovementDetector();

    setInterval(() => {
      fetch('/current').then((r) => r.json()).then((next) => {
        if (next.state !== ${JSON.stringify(status.state)} || next.itemIndex !== ${JSON.stringify(status.itemIndex)}) {
          location.reload();
        }
      }).catch(() => {});
    }, 1000);
  </script>
</body>
</html>`;
}

async function pullRuntimeConfig(adminUrl) {
  const res = await fetch(`${adminUrl.replace(/\/$/, "")}/runtime-config`);
  if (!res.ok) throw new Error(`runtime-config fetch failed: ${res.status}`);
  return res.json();
}

function createServer({ config, port = 7070, adminUrl, syncIntervalMs = 4000 } = {}) {
  const sm = new PlayerStateMachine(config);
  const detectorToken = crypto.randomBytes(18).toString("hex");

  let syncTimer = null;

  async function syncFromAdmin() {
    if (!adminUrl) return;
    try {
      const runtime = await pullRuntimeConfig(adminUrl);
      sm.setRuntimeConfig(runtime);
    } catch (e) {
      console.warn(`[Player] Runtime sync failed: ${e.message}`);
    }
  }

  sm.scheduleInactivityTimer();
  if (adminUrl) {
    syncFromAdmin();
    syncTimer = setInterval(syncFromAdmin, syncIntervalMs);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return html(res, 200, renderUI(sm, {
        forceDebug: url.searchParams.get("debug") === "1",
        detectorToken,
      }));
    }

    if (req.method === "GET" && url.pathname === "/current") {
      return json(res, 200, sm.getStatus());
    }

    if (req.method === "POST" && url.pathname === "/events") {
      let event;
      try {
        event = await readJsonBody(req);
      } catch (e) {
        return json(res, 400, { error: e.message });
      }

      if (isMovementInputEvent(event)) {
        return json(res, 403, {
          error: "movement_event_requires_detector",
          hint: "Use detector endpoint with authenticated detector token.",
        });
      }

      if (adminUrl) await syncFromAdmin();
      return json(res, 200, sm.handleEvent(event));
    }

    if (req.method === "POST" && url.pathname === "/detector/movement") {
      const incomingToken = String(req.headers["x-detector-token"] || "");
      if (!incomingToken || incomingToken !== detectorToken) {
        return json(res, 403, { error: "forbidden_detector_source" });
      }

      let payload;
      try {
        payload = await readJsonBody(req);
      } catch (e) {
        return json(res, 400, { error: e.message });
      }

      if (adminUrl) await syncFromAdmin();
      const event = {
        type: "movement_detected",
        source: "motion_detector",
        confidence: Number(payload?.confidence) || undefined,
      };
      return json(res, 200, sm.handleEvent(event));
    }

    if (req.method === "POST" && url.pathname === "/detector/events") {
      const incomingToken = String(req.headers["x-detector-token"] || "");
      if (!incomingToken || incomingToken !== detectorToken) {
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

      if (adminUrl) await syncFromAdmin();
      const event = {
        type: eventType,
        source: "motion_detector",
        confidence: Number(payload?.confidence) || undefined,
        direction: payload?.direction,
      };
      return json(res, 200, sm.handleEvent(event));
    }

    if (req.method === "POST" && url.pathname === "/runtime-config") {
      let runtime;
      try {
        runtime = await readJsonBody(req);
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
      const ok = sm.setRuntimeConfig(runtime);
      if (!ok) return json(res, 400, { error: "invalid_runtime_config" });
      return json(res, 200, { status: "ok", current: sm.getStatus() });
    }

    return json(res, 404, { error: "not_found" });
  });

  server.on("close", () => {
    sm.stop();
    if (syncTimer) clearInterval(syncTimer);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[Player] Listening on http://127.0.0.1:${port}`);
    console.log("[Player] Flow: IDLE -> movement_detected -> MENU -> (visitor_selected|nfc_tap) -> INFO -> inactivity -> IDLE");
    if (adminUrl) console.log(`[Player] Runtime sync from ${adminUrl}/runtime-config`);
  });

  return server;
}

module.exports = {
  createServer,
  PlayerStateMachine,
  STATE,
  normalizeRuntimeConfig,
  renderUI,
  isMovementInputEvent,
  isDetectorAllowedEvent,
};
