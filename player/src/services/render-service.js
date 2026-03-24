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
      --bg-0: #1a1f33;
      --bg-1: #282d46;
      --panel: rgba(255, 255, 255, 0.08);
      --panel-strong: rgba(255, 255, 255, 0.12);
      --text-primary: #f0f1f6;
      --text-secondary: #cacde0;
      --border-soft: rgba(255, 255, 255, 0.15);
      --accent-idle: #009cdd;
      --accent-menu: #009cdd;
      --accent-info: #00b8d4;
      --polytech-primary: #282d46;
      --polytech-secondary: #009cdd;
      --shadow-soft: 0 22px 60px rgba(0, 0, 0, 0.4);
      --ease: 180ms ease;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; min-height: 100%; }
    body {
      font-family: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--text-primary);
      background:
        radial-gradient(1200px 650px at 0% 0%, rgba(0, 156, 221, 0.14), transparent 62%),
        radial-gradient(1000px 550px at 100% 100%, rgba(0, 156, 221, 0.08), transparent 60%),
        linear-gradient(160deg, var(--bg-0), var(--bg-1));
      overflow-x: hidden;
      opacity: 0;
      transition: opacity 350ms ease;
    }
    body.visible {
      opacity: 1;
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
      align-items: center;
      gap: 14px;
      padding: 14px 28px;
      border-bottom: 1px solid var(--border-soft);
      backdrop-filter: blur(8px);
      background: rgba(30, 35, 56, 0.65);
    }

    .head-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .head-logo {
      width: 42px;
      height: 42px;
      border-radius: 8px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .head-title {
      font-size: clamp(16px, 2.2vw, 22px);
      font-weight: 700;
      letter-spacing: 0.01em;
      line-height: 1.2;
    }

    .head-title small {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-secondary);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-top: 2px;
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

    .head-debug {
      font-size: 12px;
      color: var(--text-secondary);
      text-align: right;
    }

    .state-idle .state { color: var(--polytech-secondary); }
    .state-menu .state { color: var(--polytech-secondary); }
    .state-info .state { color: #00b8d4; }

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
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 28px;
      border-radius: 999px;
      border: 1px solid rgba(0, 156, 221, 0.3);
      background: rgba(0, 156, 221, 0.1);
      color: #d0e7ff;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.02em;
      z-index: 3;
      animation: guidancePulse 2.5s ease-in-out infinite;
    }

    .guidance-chip svg {
      vertical-align: -2px;
      margin-right: 6px;
    }

    @keyframes guidancePulse {
      0%, 100% { opacity: 0.85; box-shadow: 0 0 0 0 rgba(0, 156, 221, 0); }
      50% { opacity: 1; box-shadow: 0 0 0 10px rgba(0, 156, 221, 0.08); }
    }

    /* ── Info state: student banner ── */
    .student-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 20px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(0, 156, 221, 0.15), rgba(0, 156, 221, 0.05));
      border: 1px solid rgba(0, 156, 221, 0.2);
      margin-bottom: 18px;
      z-index: 2;
      position: relative;
    }

    .student-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--polytech-secondary), #006899);
      display: grid;
      place-items: center;
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .student-meta {
      flex: 1;
      text-align: left;
    }

    .student-meta strong {
      display: block;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.2;
    }

    .student-meta span {
      font-size: 13px;
      color: var(--text-secondary);
    }

    /* ── Progress dots ── */
    .progress-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      position: relative;
      z-index: 3;
    }

    .progress-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.18);
      transition: background 250ms ease, transform 250ms ease, box-shadow 250ms ease;
    }

    .progress-dot.active {
      background: var(--polytech-secondary);
      transform: scale(1.3);
      box-shadow: 0 0 0 4px rgba(0, 156, 221, 0.15);
    }

    .progress-label {
      font-size: 12px;
      color: var(--text-secondary);
      margin-left: 8px;
    }

    /* ── Back to menu hint ── */
    .back-hint {
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 5;
      padding: 8px 14px;
      border-radius: 10px;
      background: rgba(6, 10, 16, 0.5);
      border: 1px solid var(--border-soft);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: color var(--ease), border-color var(--ease);
    }

    .back-hint:hover {
      color: var(--text-primary);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .back-hint svg {
      vertical-align: -2px;
      margin-right: 4px;
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
      border-radius: 18px;
      border: 1px solid var(--border-soft);
      background: linear-gradient(165deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
      padding: 28px 24px;
      transition: transform var(--ease), box-shadow var(--ease), border-color var(--ease);
    }

    .choice-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 14px;
      margin-bottom: 14px;
    }

    .visitor-card .choice-icon {
      background: rgba(0, 184, 212, 0.12);
    }

    .nfc-card .choice-icon {
      background: rgba(0, 156, 221, 0.12);
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

    .nfc-pulse {
      margin-top: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      width: 64px;
      height: 64px;
      margin-left: auto;
      margin-right: auto;
    }

    .nfc-icon {
      font-size: 28px;
      z-index: 2;
    }

    .nfc-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid rgba(0, 156, 221, 0.5);
      animation: nfc-ripple 2s ease-out infinite;
    }

    .nfc-ring:nth-child(2) {
      animation-delay: 1s;
    }

    @keyframes nfc-ripple {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.4); opacity: 0; }
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
      box-shadow: 0 0 0 3px rgba(0, 156, 221, 0.25);
    }

    .nfc-submit, .control-btn {
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid transparent;
      font-weight: 650;
      font-size: 15px;
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

    .control-btn svg {
      vertical-align: -2px;
    }

    .control-rail {
      margin-top: 18px;
      position: relative;
      z-index: 3;
      display: flex;
      gap: 12px;
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
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 28px;
      color: var(--text-secondary);
      border-top: 1px solid var(--border-soft);
      backdrop-filter: blur(8px);
      background: rgba(30, 35, 56, 0.45);
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
      right: 20px;
      bottom: 20px;
      z-index: 18;
      width: min(320px, calc(100vw - 40px));
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(26, 31, 51, 0.88);
      backdrop-filter: blur(14px);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      padding: 14px;
      overflow: hidden;
    }

    .movement-cam-wrap {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
    }

    .movement-head {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 10px;
    }

    .movement-head-label {
      flex: 1;
    }

    .movement-head-badge {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(100, 116, 139, 0.25);
      color: var(--text-secondary);
      transition: background var(--ease), color var(--ease);
    }

    .movement-head-badge.active {
      background: rgba(0, 156, 221, 0.2);
      color: var(--polytech-secondary);
    }

    .movement-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #475569;
      box-shadow: 0 0 0 2px rgba(71, 85, 105, 0.25);
      transition: background 300ms ease, box-shadow 300ms ease;
      flex-shrink: 0;
    }

    .movement-dot.active {
      background: var(--polytech-secondary);
      box-shadow: 0 0 0 4px rgba(0, 156, 221, 0.2), 0 0 12px rgba(0, 156, 221, 0.3);
    }

    .movement-cam {
      width: 100%;
      height: 170px;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: #0c1120;
      transform: scaleX(-1);
    }

    .movement-toast {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(0, 156, 221, 0.18);
      border: 1px solid rgba(0, 156, 221, 0.3);
      color: #d0e7ff;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 250ms ease, transform 250ms ease;
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
        width: min(260px, calc(100vw - 24px));
        right: 12px;
        bottom: 12px;
      }
      .movement-cam {
        height: 130px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    }

    /* ── Error overlay ── */
    .error-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: grid;
      place-items: center;
      background: rgba(26, 31, 51, 0.92);
      backdrop-filter: blur(12px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 400ms ease;
    }
    .error-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }
    .error-box {
      text-align: center;
      max-width: 460px;
      padding: 40px;
    }
    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .error-box h2 {
      margin: 0 0 10px 0;
      font-size: 24px;
      color: var(--text-primary);
    }
    .error-box p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 15px;
      line-height: 1.5;
    }
    .error-spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: var(--polytech-secondary);
      border-radius: 50%;
      animation: errorSpin 0.8s linear infinite;
      vertical-align: -3px;
      margin-right: 6px;
    }
    @keyframes errorSpin {
      to { transform: rotate(360deg); }
    }

    /* ── NFC error banner ── */
    .nfc-error-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 12px;
      padding: 14px 20px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: bannerSlideIn 350ms ease;
    }
    .nfc-error-banner .banner-icon {
      font-size: 22px;
      flex-shrink: 0;
    }
    .nfc-error-banner .banner-text {
      font-size: 15px;
      color: #fca5a5;
      line-height: 1.4;
    }
    .nfc-error-banner .banner-text strong {
      color: #fecaca;
    }
    @keyframes bannerSlideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Timeout warning toast ── */
    .timeout-toast {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%) translateY(80px);
      background: rgba(245, 158, 11, 0.18);
      border: 1px solid rgba(245, 158, 11, 0.45);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 40;
      opacity: 0;
      pointer-events: none;
      transition: opacity 350ms ease, transform 350ms ease;
    }
    .timeout-toast.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(-50%) translateY(0);
    }
    .timeout-toast .toast-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
    .timeout-toast .toast-text {
      font-size: 14px;
      color: #fcd34d;
      white-space: nowrap;
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
 * User-friendly label for each state.
 */
const STATE_LABELS = {
  [STATE.IDLE]: "Welcome",
  [STATE.MENU]: "How can we help you?",
  [STATE.VISITOR_INFO]: "Visitor Information",
  [STATE.STUDENT_INFO]: "Student Portal",
};

/**
 * Renders top header with branding and optional debug info.
 *
 * @param {object} status - State status payload.
 * @param {boolean} forceDebug - Whether to show technical details.
 * @returns {string} HTML fragment.
 */
function renderHead(status, forceDebug) {
  const label = STATE_LABELS[status.state] || status.state;
  const debugInfo = forceDebug
    ? `<div class="head-debug">${escapeHtml(status.state)} | ${escapeHtml(status.campaignName || "n/a")} | item ${status.itemIndex + 1}</div>`
    : "";
  return `
    <header class="head">
      <div class="head-brand">
        <img class="head-logo" src="https://polytech.grenoble-inp.fr/uas/polytech/PROPRIETE_LOGO_TERTIAIRE/Grenoble+INP+-+Logo+RS+rond+-+Polytech+V2+%28300x300%29.png" alt="Polytech Grenoble" />
        <div class="head-title">IDS<small>Polytech Grenoble</small></div>
      </div>
      <div class="state" data-state="${escapeHtml(status.state)}">${escapeHtml(label)}</div>
      ${debugInfo}
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
  const nfcErrorHtml = status.lastNfcError
    ? `<div class="nfc-error-banner">
        <span class="banner-icon">&#x26A0;</span>
        <span class="banner-text"><strong>Card not recognized</strong> — please register at the front desk or try again.</span>
      </div>`
    : "";
  return `
    <section class="menu-surface">
      ${nfcErrorHtml}
      <div class="menu-copy">
        <h2>${escapeHtml(prompt)}</h2>
        <p>${escapeHtml(helper)}</p>
      </div>
      <div class="menu-grid">
        <button class="choice-card visitor-card" onclick="sendEvent({type:'visitor_selected'})">
          <div class="choice-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00b8d4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span class="choice-kicker">Visitor</span>
          <span class="choice-title">I'm visiting</span>
          <span class="choice-sub">Browse campus info, programs, and more</span>
        </button>
        <div class="choice-card nfc-card">
          <div class="choice-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#009cdd" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <span class="choice-kicker">Student</span>
          <span class="choice-title">Tap your card</span>
          <span class="choice-sub">Place your student card on the NFC reader</span>
          <div class="nfc-pulse"><div class="nfc-ring"></div><div class="nfc-ring"></div><div class="nfc-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#009cdd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg></div></div>
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

  const isIdle = status.state === STATE.IDLE;
  const isInfo = status.state === STATE.VISITOR_INFO || status.state === STATE.STUDENT_INFO;

  const guidance = isIdle
    ? `<div class="guidance-chip"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Wave your hand to begin</div>`
    : "";

  const arrowLeft = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const arrowRight = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;

  const controls = isIdle
    ? ""
    : `
      <div class="control-rail">
        <button class="control-btn" onclick="sendEvent({type:'scroll_prev'})">${arrowLeft} Previous</button>
        <button class="control-btn" onclick="sendEvent({type:'scroll_next'})">Next ${arrowRight}</button>
      </div>
    `;

  const progressDots = isInfo && status.itemTotal > 1
    ? `<div class="progress-bar">${Array.from({ length: status.itemTotal }, (_, i) =>
        `<span class="progress-dot${i === status.itemIndex ? " active" : ""}"></span>`
      ).join("")}<span class="progress-label">${status.itemIndex + 1} / ${status.itemTotal}</span></div>`
    : "";

  const studentBanner = status.state === STATE.STUDENT_INFO && status.currentStudentName
    ? `<div class="student-banner">
        <div class="student-avatar">${escapeHtml(status.currentStudentName.charAt(0).toUpperCase())}</div>
        <div class="student-meta">
          <strong>${escapeHtml(status.currentStudentName)}</strong>
          <span>Student Dashboard</span>
        </div>
      </div>`
    : "";

  const backArrow = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const backHint = isInfo
    ? `<button class="back-hint" onclick="sendEvent({type:'movement_detected'})">${backArrow} Back</button>`
    : "";

  return `
    <section class="viewport-inner">
      ${backHint}
      ${studentBanner}
      ${mediaHtml}
      ${guidance}
      ${controls}
      ${progressDots}
    </section>
  `;
}

/**
 * Renders footer with branding and optional debug info.
 *
 * @param {object} status - State status payload.
 * @param {boolean} forceDebug - Whether to show technical details.
 * @returns {string} HTML fragment.
 */
function renderFooter(status, forceDebug) {
  const debugSpan = forceDebug
    ? `<span style="margin-left:auto;">Timeout: ${Number(status.inactivityTimeoutMs)}ms</span>`
    : "";
  return `
    <footer class="foot">
      <span>Polytech Grenoble &mdash; Interactive Digital Signage</span>
      ${debugSpan}
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
function renderDebugPanel(status, forceDebug, detectorToken) {
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
      <h4 style="margin:12px 0 6px;color:var(--text-secondary);font-size:12px;">Simulate Events</h4>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="nfc-submit" onclick="fetch('/detector/events',{method:'POST',headers:{'content-type':'application/json','x-detector-token':'${escapeHtml(detectorToken)}'},body:JSON.stringify({type:'movement_detected',source:'debug'})}).then(()=>location.reload())">Movement</button>
        <button class="nfc-submit" onclick="sendEvent({type:'visitor_selected'}).then?.(()=>location.reload())">Visitor</button>
      </div>
      <h4 style="margin:12px 0 6px;color:var(--text-secondary);font-size:12px;">Manual NFC</h4>
      <div class="nfc-row">
        <input id="uid" placeholder="Enter NFC UID" aria-label="NFC UID" />
        <button class="nfc-submit" onclick="sendEvent({type:'nfc_tap', nfcUid: document.getElementById('uid').value})">Scan</button>
      </div>
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
    function fadeOutAndReload() {
      document.body.classList.remove('visible');
      setTimeout(() => location.reload(), 350);
    }

    function sendEvent(payload) {
      fetch('/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(() => fadeOutAndReload());
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

    // Fade in on page load
    requestAnimationFrame(() => document.body.classList.add('visible'));

    scheduleIdleAutoScroll();
    initDebugPanel();

    let consecutiveErrors = 0;
    const errorOverlay = document.getElementById('errorOverlay');
    const timeoutToast = document.getElementById('timeoutToast');
    const timeoutText = document.getElementById('timeoutText');
    const TIMEOUT_WARNING_MS = 5000;

    setInterval(() => {
      fetch('/current').then((r) => r.json()).then((next) => {
        if (consecutiveErrors > 0) {
          consecutiveErrors = 0;
          errorOverlay.classList.remove('visible');
        }
        if (next.state !== ${JSON.stringify(status.state)} || next.itemIndex !== ${JSON.stringify(status.itemIndex)}) {
          fadeOutAndReload();
        }
        if (next.timeoutEndsAt && next.state !== 'IDLE') {
          const remaining = next.timeoutEndsAt - Date.now();
          if (remaining <= TIMEOUT_WARNING_MS && remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            timeoutText.textContent = 'Returning to home in ' + secs + 's\u2026';
            timeoutToast.classList.add('visible');
          } else {
            timeoutToast.classList.remove('visible');
          }
        } else {
          timeoutToast.classList.remove('visible');
        }
      }).catch(() => {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          errorOverlay.classList.add('visible');
        }
      });
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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
  <script type="module">
    import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';
    window.FilesetResolver = FilesetResolver;
    window.HandLandmarker = HandLandmarker;
    window.dispatchEvent(new Event('mediapipe-loaded'));
  </script>
  <style>${PLAYER_PAGE_STYLES}</style>
</head>
<body class="player-body ${stateClass}">
  <div class="wrap">
    ${renderHead(status, forceDebug)}
    <main class="viewport">${renderViewport(status, item)}</main>
    ${renderFooter(status, forceDebug)}
  </div>
  <aside class="movement-widget">
    <div class="movement-head">
      <span id="movementDot" class="movement-dot"></span>
      <span class="movement-head-label">Gesture Detection</span>
      <span id="movementBadge" class="movement-head-badge">Standby</span>
    </div>
    <div class="movement-cam-wrap">
      <video id="movementCam" class="movement-cam" autoplay muted playsinline></video>
      <canvas id="handTrackerCanvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;border-radius:10px;transform:scaleX(-1);"></canvas>
    </div>
    <div id="movementToast" class="movement-toast">&#x2728; Gesture detected</div>
  </aside>
  <div id="timeoutToast" class="timeout-toast">
    <span class="toast-icon">&#x23F3;</span>
    <span class="toast-text" id="timeoutText">Returning to home in 5s...</span>
  </div>
  <div id="errorOverlay" class="error-overlay">
    <div class="error-box">
      <div class="error-icon">&#x1F4E1;</div>
      <h2>Connecting to server&hellip;</h2>
      <p><span class="error-spinner"></span>The display will resume automatically once the admin service is reachable.</p>
    </div>
  </div>
  ${renderDebugPanel(status, forceDebug, detectorToken)}
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
