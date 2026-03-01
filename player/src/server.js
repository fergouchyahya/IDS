/**
 * IDS Player — HTTP Server with runtime campaigns.
 */

const http = require("http");

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

function renderUI(sm) {
  const status = sm.getStatus();
  const item = status.item;

  if (!item) {
    return "<!doctype html><html><body><h1>No content item available</h1></body></html>";
  }

  const lines = String(item.data || "").split("\n");
  const itemType = String(item.type || "TEXT").toUpperCase();
  const durationSec = Number.isInteger(item.durationSec) && item.durationSec > 0 ? item.durationSec : 12;
  const info = `${status.campaignName || "Unknown"} | item ${status.itemIndex + 1}`;

  const renderNonMenuContent = () => {
    if (itemType === "VIDEO") {
      return `
        <div class="content media-content">
          <video id="idleVideo" class="media" src="${escapeHtml(item.data || "")}" autoplay muted playsinline controls></video>
        </div>
      `;
    }

    if (itemType === "IMAGE") {
      return `
        <div class="content media-content">
          <img class="media" src="${escapeHtml(item.data || "")}" alt="Campaign media" />
        </div>
      `;
    }

    return `<div class="content">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`;
  };

  const content = status.state === STATE.MENU
    ? `
      <div class="menu">
        <h2>${escapeHtml(lines[0] || "Student or Visitor?")}</h2>
        <div class="row">
          <button onclick="sendEvent({type:'visitor_selected'})">Visitor</button>
          <input id="uid" placeholder="NFC UID" />
          <button onclick="sendEvent({type:'nfc_tap', nfcUid: document.getElementById('uid').value})">NFC Tap</button>
        </div>
      </div>
    `
    : `
      ${renderNonMenuContent()}
      <div class="row">
        <button onclick="sendEvent({type:'scroll_prev'})">Scroll Prev</button>
        <button onclick="sendEvent({type:'scroll_next'})">Scroll Next</button>
      </div>
    `;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IDS Player</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0e1c2f; color: #fff; }
    .wrap { min-height: 100vh; display: flex; flex-direction: column; }
    .head { padding: 16px; background: #182d4c; border-bottom: 1px solid #2a4a77; }
    .state { font-size: 32px; color: #4ce09f; font-weight: 700; }
    .sub { font-size: 13px; opacity: 0.8; }
    .center { flex: 1; display: grid; place-items: center; padding: 24px; text-align: center; }
    .content { font-size: 46px; line-height: 1.4; }
    .media-content { width: 100%; }
    .media {
      max-width: min(96vw, 1200px);
      max-height: 68vh;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
    }
    .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 16px; }
    button, input { font: inherit; padding: 10px 14px; border-radius: 8px; border: none; }
    button { background: #4ce09f; color: #021; font-weight: 700; cursor: pointer; }
    input { min-width: 220px; }
    .foot { padding: 8px 16px; background: #182d4c; border-top: 1px solid #2a4a77; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="state">${escapeHtml(status.state)}</div>
      <div class="sub">${escapeHtml(info)}</div>
    </div>
    <div class="center">${content}</div>
    <div class="foot">Inactivity timeout: ${status.inactivityTimeoutMs}ms</div>
  </div>
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

    scheduleIdleAutoScroll();

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
      return html(res, 200, renderUI(sm));
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

      if (adminUrl) await syncFromAdmin();
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

module.exports = { createServer, PlayerStateMachine, STATE, normalizeRuntimeConfig };
