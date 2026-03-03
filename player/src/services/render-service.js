/**
 * Player HTML rendering service.
 *
 * Responsibilities:
 * - Render page shell and state UI.
 * - Render menu, media and text views.
 * - Inject client runtime scripts.
 */

const { escapeHtml } = require("../../../shared/utils/http-helpers");
const { normalizeDetectorConfig, STATE } = require("./config-service");
const { buildDetectorClientScript } = require("../detector/client-script");

/**
 * Shared inline CSS for player page.
 */
const PLAYER_PAGE_STYLES = `
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
`;

/**
 * Returns CSS class for a state-specific accent style.
 *
 * @param {string} state - Current runtime state.
 * @returns {string} CSS class name.
 */
function getStateVisualClass(state) {
  if (state === STATE.IDLE) return "state-idle";
  if (state === STATE.MENU) return "state-menu";
  return "state-info";
}

/**
 * Renders top header with current state and campaign info.
 *
 * @param {object} status - State status payload.
 * @returns {string} HTML fragment.
 */
function renderHead(status) {
  const info = `${status.campaignName || "Unknown"} | item ${status.itemIndex + 1}`;
  return `
    <header class="head">
      <div class="state">${escapeHtml(status.state)}</div>
      <div class="sub">${escapeHtml(info)}</div>
    </header>
  `;
}

/**
 * Renders menu choice surface.
 *
 * @param {object} status - State status payload.
 * @param {Array<string>} lines - Content lines.
 * @returns {string} HTML fragment.
 */
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

/**
 * Renders current content viewport.
 *
 * @param {object} status - State status payload.
 * @param {object|null} item - Active campaign item.
 * @returns {string} HTML fragment.
 */
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

/**
 * Renders footer with timeout details.
 *
 * @param {object} status - State status payload.
 * @returns {string} HTML fragment.
 */
function renderFooter(status) {
  return `
    <footer class="foot">
      <span>Inactivity timeout: ${Number(status.inactivityTimeoutMs)}ms</span>
    </footer>
  `;
}

/**
 * Renders hidden/visible debug side panel.
 *
 * @param {object} status - State status payload.
 * @param {boolean} forceDebug - Whether panel is initially visible.
 * @returns {string} HTML fragment.
 */
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

/**
 * Builds non-detector client script used for interaction and live refresh.
 *
 * @param {object} options - Script options.
 * @param {object} options.status - State status payload.
 * @param {object|null} options.item - Current item.
 * @param {string} options.itemType - Current item type.
 * @param {number} options.durationSec - Current item duration in seconds.
 * @param {boolean} options.forceDebug - Whether debug starts visible.
 * @returns {string} JavaScript source code.
 */
function buildMainClientScript({ status, item, itemType, durationSec, forceDebug }) {
  return `
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

    scheduleIdleAutoScroll();
    initDebugPanel();

    setInterval(() => {
      fetch('/current').then((r) => r.json()).then((next) => {
        if (next.state !== ${JSON.stringify(status.state)} || next.itemIndex !== ${JSON.stringify(status.itemIndex)}) {
          location.reload();
        }
      }).catch(() => {});
    }, 1000);
  `;
}

/**
 * Renders full HTML page for the current state machine status.
 *
 * @param {object} stateMachine - Player state machine instance.
 * @param {object} [options={}] - Render options.
 * @param {boolean} [options.forceDebug=false] - Initial debug panel visibility.
 * @param {string} [options.detectorToken=""] - Detector endpoint token.
 * @param {object} [options.detectorConfig] - Detector config override.
 * @returns {string} Complete HTML document.
 */
function renderUI(stateMachine, options = {}) {
  const status = stateMachine.getStatus();
  const item = status.item;
  const itemType = String(item?.type || "TEXT").toUpperCase();
  const durationSec = Number.isInteger(item?.durationSec) && item.durationSec > 0 ? item.durationSec : 12;
  const stateClass = getStateVisualClass(status.state);
  const forceDebug = options.forceDebug === true;
  const detectorToken = String(options.detectorToken || "");
  const detectorConfig = normalizeDetectorConfig(options.detectorConfig);

  const mainClientScript = buildMainClientScript({
    status,
    item,
    itemType,
    durationSec,
    forceDebug,
  });
  const detectorClientScript = buildDetectorClientScript({
    detectorToken,
    currentState: status.state,
    detectorConfig,
  });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IDS Player</title>
  <style>${PLAYER_PAGE_STYLES}</style>
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
${mainClientScript}
${detectorClientScript}
  </script>
</body>
</html>`;
}

module.exports = {
  renderUI,
  getStateVisualClass,
  renderHead,
  renderMenuSurface,
  renderViewport,
  renderFooter,
  renderDebugPanel,
};
