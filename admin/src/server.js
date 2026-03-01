/**
 * IDS Admin — HTTP API + web UI.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const {
  ValidationError,
  readState,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  setActiveCampaigns,
  setSettings,
  upsertStudent,
  deleteStudent,
  setMenuCampaign,
  toRuntimeConfig,
} = require("./storage");

const ADMIN_UI_JS_PATH = path.resolve(__dirname, "../public/admin-ui.js");
const DATA_DIR = process.env.IDS_ADMIN_DATA_DIR
  ? path.resolve(process.env.IDS_ADMIN_DATA_DIR)
  : path.resolve(__dirname, "../data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function readJsonBody(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > maxBytes) {
        reject(new ValidationError([{ path: "body", message: "Body too large", code: "too_large" }]));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new ValidationError([{ path: "body", message: "Invalid JSON body", code: "invalid_json" }]));
      }
    });
  });
}

function readRawBody(req, maxBytes = MAX_UPLOAD_SIZE + 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new ValidationError([{ path: "file", message: "Upload too large", code: "too_large" }]));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function text(res, code, body, contentType) {
  res.writeHead(code, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendValidationError(res, err) {
  if (err instanceof ValidationError) {
    return json(res, 400, {
      error: "validation_failed",
      issues: err.issues,
    });
  }

  return json(res, 400, {
    error: "validation_failed",
    issues: [{ path: "request", message: err.message || "Invalid request", code: "invalid_request" }],
  });
}

function sanitizeFilename(filename) {
  return String(filename || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getExtFromMime(mime) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/quicktime") return ".mov";
  return "";
}

function isAllowedMimeType(mimeType) {
  return /^image\//.test(mimeType) || /^video\//.test(mimeType);
}

function buildAbsoluteUrl(req, pathname) {
  const configured = process.env.IDS_PUBLIC_ADMIN_URL;
  if (configured) {
    return `${configured.replace(/\/$/, "")}${pathname}`;
  }

  const host = req.headers.host || "127.0.0.1:8081";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}${pathname}`;
}

function parseMultipartFile(bodyBuffer, contentType) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType || "");
  if (!boundaryMatch) {
    throw new ValidationError([{ path: "file", message: "Missing multipart boundary", code: "invalid_multipart" }]);
  }

  const boundary = boundaryMatch[1].trim();
  const body = bodyBuffer.toString("latin1");
  const delimiter = `--${boundary}`;
  const parts = body.split(delimiter);

  for (const partRaw of parts) {
    const part = partRaw.trim();
    if (!part || part === "--") continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;

    const headerText = part.slice(0, headerEnd);
    const contentText = part.slice(headerEnd + 4).replace(/\r\n--$/, "");

    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headerText);
    if (!disposition) continue;

    const nameMatch = /name="([^"]+)"/i.exec(disposition[1]);
    const filenameMatch = /filename="([^"]*)"/i.exec(disposition[1]);

    if (!nameMatch || nameMatch[1] !== "file") continue;

    const mimeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText);
    const mimeType = (mimeMatch?.[1] || "application/octet-stream").trim().toLowerCase();
    const originalName = filenameMatch?.[1] || "upload.bin";

    const fileBuffer = Buffer.from(contentText, "latin1");

    return {
      originalName,
      mimeType,
      buffer: fileBuffer,
      size: fileBuffer.length,
    };
  }

  throw new ValidationError([{ path: "file", message: "Missing file field in multipart payload", code: "required" }]);
}

function processUploadMultipart({ bodyBuffer, contentType, reqLike }) {
  const file = parseMultipartFile(bodyBuffer, contentType);

  if (file.size < 1) {
    throw new ValidationError([{ path: "file", message: "File is empty", code: "empty_file" }]);
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new ValidationError([{ path: "file", message: "File exceeds 20MB limit", code: "too_large" }]);
  }

  if (!isAllowedMimeType(file.mimeType)) {
    throw new ValidationError([
      { path: "file", message: "Only image/* and video/* uploads are allowed", code: "invalid_mime_type" },
    ]);
  }

  const safeBaseName = sanitizeFilename(file.originalName.replace(/\.[^.]+$/, "")) || "media";
  const ext = getExtFromMime(file.mimeType) || path.extname(file.originalName).toLowerCase() || ".bin";
  const mediaId = crypto.randomBytes(6).toString("hex");
  const filename = `${safeBaseName}-${mediaId}${ext}`;

  ensureUploadDir();
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);

  const urlPath = `/media/${filename}`;
  const absoluteUrl = buildAbsoluteUrl(reqLike || { headers: {} }, urlPath);

  return {
    mediaId,
    url: absoluteUrl,
    urlPath,
    mimeType: file.mimeType,
    size: file.size,
    filename,
  };
}

function resolveMimeByExtension(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

function renderAdminPage() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Digital Signage Campaign Builder</title>
  <style>
    :root {
      --bg-primary: #f8f9fa;
      --bg-secondary: #ffffff;
      --border: #e5e7eb;
      --border-light: #f0f1f3;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --text-tertiary: #9ca3af;
      --accent: #3b82f6;
      --accent-light: #dbeafe;
      --accent-dark: #1e40af;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --sidebar-width: 280px;
      --inspector-width: 320px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
    }

    /* Main Layout */
    .app-container {
      display: grid;
      grid-template-columns: var(--sidebar-width) 1fr var(--inspector-width);
      height: 100vh;
      gap: 0;
    }

    /* ===== SIDEBAR ===== */
    .sidebar {
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-header {
      padding: 20px 16px;
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    }

    .sidebar-logo {
      font-size: 13px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 16px 0;
    }

    .sidebar-search {
      position: relative;
    }

    .sidebar-search input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      background: var(--bg-primary);
      color: var(--text-primary);
      transition: all 0.2s;
    }

    .sidebar-search input:focus {
      outline: none;
      border-color: var(--accent);
      background: var(--bg-secondary);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .sidebar-action {
      margin-top: 12px;
    }

    .btn-create {
      width: 100%;
      padding: 10px 12px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-create:hover {
      background: var(--accent-dark);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px 8px;
    }

    .campaign-group {
      margin-bottom: 20px;
    }

    .campaign-group-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-tertiary);
      padding: 8px 12px;
      letter-spacing: 0.5px;
    }

    .campaign-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      margin: 4px 0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }

    .campaign-item:hover {
      background: var(--bg-primary);
      border-color: var(--border-light);
    }

    .campaign-item.active {
      background: var(--accent-light);
      border-color: var(--accent);
      color: var(--accent-dark);
    }

    .campaign-item-icon {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      flex-shrink: 0;
      background: var(--bg-primary);
      color: var(--text-secondary);
    }

    .campaign-item.active .campaign-item-icon {
      background: var(--accent);
      color: white;
    }

    .campaign-item-name {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .campaign-item-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      background: var(--bg-primary);
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .campaign-item-badge.live {
      background: #dcfce7;
      color: #166534;
    }

    .campaign-item-badge.draft {
      background: #f3f4f6;
      color: #6b7280;
    }

    /* ===== CENTER CANVAS ===== */
    .center-canvas {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-primary);
    }

    .canvas-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-secondary);
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .canvas-header-top {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .header-title-block {
      flex: 1;
    }

    .header-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-title input {
      font: inherit;
      font-weight: 600;
      border: 1px solid var(--border);
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
      flex: 1;
      max-width: 400px;
    }

    .header-title input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-secondary);
    }

    .status-indicator.live {
      background: #dcfce7;
      color: #166534;
    }

    .status-indicator.draft {
      background: #fef3c7;
      color: #92400e;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: var(--accent);
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-dark);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .btn-secondary {
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg-secondary);
      border-color: var(--text-secondary);
    }

    .canvas-header-bottom {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .form-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .form-row label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .form-row select {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      background: var(--bg-primary);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .form-row select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .canvas-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .blocks-container {
      max-width: 700px;
    }

    .blocks-empty {
      text-align: center;
      padding: 40px 24px;
      color: var(--text-tertiary);
    }

    .blocks-empty svg {
      width: 48px;
      height: 48px;
      opacity: 0.3;
      margin-bottom: 12px;
    }

    .blocks-empty p {
      margin: 8px 0;
      font-size: 14px;
    }

    /* Block Cards */
    .block-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
      transition: all 0.2s;
      position: relative;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .block-card:hover {
      border-color: var(--accent);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
    }

    .block-card.selected {
      border-color: var(--accent);
      background: #f0f9ff;
      box-shadow: 0 0 0 3px var(--accent-light);
    }
    .block-card.dragging {
      opacity: 0.55;
      transform: scale(0.995);
    }
    .block-card.drop-target {
      border-color: var(--accent-dark);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
      background: #eef6ff;
    }

    .block-drag-handle {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      cursor: grab;
      flex-shrink: 0;
      font-size: 12px;
    }

    .block-drag-handle:active {
      cursor: grabbing;
    }

    .block-content {
      flex: 1;
      min-width: 0;
    }

    .block-head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .block-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      background: var(--accent-light);
      color: var(--accent-dark);
      border-radius: 4px;
      text-transform: uppercase;
    }

    .block-preview {
      font-size: 13px;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 300px;
    }

    .block-duration {
      font-size: 12px;
      color: var(--text-tertiary);
      background: var(--bg-primary);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .block-menu {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .block-menu:hover {
      background: var(--bg-primary);
      color: var(--text-secondary);
    }

    .add-block-button {
      width: 100%;
      padding: 12px;
      border: 2px dashed var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
      margin: 20px 0;
    }

    .add-block-button:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-light);
    }

    /* ===== INSPECTOR PANEL ===== */
    .inspector {
      background: var(--bg-secondary);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .inspector-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    }

    .inspector-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-tertiary);
      letter-spacing: 0.5px;
      margin: 0;
    }

    .inspector-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .form-input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      color: var(--text-primary);
      background: var(--bg-primary);
      transition: all 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
      background: var(--bg-secondary);
    }

    .form-textarea {
      min-height: 80px;
      resize: vertical;
    }

    .form-select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      background: var(--bg-primary);
      color: var(--text-primary);
      cursor: pointer;
    }

    .form-select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }

    .inspector-section {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-light);
    }

    .inspector-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 12px 0;
    }

    .validation-error {
      font-size: 12px;
      color: var(--danger);
      margin-top: 4px;
      display: none;
    }

    .validation-error.show {
      display: block;
    }

    /* Status Messages */
    #status {
      position: fixed;
      bottom: 20px;
      right: 20px;
      max-width: 400px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      display: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
    }

    #status.show {
      display: block;
    }

    #status.good {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    #status.bad {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    @keyframes slideIn {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    /* Scrollbar Styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-tertiary);
    }

    /* Responsive */
    @media (max-width: 1400px) {
      :root {
        --sidebar-width: 240px;
        --inspector-width: 280px;
      }
    }

    @media (max-width: 1200px) {
      .app-container {
        grid-template-columns: var(--sidebar-width) 1fr;
      }

      .inspector {
        display: none;
      }

      .canvas-scroll {
        padding: 20px;
      }
    }
    @media (max-width: 900px) {
      .app-container {
        grid-template-columns: 1fr;
      }
      .sidebar {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="app-container">
    <!-- SIDEBAR: Campaign Library -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">Campaigns</div>
        <div class="sidebar-search">
          <input type="text" id="sidebarSearch" placeholder="Search campaigns..." />
        </div>
        <div class="sidebar-action">
          <button class="btn-create" onclick="createNewCampaign()">+ Create</button>
        </div>
      </div>

      <div class="sidebar-content" id="sidebarContent">
        <!-- Populated by JavaScript -->
      </div>
    </aside>

    <!-- CENTER: Campaign Editor -->
    <div class="center-canvas">
      <header class="canvas-header">
        <div class="canvas-header-top">
          <div class="header-title-block">
            <h1 class="header-title">
              <input type="text" id="campaignNameInput" placeholder="Untitled Campaign" value="" />
            </h1>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" id="publishBtn" onclick="publishCampaign()">Publish</button>
            <button class="btn btn-primary" id="saveCampaignBtn" onclick="saveBuilderCampaign()">Save</button>
          </div>
        </div>

        <div class="canvas-header-bottom">
          <div class="form-row">
            <label for="builderType">Type:</label>
            <select id="builderType"></select>
          </div>
          <div class="form-row" id="studentUidWrap" style="display:none">
            <label for="studentUid">Student UID:</label>
            <input type="text" id="studentUid" placeholder="e.g. stu-001" style="width: 120px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;" />
          </div>
          <div style="margin-left: auto;">
            <span class="status-indicator" id="statusBadge">Draft</span>
          </div>
        </div>
      </header>

      <div class="canvas-scroll">
        <div class="blocks-container">
          <div id="blocks"></div>
          <button class="add-block-button" id="addBlockBtn" onclick="showAddBlockMenu()">
            + Add Block
          </button>
        </div>
      </div>
    </div>

    <!-- RIGHT: Inspector Panel -->
    <aside class="inspector">
      <div class="inspector-header">
        <h3 class="inspector-title">Properties</h3>
      </div>
      <div class="inspector-content" id="inspectorContent">
        <div class="blocks-empty" style="text-align: center; color: var(--text-tertiary); font-size: 12px;">
          Select a campaign or block to view properties
        </div>
      </div>
    </aside>
  </div>

  <!-- Status Toast -->
  <div id="status" class="status-toast"></div>

  <script src="/admin-ui.js"></script>
</body>
</html>`;
}

function parsePathnameComponent(pathname, prefix) {
  return decodeURIComponent(pathname.slice(prefix.length));
}

function createServer({ port = 8081 } = {}) {
  ensureUploadDir();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return text(res, 200, renderAdminPage(), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/admin-ui.js") {
      const script = fs.readFileSync(ADMIN_UI_JS_PATH, "utf8");
      return text(res, 200, script, "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      const state = readState();
      return json(res, 200, { state });
    }

    if (req.method === "GET" && url.pathname === "/runtime-config") {
      const state = readState();
      return json(res, 200, toRuntimeConfig(state));
    }

    if (req.method === "GET" && url.pathname.startsWith("/media/")) {
      const filename = parsePathnameComponent(url.pathname, "/media/");
      if (!filename || filename.includes("/") || filename.includes("..")) {
        return json(res, 400, {
          error: "validation_failed",
          issues: [{ path: "filename", message: "Invalid media filename", code: "invalid_path" }],
        });
      }

      const filePath = path.join(UPLOAD_DIR, filename);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return json(res, 404, {
          error: "validation_failed",
          issues: [{ path: "filename", message: "Media file not found", code: "not_found" }],
        });
      }

      const mime = resolveMimeByExtension(filename);
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": stat.size,
        "Cache-Control": "public, max-age=604800",
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/media/upload") {
      try {
        const contentType = req.headers["content-type"] || "";
        if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
          throw new ValidationError([
            {
              path: "file",
              message: "content-type must be multipart/form-data",
              code: "invalid_content_type",
            },
          ]);
        }

        const rawBody = await readRawBody(req);
        const uploaded = processUploadMultipart({ bodyBuffer: rawBody, contentType, reqLike: req });
        return json(res, 201, uploaded);
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/campaigns") {
      try {
        const body = await readJsonBody(req);
        const state = createCampaign(body);
        return json(res, 201, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/campaigns/")) {
      const campaignId = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const body = await readJsonBody(req);
        const state = updateCampaign(campaignId, body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/campaigns/")) {
      const campaignId = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const state = deleteCampaign(campaignId);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/active") {
      try {
        const body = await readJsonBody(req);
        const state = setActiveCampaigns(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/settings") {
      try {
        const body = await readJsonBody(req);
        const state = setSettings(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/menu-campaign") {
      try {
        const body = await readJsonBody(req);
        const state = setMenuCampaign(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/students") {
      try {
        const body = await readJsonBody(req);
        const state = upsertStudent(body);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/students/")) {
      const uid = decodeURIComponent(url.pathname.split("/")[3] || "");
      try {
        const state = deleteStudent(uid);
        return json(res, 200, { state });
      } catch (e) {
        return sendValidationError(res, e);
      }
    }

    return json(res, 404, { error: `not_found: ${url.pathname}` });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`IDS Admin listening on http://127.0.0.1:${port}`);
  });

  return server;
}

module.exports = { createServer, MAX_UPLOAD_SIZE, UPLOAD_DIR, processUploadMultipart };
